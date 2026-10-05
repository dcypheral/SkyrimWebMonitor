/**
 * The player's strategy guide: a PDF picked from the device (never shipped
 * with the app), its bookmarks and text index, the player's own bookmarks
 * and highlights, and which guide page belongs to which quest.
 */
import { defineStore } from 'pinia';
import { reactive, ref, shallowRef } from 'vue';
import { fold } from '@/shared/lib/guide/ocrText';
import { outlinePath, sectionAt, type GuideOutlineEntry } from '@/shared/lib/guide/outline';
import { foldPage, searchPages, type FoldedPage, type GuidePageText, type SearchHit } from '@/shared/lib/guide/pageText';
import { matchBookmarks, matchText, type QuestRef } from '@/shared/lib/guide/questMatch';
import { guideFingerprint, openBlobPdf, readOutline, type PDFDocumentProxy } from '@/shared/lib/guide/pdfDocument';
import * as db from './lib/guideDb';
import { runIndexer, type IndexedPage } from './lib/textIndexer';
import type {
  GuideAnnotation,
  GuideBookmark,
  GuideHighlight,
  GuideMeta,
  GuideTargetRef,
  HighlightColor,
  QuestGuideMatch,
} from './lib/types';

export type GuideStatus = 'idle' | 'loading' | 'none' | 'ready' | 'error';

export interface GuideQuest extends QuestRef {
  questEditorId?: string;
  isMisc?: boolean;
}

/** Stable key for a quest across sessions and load orders. */
export function questKeyOf(quest: Pick<GuideQuest, 'questEditorId' | 'name'>): string {
  return quest.questEditorId || `name:${quest.name}`;
}

export interface ReaderState {
  open: boolean;
  /** Page to show when the reader opens or jumps (0-based). */
  page: number;
  /** Bumped on every jump so the same page can be requested twice. */
  jump: number;
  /** Quest the reader was opened for. */
  quest: { key: string; name: string } | null;
  /** Text to outline on the target page (quest name or search). */
  flash: string;
  /** Search box text to start with. */
  search: string;
  /** The reader wants the text index now (search is open). */
  needsIndex: boolean;
}

/** Wait after start-up before the background text index starts. */
const INDEX_START_DELAY_MS = 4000;
/** Re-run text matching after this many newly indexed pages. */
const MATCH_REFRESH_PAGES = 120;
const LAST_PAGE_SAVE_DELAY_MS = 1500;

