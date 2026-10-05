/**
 * Text helpers for scanned guides. The guide's text layer is OCR output, so
 * letters are often misread ("SELE(TING", "Bloodskcll", "Ro(k"). Matching
 * therefore works on a folded alphabet (look-alike glyphs merged, case and
 * punctuation dropped) with an edit-distance budget.
 */

/** Look-alike glyphs → one letter. Applied after lower-casing. */
const FOLD: Record<string, string> = {
  '(': 'c',
  '[': 'c',
  '{': 'c',
  '¢': 'c',
  '€': 'e',
  '!': 'i',
  '|': 'i',
  '1': 'i',
  l: 'i',
  ']': 'i',
  j: 'i',
  '0': 'o',
  '©': 'o',
  '®': 'o',
  '5': 's',
  '§': 's',
  $: 's',
  '8': 'b',
  '6': 'b',
};

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  if (ch >= 'a' && ch <= 'z') return true;
  return FOLD[ch] !== undefined;
}

export interface FoldedText {
  /** Folded letters only (a–z). */
  text: string;
  /** Index into the source string for each folded letter. */
  source: Uint32Array;
}

/**
 * Folds text for matching. `rn` → `m` and `vv` → `w` are merged too, since
 * OCR splits those letters.
 */
export function foldText(input: string): FoldedText {
  const lower = input.normalize('NFD').toLowerCase();
  const out: string[] = [];
  const source: number[] = [];
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i] ?? '';
    const code = ch.charCodeAt(0);
    // Combining diacritics left by NFD.
    if (code >= 0x300 && code <= 0x36f) continue;
    let mapped = FOLD[ch] ?? ch;
    // Punctuation counts as a misread letter only inside a word: the "!"
    // in "Hail Sithis!" is punctuation, the one in "TRAIN!NG" is an i.
    if (mapped !== ch && (ch < 'a' || ch > 'z') && !isWordChar(lower[i + 1])) mapped = '';
    if (mapped < 'a' || mapped > 'z') continue;
    const prev = out[out.length - 1];
    if ((prev === 'r' && mapped === 'n') || (prev === 'v' && mapped === 'v')) {
      out[out.length - 1] = prev === 'r' ? 'm' : 'w';
      continue;
    }
    out.push(mapped);
    source.push(i);
  }
  return { text: out.join(''), source: Uint32Array.from(source) };
}

/** Folded letters only. */
export function fold(input: string): string {
  return foldText(input).text;
}

export interface FuzzyHit {
  /** Start index in the folded text (approximate for inserts/deletes). */
  start: number;
  /** End index (exclusive) in the folded text. */
  end: number;
  errors: number;
}

/** Edit budget for a folded pattern of this length. */
export function errorBudget(length: number): number {
  if (length <= 5) return 0;
  if (length <= 9) return 1;
  return Math.floor(length * 0.16);
}

/**
 * Approximate substring search (Sellers' algorithm): every place where the
 * pattern occurs with at most `maxErrors` edits. Overlapping ends collapse
 * into the best one.
 */
export function fuzzyFind(text: string, pattern: string, maxErrors = errorBudget(pattern.length)): FuzzyHit[] {
  const m = pattern.length;
  if (m === 0 || text.length === 0) return [];
  if (maxErrors === 0) {
    const hits: FuzzyHit[] = [];
    for (let at = text.indexOf(pattern); at >= 0; at = text.indexOf(pattern, at + m)) {
      hits.push({ start: at, end: at + m, errors: 0 });
    }
    return hits;
  }

  return m <= 32 ? myersFind(text, pattern, maxErrors) : sellersFind(text, pattern, maxErrors);
}

/** Row-by-row DP version (any pattern length). Exported for tests. */
export function sellersFind(text: string, pattern: string, maxErrors: number): FuzzyHit[] {
  const m = pattern.length;
  let prev = new Uint16Array(m + 1);
  let cur = new Uint16Array(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;

  const hits: FuzzyHit[] = [];
  for (let j = 1; j <= text.length; j++) {
    const c = text.charCodeAt(j - 1);
    cur[0] = 0;
    for (let i = 1; i <= m; i++) {
      const sub = (prev[i - 1] ?? 0) + (pattern.charCodeAt(i - 1) === c ? 0 : 1);
      const del = (prev[i] ?? 0) + 1;
      const ins = (cur[i - 1] ?? 0) + 1;
      cur[i] = sub < del ? (sub < ins ? sub : ins) : del < ins ? del : ins;
    }
    const d = cur[m] ?? m;
    if (d <= maxErrors) pushHit(hits, j, d, m);
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return hits;
}

function pushHit(hits: FuzzyHit[], end: number, errors: number, m: number): void {
  const last = hits[hits.length - 1];
  if (last && end - last.end < m) {
    if (errors < last.errors) {
      last.errors = errors;
      last.end = end;
      last.start = Math.max(0, end - m);
    }
  } else {
    hits.push({ start: Math.max(0, end - m), end, errors });
  }
}

/**
 * Myers' bit-parallel version of the search above for patterns of up to 32
 * letters: one machine word per text letter instead of a DP row.
 */
function myersFind(text: string, pattern: string, maxErrors: number): FuzzyHit[] {
  const m = pattern.length;
  const peq = new Int32Array(128);
  for (let i = 0; i < m; i++) {
    const c = pattern.charCodeAt(i) & 127;
    peq[c] = (peq[c] ?? 0) | (1 << i);
  }
  const high = 1 << (m - 1);
  let pv = m === 32 ? -1 : (1 << m) - 1;
  let mv = 0;
  let score = m;
  const hits: FuzzyHit[] = [];
  for (let j = 0; j < text.length; j++) {
    const eq = peq[text.charCodeAt(j) & 127] ?? 0;
    const xv = eq | mv;
    const xh = ((((eq & pv) + pv) | 0) ^ pv) | eq;
    let ph = mv | ~(xh | pv);
    let mh = pv & xh;
    if (ph & high) score++;
    else if (mh & high) score--;
    ph <<= 1;
    mh <<= 1;
    pv = mh | ~(xv | ph);
    mv = ph & xv;
    if (score <= maxErrors) pushHit(hits, j + 1, score, m);
  }
  return hits;
}

/** Similarity of two short titles in [0, 1] (1 − normalised edit distance). */
export function titleSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const n = a.length;
  const m = b.length;
  if (!n || !m) return 0;
  let prev = new Uint16Array(m + 1);
  let cur = new Uint16Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      const sub = (prev[j - 1] ?? 0) + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1);
      cur[j] = Math.min(sub, (prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return 1 - (prev[m] ?? Math.max(n, m)) / Math.max(n, m);
}
