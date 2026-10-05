import { describe, it, expect } from 'vitest';
import { fold, foldText, fuzzyFind, sellersFind, titleSimilarity, errorBudget } from '../ocrText';

describe('fold', () => {
  it('merges OCR look-alikes and drops punctuation', () => {
    expect(fold('SELE(TING')).toBe(fold('Selecting'));
    expect(fold('Ro(k Mine')).toBe(fold('Rock Mine'));
    expect(fold('Dmgon Risimg')).toBe('dmgonrisimg');
    expect(fold("Alduin's Wall!")).toBe('aiduinswaii');
    expect(fold('TRAIN!NG')).toBe(fold('Training'));
    expect(fold('Hail Sithis!')).toBe(fold('HAIL SITHIS'));
    expect(fold('Thorn')).toBe(fold('Thom'));
  });

  it('keeps a map back to the source string', () => {
    const f = foldText('a, B!c');
    expect(f.text).toBe('abic');
    expect(Array.from(f.source)).toEqual([0, 3, 4, 5]);
  });
});

describe('fuzzyFind', () => {
  it('finds exact and misspelled occurrences', () => {
    const text = fold('Complete Main Quest: Dragon Risimg, then The Horn of Jurgen Windculler');
    expect(fuzzyFind(text, fold('Dragon Rising'))).toHaveLength(1);
    expect(fuzzyFind(text, fold('The Horn of Jurgen Windcaller'))).toHaveLength(1);
    expect(fuzzyFind(text, fold('Bleak Falls Barrow'))).toHaveLength(0);
  });

  it('uses no errors for short patterns', () => {
    expect(errorBudget(5)).toBe(0);
    expect(fuzzyFind('abcdeabcxe', 'abcde')).toEqual([{ start: 0, end: 5, errors: 0 }]);
  });

  it('bit-parallel search agrees with the DP search', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const word = (n: number) => Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(rnd() * 4))).join('');
    for (let t = 0; t < 300; t++) {
      const pattern = word(6 + Math.floor(rnd() * 27));
      const text = word(200);
      const k = Math.floor(rnd() * 4);
      expect(fuzzyFind(text, pattern, k)).toEqual(sellersFind(text, pattern, k));
    }
  });
});

describe('titleSimilarity', () => {
  it('scores near-identical titles high', () => {
    expect(titleSimilarity('abc', 'abc')).toBe(1);
    expect(titleSimilarity(fold('With Friends Like These...'), fold('With Friends Like These'))).toBe(1);
    expect(titleSimilarity(fold('The Jagged Crown'), fold('The Golden Claw'))).toBeLessThan(0.6);
  });
});
