import { describe, it, expect } from 'vitest';
import { BOX_STRIDE, BOX_UNIT, foldPage, rectsForQuery, searchPages } from '../pageText';
import { QUEST_HEADER, page } from './fixtures';

describe('buildPageText', () => {
  it('joins runs and keeps one box per run, y from the top', () => {
    const p = page(3, ['First line', 'Second line'], 'FOOTER');
    expect(p.text).toBe('First line\nSecond line\nFOOTER\n');
    expect(p.boxes.length).toBe(3 * BOX_STRIDE);
    // First run: starts at 0, 10 letters, near the top of the page.
    expect(Array.from(p.boxes.slice(0, 2))).toEqual([0, 10]);
    expect(p.boxes[3]).toBeLessThan(BOX_UNIT * 0.2);
    // Footer run sits in the bottom band.
    expect(p.boxes[2 * BOX_STRIDE + 3]).toBeGreaterThan(BOX_UNIT * 0.9);
  });
});

describe('foldPage', () => {
  it('separates the running footer and spots walkthrough openings', () => {
    const f = foldPage(page(1, QUEST_HEADER, 'BLEAK FALLS BARROW'));
    expect(f.footer).toBe('bieakfaiisbarrow');
    expect(f.questStart).toBe(true);
    expect(foldPage(page(2, ['PREREQUISITES: None'])).questStart).toBe(false);
  });
});

describe('search', () => {
  const texts = [page(0, ['Retrieve the Golden Claw from Arvel.']), page(1, ['The Go1den (law opens the door.'])];
  const folded = texts.map(foldPage);
  const map = new Map(texts.map((t) => [t.page, t]));

  it('finds OCR-damaged matches with snippets and boxes', () => {
    const hits = searchPages(folded, map, 'golden claw');
    expect(hits.map((h) => h.page)).toEqual([0, 1]);
    expect(hits[0]?.match).toBe('Golden Claw');
    expect(hits[0]?.before).toBe('Retrieve the ');
    expect(hits[1]?.match).toBe('Go1den (law');
    expect(hits[0]?.rects.length).toBe(1);
  });

  it('ignores queries shorter than three letters', () => {
    expect(searchPages(folded, map, 'go')).toEqual([]);
  });

  it('returns page-fraction rects for a query', () => {
    const rects = rectsForQuery(texts[0], 'Golden Claw');
    expect(rects).toHaveLength(1);
    expect(rects[0]?.every((v) => v >= 0 && v <= 1)).toBe(true);
  });
});
