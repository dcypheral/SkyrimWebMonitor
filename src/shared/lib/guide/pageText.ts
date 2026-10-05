/**
 * Per-page text index of the guide: the OCR text of each page plus the box
 * of every text run, so search hits can be outlined on the page.
 */
import { fuzzyFind, errorBudget, fold, foldText, type FoldedText } from './ocrText';

/** Box units: 1/10000 of the page width or height, y from the top. */
export const BOX_UNIT = 10000;
/** Fields per text run in `boxes`: start, length, x, y, w, h. */
export const BOX_STRIDE = 6;
/** Running footer band (quest names, chapter tabs), as a share of height. */
const FOOTER_BAND = 0.075;

export interface GuidePageText {
  /** 0-based page index. */
  page: number;
  text: string;
  /** start, length, x, y, w, h per text run (see BOX_UNIT). */
  boxes: Uint16Array;
}

/** Shape of a pdf.js text item (only the fields used here). */
export interface RawTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

const clampUnit = (v: number): number => Math.max(0, Math.min(BOX_UNIT, Math.round(v * BOX_UNIT)));

export function buildPageText(page: number, items: readonly RawTextItem[], width: number, height: number): GuidePageText {
  let text = '';
  const boxes: number[] = [];
  for (const item of items) {
    const str = item.str;
    if (str.trim()) {
      const x = item.transform[4] ?? 0;
      const y = item.transform[5] ?? 0;
      const h = Math.max(item.height, 1);
      boxes.push(
        Math.min(text.length, 0xffff),
        Math.min(str.length, 0xffff),
        clampUnit(x / width),
        clampUnit((height - y - h) / height),
        clampUnit(item.width / width),
        clampUnit(h / height),
      );
      text += str;
    }
    text += item.hasEOL ? '\n' : ' ';
  }
  return { page, text, boxes: Uint16Array.from(boxes) };
}

export interface FoldedPage {
  page: number;
  body: FoldedText;
  /** Folded text of the running footer band. */
  footer: string;
  /** Page opens a walkthrough (PREREQUISITES, LOCATIONS, ENEMIES… block). */
  questStart: boolean;
}

/**
 * Labels of the block that opens each walkthrough. The OCR loses some of
 * them, so two of the six are enough.
 */
const QUEST_HEADER_LABELS = ['prerequisites', 'spoilers', 'intersecting', 'locations', 'enemies', 'characters'].map(fold);

function isQuestStart(text: string): boolean {
  let found = 0;
  for (const label of QUEST_HEADER_LABELS) {
    if (fuzzyFind(text, label, 1).length && ++found >= 2) return true;
  }
  return false;
}

export function foldPage(p: GuidePageText): FoldedPage {
  let footerText = '';
  for (let i = 0; i + BOX_STRIDE <= p.boxes.length; i += BOX_STRIDE) {
    const top = p.boxes[i + 3] ?? 0;
    if (top >= BOX_UNIT * (1 - FOOTER_BAND)) {
      const start = p.boxes[i] ?? 0;
      footerText += `${p.text.slice(start, start + (p.boxes[i + 1] ?? 0))} `;
    }
  }
  const body = foldText(p.text);
  return {
    page: p.page,
    body,
    footer: fold(footerText),
    questStart: isQuestStart(body.text),
  };
}

export interface SearchHit {
  page: number;
  /** Text around the hit, with the hit itself between `before` and `after`. */
  before: string;
  match: string;
  after: string;
  /** Boxes (x, y, w, h in BOX_UNIT) of the text runs the hit covers. */
  rects: Array<[number, number, number, number]>;
  errors: number;
}

const SNIPPET = 48;

/** Search over the folded page text. Queries under 3 letters return nothing. */
export function searchPages(
  pages: readonly FoldedPage[],
  texts: ReadonlyMap<number, GuidePageText>,
  query: string,
  limit = 200,
): SearchHit[] {
  const pattern = fold(query);
  if (pattern.length < 3) return [];
  const budget = errorBudget(pattern.length);
  const hits: SearchHit[] = [];
  for (const fp of pages) {
    const pt = texts.get(fp.page);
    if (!pt) continue;
    for (const h of fuzzyFind(fp.body.text, pattern, budget)) {
      const from = fp.body.source[h.start] ?? 0;
      const to = (fp.body.source[Math.max(h.start, h.end - 1)] ?? from) + 1;
      hits.push({
        page: fp.page,
        before: pt.text.slice(Math.max(0, from - SNIPPET), from).replace(/\s+/g, ' ').trimStart(),
        match: pt.text.slice(from, to).replace(/\s+/g, ' '),
        after: pt.text.slice(to, to + SNIPPET).replace(/\s+/g, ' ').trimEnd(),
        rects: rectsForRange(pt, from, to),
        errors: h.errors,
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

/** Boxes of the text runs overlapping [from, to) of the page text. */
export function rectsForRange(p: GuidePageText, from: number, to: number): Array<[number, number, number, number]> {
  const rects: Array<[number, number, number, number]> = [];
  for (let i = 0; i + BOX_STRIDE <= p.boxes.length; i += BOX_STRIDE) {
    const start = p.boxes[i] ?? 0;
    const end = start + (p.boxes[i + 1] ?? 0);
    if (end <= from || start >= to) continue;
    rects.push([p.boxes[i + 2] ?? 0, p.boxes[i + 3] ?? 0, p.boxes[i + 4] ?? 0, p.boxes[i + 5] ?? 0]);
  }
  return rects;
}

/** Boxes (page fractions) of every place on the page where `query` occurs. */
export function rectsForQuery(p: GuidePageText, query: string): Array<[number, number, number, number]> {
  const pattern = fold(query);
  if (pattern.length < 3) return [];
  const body = foldText(p.text);
  const rects: Array<[number, number, number, number]> = [];
  for (const h of fuzzyFind(body.text, pattern, errorBudget(pattern.length))) {
    const from = body.source[h.start] ?? 0;
    const to = (body.source[Math.max(h.start, h.end - 1)] ?? from) + 1;
    for (const r of rectsForRange(p, from, to)) {
      rects.push([r[0] / BOX_UNIT, r[1] / BOX_UNIT, r[2] / BOX_UNIT, r[3] / BOX_UNIT]);
    }
  }
  return rects;
}
