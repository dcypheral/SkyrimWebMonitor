/**
 * Finds a quest's walkthrough in the guide.
 *
 * 1. Bookmarks: most quests have their own bookmark under a quest chapter.
 *    Titles are compared after folding, with prefixes like "Imperial:" and
 *    "Act I:" removed.
 * 2. Text: quests without a bookmark are searched in the OCR text of the
 *    quest chapters. The guide prints the quest name in the running footer
 *    of the walkthrough pages and opens each walkthrough with a
 *    "PREREQUISITES" block; both count towards a page's score.
 */
import { errorBudget, fold, fuzzyFind, titleSimilarity } from './ocrText';
import { chapterForQuestType, questChapters, type ChapterRange, type GuideOutlineEntry, type QuestChapter } from './outline';
import type { FoldedPage } from './pageText';

export interface QuestRef {
  name: string;
  questType: string;
}

export interface GuideTarget {
  page: number;
  title: string;
}

export interface BookmarkMatch extends GuideTarget {
  outlineIndex: number;
  similarity: number;
}

const TITLE_PREFIX = /^(imperial|stormcloak|leadership quest|act [ivx]+)\s*:\s*/i;
/** Lowest folded-title similarity accepted as the same quest. */
const MIN_TITLE_SIMILARITY = 0.86;

function chapterOf(page: number, chapters: readonly ChapterRange[]): QuestChapter | null {
  return chapters.find((c) => page >= c.from && page < c.to)?.chapter ?? null;
}

/**
 * Bookmarks that name this quest, best first. Several results mean the
 * guide covers the quest more than once (Imperial and Stormcloak sides).
 */
export function matchBookmarks(
  quest: QuestRef,
  outline: readonly GuideOutlineEntry[],
  pageCount: number,
): BookmarkMatch[] {
  const name = fold(quest.name);
  if (!name) return [];
  const chapters = questChapters(outline, pageCount);
  const preferred = chapterForQuestType(quest.questType);
  const shortName = name.length < 8;

  const found: Array<BookmarkMatch & { preferred: boolean }> = [];
  outline.forEach((entry, index) => {
    if (entry.depth < 1 || entry.page < 0) return;
    const chapter = chapterOf(entry.page, chapters);
    if (!chapter) return;
    const full = fold(entry.title);
    const stripped = fold(entry.title.replace(TITLE_PREFIX, ''));
    const similarity = Math.max(titleSimilarity(name, full), titleSimilarity(name, stripped));
    if (shortName ? similarity < 1 : similarity < MIN_TITLE_SIMILARITY) return;
    found.push({ page: entry.page, title: entry.title, outlineIndex: index, similarity, preferred: chapter === preferred });
  });

  found.sort((a, b) => b.similarity - a.similarity || Number(b.preferred) - Number(a.preferred) || a.page - b.page);
  const best = found[0];
  if (!best) return [];
  return found
    .filter((m) => m.similarity >= best.similarity - 0.02)
    .map(({ preferred: _preferred, ...m }) => m);
}

export interface TextMatch {
  page: number;
  score: number;
  /** Footer pages (or body pages without a footer hit) behind the match. */
  pages: number[];
}

/** Footer pages further apart than this start a new run (spreads are 2 pages). */
const RUN_GAP = 2;
/** How far back a quest that continues onto a spread may have started. */
const LOOK_BACK = 4;

/** Tab labels printed in every footer next to the quest names. */
const FOOTER_LABELS = ['training', 'the inventory', 'the bestiary', 'quests', 'atlas of skyrim', 'appendices and index', 'overview', 'available quests'].map(fold);

/** The footer with its tab labels removed: just the quest names, in order. */
function footerNames(footer: string): string {
  let out = footer;
  for (const label of FOOTER_LABELS) {
    const hits = fuzzyFind(out, label, errorBudget(label.length));
    for (const h of hits.reverse()) out = out.slice(0, h.start) + out.slice(h.end);
  }
  return out;
}

/**
 * Pages that start this quest's walkthrough, best first.
 *
 * The guide is laid out in two-page spreads, and the right-hand page's
 * footer lists the quests on the spread in order. The first footer that
 * names the quest marks its first spread; within it, the walkthrough starts
 * on a page with a "PREREQUISITES" block. A quest listed first may instead
 * continue from an earlier spread whose footer the OCR lost.
 */
export function matchText(
  quest: QuestRef,
  pages: readonly FoldedPage[],
  outline: readonly GuideOutlineEntry[],
  pageCount: number,
): TextMatch[] {
  const pattern = fold(quest.name);
  if (pattern.length < 4) return [];
  const budget = errorBudget(pattern.length);
  const chapters = questChapters(outline, pageCount);
  const preferred = chapterForQuestType(quest.questType);
  const inChapters = (page: number) => chapters.length === 0 || chapterOf(page, chapters) !== null;

  const byPage = new Map<number, FoldedPage>();
  const footerHits: number[] = [];
  const bodyHits = new Map<number, number>();
  for (const p of pages) {
    byPage.set(p.page, p);
    if (!inChapters(p.page)) continue;
    const body = fuzzyFind(p.body.text, pattern, budget).length;
    if (body) bodyHits.set(p.page, body);
    if (fuzzyFind(p.footer, pattern, budget).length) footerHits.push(p.page);
  }
  footerHits.sort((a, b) => a - b);
  const startsQuest = (page: number) => byPage.get(page)?.questStart === true;

  const runs: number[][] = [];
  for (const page of footerHits) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (run && last !== undefined && page - last <= RUN_GAP) run.push(page);
    else runs.push([page]);
  }

  const results: TextMatch[] = [];
  for (const run of runs) {
    const f = run[0];
    if (f === undefined) continue;
    const names = footerNames(byPage.get(f)?.footer ?? '');
    const listedFirst = (fuzzyFind(names, pattern, budget)[0]?.start ?? 0) <= 3;
    const left = f - 1;
    let start: number | null = null;
    if (!listedFirst) {
      start = startsQuest(f) ? f : left;
    } else if (startsQuest(left)) {
      start = left;
    } else {
      // Listed first without an opening on the spread: the walkthrough
      // began on an earlier page whose footer the OCR lost.
      for (let p = left - 1; p >= left - LOOK_BACK; p--) {
        if (startsQuest(p)) {
          start = p;
          break;
        }
      }
      start ??= left;
    }
    let score = 4 * run.length + Math.min(3, bodyHits.get(start) ?? 0);
    if (startsQuest(start)) score += 3;
    if (chapterOf(start, chapters) === preferred) score += 1;
    results.push({ page: start, score, pages: run });
  }

  // No footer names the quest: fall back to pages that mention it, weakly.
  if (!results.length) {
    for (const [page, count] of bodyHits) {
      results.push({ page, score: Math.min(count, 3) + (startsQuest(page) ? 1 : 0), pages: [page] });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.page - b.page).slice(0, 6);
}
