import type { GuideOutlineEntry } from '../outline';
import { buildPageText, type GuidePageText, type RawTextItem } from '../pageText';

/** Builds a flat outline from [depth, title, page] rows. */
export function outlineOf(rows: Array<[number, string, number]>): GuideOutlineEntry[] {
  const parents: number[] = [];
  return rows.map(([depth, title, page], i) => {
    parents[depth] = i;
    return { title, page, depth, parent: depth > 0 ? parents[depth - 1] ?? -1 : -1 };
  });
}

/** A small guide: three chapters, quest chapters with a few bookmarks. */
export const OUTLINE = outlineOf([
  [0, 'Training', 0],
  [0, 'Quests', 10],
  [1, 'Main Quest', 10],
  [2, 'Act I: Unbound', 11],
  [2, 'Bleak Falls Barrow', 13],
  [1, 'Civil War Quests', 20],
  [2, 'Imperial: The Jagged Crown', 21],
  [2, 'Stormcloak: The Jagged Crown', 24],
  [1, 'Miscellaneous Objectives', 28],
  [0, 'Dragonborn Quests', 30],
  [1, 'Dragonborn Main Quest', 30],
  [2, 'Dragonborn', 31],
  [1, 'Solstheim Side Quests', 33],
  [0, 'The Atlas of Skyrim', 40],
]);

export const PAGE_COUNT = 50;
const W = 500;
const H = 700;

/** A page with body lines at the top and an optional running footer. */
export function page(index: number, body: string[], footer = ''): GuidePageText {
  const items: RawTextItem[] = body.map((str, i) => ({ str, transform: [1, 0, 0, 1, 40, H - 60 - i * 14], width: 300, height: 10, hasEOL: true }));
  if (footer) items.push({ str: footer, transform: [1, 0, 0, 1, 40, 20], width: 400, height: 8, hasEOL: true });
  return buildPageText(index, items, W, H);
}

export const QUEST_HEADER = ['PREREQUISITES: None', 'LOCATIONS: Somewhere', 'ENEMIES: Draugr'];
