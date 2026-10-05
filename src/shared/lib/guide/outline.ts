/**
 * The guide's bookmarks (PDF outline), flattened in document order.
 */
import { fold } from './ocrText';

export interface GuideOutlineEntry {
  title: string;
  /** 0-based page index, or -1 when the bookmark has no usable target. */
  page: number;
  depth: number;
  /** Index of the parent entry, -1 for top level. */
  parent: number;
}

/** pdf.js outline node (only the fields used here). */
export interface RawOutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items?: RawOutlineNode[];
}

/**
 * Flattens a pdf.js outline. `resolvePage` turns a destination into a page
 * index (named destinations are looked up by the caller).
 */
export async function flattenOutline(
  nodes: readonly RawOutlineNode[],
  resolvePage: (dest: RawOutlineNode['dest']) => Promise<number>,
): Promise<GuideOutlineEntry[]> {
  const out: GuideOutlineEntry[] = [];
  const walk = async (list: readonly RawOutlineNode[], depth: number, parent: number): Promise<void> => {
    for (const node of list) {
      let page = -1;
      try {
        page = await resolvePage(node.dest);
      } catch {
        page = -1;
      }
      out.push({ title: node.title.trim(), page, depth, parent });
      if (node.items?.length) await walk(node.items, depth + 1, out.length - 1);
    }
  };
  await walk(nodes, 0, -1);
  return out;
}

/** Titles from the top-level entry down to `index`. */
export function outlinePath(outline: readonly GuideOutlineEntry[], index: number): string[] {
  const path: string[] = [];
  for (let i = index; i >= 0; i = outline[i]?.parent ?? -1) {
    const entry = outline[i];
    if (!entry) break;
    path.unshift(entry.title);
  }
  return path;
}

/** Deepest bookmark that starts on or before `page` (-1 if none). */
export function sectionAt(outline: readonly GuideOutlineEntry[], page: number): number {
  let best = -1;
  for (let i = 0; i < outline.length; i++) {
    const entry = outline[i];
    if (!entry || entry.page < 0 || entry.page > page) continue;
    const current = outline[best];
    if (!current || entry.page > current.page || (entry.page === current.page && entry.depth >= current.depth)) best = i;
  }
  return best;
}

export type QuestChapter = 'base' | 'dawnguard' | 'dragonborn';

// Folded like the titles they are compared with ("dragonborn" folds to "dragonbom").
const QUEST = fold('quest');
const DAWNGUARD = fold('dawnguard');
const DRAGONBORN = fold('dragonborn');

export interface ChapterRange {
  chapter: QuestChapter;
  /** First page (inclusive) and end page (exclusive). */
  from: number;
  to: number;
}

/**
 * Page ranges of the quest chapters: top-level bookmarks whose title
 * mentions quests ("Quests", "Dawnguard Quests", "Dragonborn Quests").
 */
export function questChapters(outline: readonly GuideOutlineEntry[], pageCount: number): ChapterRange[] {
  const top = outline.filter((e) => e.depth === 0 && e.page >= 0);
  const ranges: ChapterRange[] = [];
  top.forEach((entry, i) => {
    const title = fold(entry.title);
    if (!title.includes(QUEST)) return;
    const next = top.slice(i + 1).find((e) => e.page > entry.page);
    const chapter: QuestChapter = title.includes(DAWNGUARD) ? 'dawnguard' : title.includes(DRAGONBORN) ? 'dragonborn' : 'base';
    ranges.push({ chapter, from: entry.page, to: next ? next.page : pageCount });
  });
  return ranges;
}

/** Chapter a quest of this game quest type is written up in. */
export function chapterForQuestType(questType: string): QuestChapter {
  if (questType.startsWith('DLC01')) return 'dawnguard';
  if (questType.startsWith('DLC02')) return 'dragonborn';
  return 'base';
}
