import { describe, it, expect } from 'vitest';
import { levelGeometry, maxDziLevel, placeInView, visibleTiles } from '../lib/minimapTiles';
import type { DziInfo } from '@/pages/map';

const INFO: DziInfo = {
  width: 8192,
  height: 8192,
  tileSize: 512,
  overlap: 1,
  format: 'webp',
  tilesBase: '/map-dzi/tamriel_files',
};

describe('minimap tile maths', () => {
  it('derives pyramid levels like Deep Zoom', () => {
    expect(maxDziLevel(INFO)).toBe(13);
    const g = levelGeometry(INFO, 12);
    expect(g).toMatchObject({ level: 12, scale: 0.5, width: 4096, height: 4096, cols: 8, rows: 8 });
  });

  it('returns only the tiles that intersect the window', () => {
    const g = levelGeometry(INFO, 12);
    // Centre (1024,1024) full-res = (512,512) at level 12: the corner of 4 tiles.
    const tiles = visibleTiles(INFO, g, 1024, 1024, 200, 200);
    expect(tiles.map((t) => t.key).sort()).toEqual(['12/0_0', '12/0_1', '12/1_0', '12/1_1']);
    const inner = tiles.find((t) => t.key === '12/1_1');
    // Tile (1,1) starts 1px early because of the overlap.
    expect(inner).toMatchObject({ left: 100 - 1, top: 100 - 1, url: '/map-dzi/tamriel_files/12/1_1.webp' });
  });

  it('keeps the window inside the image at the edges', () => {
    const g = levelGeometry(INFO, 12);
    const tiles = visibleTiles(INFO, g, 0, 0, 200, 200);
    expect(tiles.map((t) => t.key)).toEqual(['12/0_0']);
  });

  it('clamps off-screen points to the border and reports the bearing', () => {
    const inside = placeInView(110, 100, 100, 100, 1, 200, 200, 10);
    expect(inside).toMatchObject({ x: 110, y: 100, offscreen: false });

    const east = placeInView(5000, 100, 100, 100, 1, 200, 200, 10);
    expect(east.offscreen).toBe(true);
    expect(east.x).toBeCloseTo(190);
    expect(east.y).toBeCloseTo(100);
    expect(east.bearing).toBeCloseTo(Math.PI / 2);
  });
});
