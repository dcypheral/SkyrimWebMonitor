import { describe, expect, it } from 'vitest';
import { LOD_TOLERANCES, pickLod, simplifyFlat, toPathData } from '../lib/simplify';

describe('simplifyFlat', () => {
  it('drops points within tolerance and keeps ends', () => {
    expect(simplifyFlat([0, 0, 5, 0.1, 10, 0], 0.5)).toEqual([0, 0, 10, 0]);
  });

  it('keeps points beyond tolerance', () => {
    expect(simplifyFlat([0, 0, 5, 3, 10, 0], 0.5)).toEqual([0, 0, 5, 3, 10, 0]);
  });

  it('handles long lines without recursion', () => {
    const pts: number[] = [];
    for (let i = 0; i < 50000; i++) pts.push(i, Math.sin(i / 50) * 10);
    const out = simplifyFlat(pts, 1);
    expect(out.length).toBeLessThan(pts.length / 10);
  });
});

describe('pickLod', () => {
  it('uses fine detail when zoomed in and coarse when zoomed out', () => {
    expect(pickLod(0.2)).toBe(0);
    expect(pickLod(40)).toBe(LOD_TOLERANCES.length - 1);
  });
});

describe('toPathData', () => {
  it('builds move/line commands and skips single points', () => {
    expect(toPathData([[0, 0, 1, 1], [5, 5]])).toBe('M0.0 0.0L1.0 1.0');
  });
});