export const useGuideStore = defineStore('guide', () => {
  const status = ref<GuideStatus>('idle');
  const error = ref<string | null>(null);
  const fileName = ref('');
  const fileSize = ref(0);
  /** False when the copy into app storage failed (session only). */
  const persisted = ref(true);
  const fp = ref<string | null>(null);
  const pageCount = ref(0);
  const pageWidth = ref(0);
  const pageHeight = ref(0);
  const outline = shallowRef<GuideOutlineEntry[]>([]);
  const indexedPages = ref(0);
  const indexing = ref(false);
  /** Bumped when text matching should be redone. */
  const matchVersion = ref(0);
  const annotations = ref<GuideAnnotation[]>([]);
  /** questKey → page. */
  const links = ref<Record<string, number>>({});
  const lastPage = ref(0);
  const reader = reactive<ReaderState>({
    open: false,
    page: 0,
    jump: 0,
    quest: null,
    flash: '',
    search: '',
    needsIndex: false,
  });

  let blob: Blob | null = null;
  let docPromise: Promise<PDFDocumentProxy> | null = null;
  let meta: GuideMeta | null = null;
  const texts = new Map<number, GuidePageText>();
  const sizes = new Map<number, { width: number; height: number }>();
  let folded: FoldedPage[] = [];
  let indexAbort: AbortController | null = null;
  let indexTimer: ReturnType<typeof setTimeout> | null = null;
  let initPromise: Promise<void> | null = null;
  let lastPageTimer: ReturnType<typeof setTimeout> | null = null;
  const matchCache = new Map<string, QuestGuideMatch | null>();

  // ─── Loading ──────────────────────────────────────────────────────────

  function resetState(): void {
    stopIndexer();
    void docPromise?.then((d) => d.loadingTask.destroy()).catch(() => undefined);
    docPromise = null;
    blob = null;
    meta = null;
    texts.clear();
    sizes.clear();
    folded = [];
    matchCache.clear();
    fp.value = null;
    fileName.value = '';
    fileSize.value = 0;
    pageCount.value = 0;
    outline.value = [];
    indexedPages.value = 0;
    annotations.value = [];
    links.value = {};
    lastPage.value = 0;
    reader.open = false;
  }

  async function loadDerived(m: GuideMeta): Promise<void> {
    meta = m;
    fp.value = m.fp;
    pageCount.value = m.pageCount;
    pageWidth.value = m.pageWidth;
    pageHeight.value = m.pageHeight;
    outline.value = m.outline;
    lastPage.value = m.lastPage;
    const [pages, notes, linkRecords] = await Promise.all([db.readPages(m.fp), db.readAnnotations(m.fp), db.readLinks(m.fp)]);
    addPages(pages);
    indexedPages.value = Math.min(m.indexedPages, m.pageCount);
    annotations.value = notes;
    links.value = Object.fromEntries(linkRecords.map((l) => [l.questKey, l.page]));
    matchVersion.value++;
  }

  function addPages(pages: readonly IndexedPage[]): void {
    for (const p of pages) {
      texts.set(p.page, { page: p.page, text: p.text, boxes: p.boxes });
      sizes.set(p.page, { width: p.width, height: p.height });
      folded.push(foldPage(p));
    }
    folded.sort((a, b) => a.page - b.page);
  }

  /** Restores the guide picked in an earlier session. Safe to call often. */
  function init(): Promise<void> {
    if (!initPromise) {
      initPromise = (async () => {
        status.value = 'loading';
        try {
          const file = await db.readFile();
          if (!file?.fp) {
            status.value = 'none';
            return;
          }
          const m = await db.readMeta(file.fp);
          blob = file.blob;
          fileName.value = file.name;
          fileSize.value = file.size;
          persisted.value = true;
          if (m) {
            await loadDerived(m);
          } else {
            await analyse(file.blob, file.size);
          }
          status.value = 'ready';
          scheduleIndexer(INDEX_START_DELAY_MS);
        } catch (err) {
          console.warn('[Guide] Restore failed', err);
          error.value = err instanceof Error ? err.message : String(err);
          status.value = 'error';
        }
      })();
    }
    return initPromise;
  }

  /** Reads outline and page size from the PDF and saves them. */
  async function analyse(source: Blob, size: number): Promise<string> {
    const doc = await openBlobPdf(source);
    docPromise = Promise.resolve(doc);
    const id = guideFingerprint(doc, size);
    const existing = await db.readMeta(id);
    if (existing) {
      await loadDerived(existing);
      return id;
    }
    const first = await doc.getPage(1);
    const { width, height } = first.getViewport({ scale: 1 });
    first.cleanup();
    const m: GuideMeta = {
      fp: id,
      pageCount: doc.numPages,
      outline: await readOutline(doc),
      pageWidth: width,
      pageHeight: height,
      indexedPages: 0,
      lastPage: 0,
    };
    await db.writeMeta(m);
    await loadDerived(m);
    return id;
  }

  /** Uses a PDF the player picked. The file is copied into app storage. */
  async function pickFile(file: File): Promise<void> {
    await initPromise?.catch(() => undefined);
    const previous = fp.value;
    resetState();
    status.value = 'loading';
    error.value = null;
    try {
      void navigator.storage?.persist?.().catch(() => false);
      const id = await analyse(file, file.size);
      blob = file;
      fileName.value = file.name;
      fileSize.value = file.size;
      try {
        await db.writeFile({ blob: file, name: file.name, size: file.size, lastModified: file.lastModified, addedAt: Date.now(), fp: id });
        persisted.value = true;
      } catch (err) {
        console.warn('[Guide] Could not keep a copy of the guide', err);
        persisted.value = false;
      }
      if (previous && previous !== id) await db.deleteDerived(previous).catch(() => undefined);
      status.value = 'ready';
      initPromise = Promise.resolve();
      scheduleIndexer(500);
    } catch (err) {
      console.warn('[Guide] Could not open the guide', err);
      resetState();
      error.value = err instanceof Error ? err.message : String(err);
      status.value = 'error';
    }
  }

  /** Forgets the PDF and its index. Bookmarks, highlights and links stay. */
  async function removeFile(): Promise<void> {
    const id = fp.value;
    resetState();
    await db.deleteFile().catch(() => undefined);
    if (id) await db.deleteDerived(id).catch(() => undefined);
    status.value = 'none';
    initPromise = Promise.resolve();
  }

  /** The pdf.js document for rendering (opened on first use). */
  function getDocument(): Promise<PDFDocumentProxy> {
    if (!blob) return Promise.reject(new Error('No guide loaded'));
    if (!docPromise) {
      const source = blob;
      docPromise = openBlobPdf(source);
      docPromise.catch(() => {
        docPromise = null;
      });
    }
    return docPromise;
  }

  /** Page size in PDF points; unmeasured pages use the first page's size. */
  function pageSize(page: number): { width: number; height: number } {
    return sizes.get(page) ?? { width: pageWidth.value || 1, height: pageHeight.value || 1.38 };
  }

  // ─── Text index ───────────────────────────────────────────────────────

  function stopIndexer(): void {
    if (indexTimer) clearTimeout(indexTimer);
    indexTimer = null;
    indexAbort?.abort();
    indexAbort = null;
    indexing.value = false;
  }

  function scheduleIndexer(delay: number): void {
    if (indexTimer || indexing.value) return;
    indexTimer = setTimeout(() => {
      indexTimer = null;
      void startIndexer();
    }, delay);
  }

  async function startIndexer(): Promise<void> {
    if (!blob || !meta || indexing.value || indexedPages.value >= pageCount.value) return;
    const controller = new AbortController();
    indexAbort = controller;
    indexing.value = true;
    const id = meta.fp;
    let sinceRefresh = 0;
    try {
      await runIndexer({
        blob,
        from: indexedPages.value,
        pageCount: pageCount.value,
        signal: controller.signal,
        // Reading wins over indexing unless the reader is searching.
        isPaused: () => reader.open && !reader.needsIndex,
        onPages: async (pages, next) => {
          if (controller.signal.aborted || fp.value !== id) return;
          addPages(pages);
          indexedPages.value = next;
          sinceRefresh += pages.length;
          if (sinceRefresh >= MATCH_REFRESH_PAGES || next >= pageCount.value) {
            sinceRefresh = 0;
            matchCache.clear();
            matchVersion.value++;
          }
          await db.writePages(id, pages);
          if (meta) {
            meta = { ...meta, indexedPages: next };
            await db.writeMeta(meta);
          }
        },
      });
    } catch (err) {
      console.warn('[Guide] Indexing stopped', err);
    } finally {
      if (indexAbort === controller) {
        indexAbort = null;
        indexing.value = false;
      }
    }
  }

  const indexComplete = (): boolean => pageCount.value > 0 && indexedPages.value >= pageCount.value;

  function search(query: string): SearchHit[] {
    return searchPages(folded, texts, query);
  }

  function pageText(page: number): GuidePageText | null {
    return texts.get(page) ?? null;
  }

  // ─── Quests ───────────────────────────────────────────────────────────

  function bookmarkTargets(quest: GuideQuest): GuideTargetRef[] {
    return matchBookmarks(quest, outline.value, pageCount.value).map((m) => ({ page: m.page, title: m.title }));
  }

  const MISC_SECTION = fold('miscellaneous objectives');

  /**
   * Where the guide covers a quest. `withText` also searches the OCR text
   * (slower; for the selected quest only). Reactive: re-run on changes.
   */
  function matchFor(quest: GuideQuest, withText = false): QuestGuideMatch | null {
    // Dependencies for callers' computed().
    void matchVersion.value;
    const linked = links.value[questKeyOf(quest)];
    if (!outline.value.length && linked === undefined) return null;

    const key = `${withText ? 't' : 'b'}|${questKeyOf(quest)}|${quest.name}`;
    let base = matchCache.get(key);
    if (base === undefined) {
      base = computeMatch(quest, withText);
      matchCache.set(key, base);
    }
    if (linked === undefined) return base;
    const alternatives = base ? [{ page: base.page, title: base.title }, ...base.alternatives].filter((a) => a.page !== linked) : [];
    return { source: 'link', page: linked, title: sectionTitle(linked), alternatives };
  }

  function computeMatch(quest: GuideQuest, withText: boolean): QuestGuideMatch | null {
    const bookmarks = bookmarkTargets(quest);
    const [first, ...rest] = bookmarks;
    if (first) return { source: 'bookmark', page: first.page, title: first.title, alternatives: rest };
    if (withText && folded.length) {
      const found = matchText(quest, folded, outline.value, pageCount.value);
      const [best, ...others] = found;
      if (best) {
        return {
          source: 'text',
          page: best.page,
          title: sectionTitle(best.page),
          alternatives: others.slice(0, 4).map((m) => ({ page: m.page, title: sectionTitle(m.page) })),
        };
      }
    }
    if (quest.isMisc) {
      const misc = outline.value.find((e) => e.page >= 0 && fold(e.title).includes(MISC_SECTION));
      if (misc) return { source: 'section', page: misc.page, title: misc.title, alternatives: [] };
    }
    return null;
  }

  /** Links a guide page to a quest (by quest key); replaces any link. */
  async function linkKey(questKey: string, page: number): Promise<void> {
    if (!fp.value) return;
    links.value = { ...links.value, [questKey]: page };
    await db.putLink({ fp: fp.value, questKey, page, createdAt: Date.now() });
  }

  async function unlinkKey(questKey: string): Promise<void> {
    if (!fp.value) return;
    const next = { ...links.value };
    delete next[questKey];
    links.value = next;
    await db.deleteLink(fp.value, questKey);
  }

  const linkQuest = (quest: GuideQuest, page: number) => linkKey(questKeyOf(quest), page);
  const unlinkQuest = (quest: GuideQuest) => unlinkKey(questKeyOf(quest));

  // ─── Sections ─────────────────────────────────────────────────────────

  /** Deepest bookmark title covering the page ("p. 12" if none). */
  function sectionTitle(page: number): string {
    const i = sectionAt(outline.value, page);
    return outline.value[i]?.title ?? `p. ${page + 1}`;
  }

  /** Bookmark path covering the page, top level first. */
  function sectionPath(page: number): string[] {
    const i = sectionAt(outline.value, page);
    return i >= 0 ? outlinePath(outline.value, i) : [];
  }

  // ─── Annotations ──────────────────────────────────────────────────────

  async function saveAnnotation(input: GuideAnnotation): Promise<GuideAnnotation> {
    // Plain copy: reactive proxies (the rect array) cannot be cloned into IndexedDB.
    const a: GuideAnnotation = input.kind === 'highlight' ? { ...input, rect: [...input.rect] } : { ...input };
    const id = await db.putAnnotation(a);
    const saved = { ...a, id };
    const rest = annotations.value.filter((x) => x.id !== id);
    annotations.value = [...rest, saved];
    return saved;
  }

  function addBookmark(page: number, label: string): Promise<GuideAnnotation> | null {
    if (!fp.value) return null;
    const bookmark: GuideBookmark = { kind: 'bookmark', fp: fp.value, page, label, note: '', createdAt: Date.now() };
    return saveAnnotation(bookmark);
  }

  function addHighlight(page: number, rect: GuideHighlight['rect'], color: HighlightColor): Promise<GuideAnnotation> | null {
    if (!fp.value) return null;
    const highlight: GuideHighlight = { kind: 'highlight', fp: fp.value, page, rect, color, note: '', createdAt: Date.now() };
    return saveAnnotation(highlight);
  }

  function updateAnnotation(a: GuideAnnotation): Promise<GuideAnnotation> {
    return saveAnnotation(a);
  }

  async function removeAnnotation(id: number): Promise<void> {
    annotations.value = annotations.value.filter((a) => a.id !== id);
    await db.deleteAnnotation(id);
  }

  // ─── Reader ───────────────────────────────────────────────────────────

  function openReader(options: { page?: number; quest?: GuideQuest | null; flash?: string; search?: string } = {}): void {
    if (status.value !== 'ready') return;
    reader.page = Math.max(0, Math.min(pageCount.value - 1, options.page ?? lastPage.value));
    reader.jump++;
    reader.quest = options.quest ? { key: questKeyOf(options.quest), name: options.quest.name } : null;
    reader.flash = options.flash ?? '';
    reader.search = options.search ?? '';
    reader.open = true;
  }

  function closeReader(): void {
    reader.open = false;
    reader.needsIndex = false;
  }

  function jumpTo(page: number, flash = ''): void {
    reader.page = Math.max(0, Math.min(pageCount.value - 1, page));
    reader.flash = flash;
    reader.jump++;
  }

  /** Remembers the page being read (saved after a short pause). */
  function setLastPage(page: number): void {
    lastPage.value = page;
    if (lastPageTimer) clearTimeout(lastPageTimer);
    lastPageTimer = setTimeout(() => {
      lastPageTimer = null;
      if (meta && meta.fp === fp.value) {
        meta = { ...meta, lastPage: page };
        void db.writeMeta(meta);
      }
    }, LAST_PAGE_SAVE_DELAY_MS);
  }

  /** Index on demand (search opened): resumes or starts the indexer. */
  function requestIndex(on: boolean): void {
    reader.needsIndex = on;
    if (on && !indexComplete()) scheduleIndexer(0);
  }

  return {
    status,
    error,
    fileName,
    fileSize,
    persisted,
    fp,
    pageCount,
    outline,
    indexedPages,
    indexing,
    matchVersion,
    annotations,
    links,
    lastPage,
    reader,
    init,
    pickFile,
    removeFile,
    getDocument,
    pageSize,
    search,
    pageText,
    indexComplete,
    requestIndex,
    matchFor,
    linkKey,
    unlinkKey,
    linkQuest,
    unlinkQuest,
    sectionTitle,
    sectionPath,
    addBookmark,
    addHighlight,
    updateAnnotation,
    removeAnnotation,
    openReader,
    closeReader,
    jumpTo,
    setLastPage,
  };
});
