/**
 * Deep Zoom (DZI) tile maths for the home-screen mini-map.
 *
 * The mini-map shows a small window of the world map around the player at a
 * fixed pyramid level, so it only ever needs the 1–4 tiles that intersect
 * that window. No viewer library is involved.
 */
import type { DziInfo } from '@/pages/map';

export interface MinimapTile {
  key: string;
  url: string;
  /** Position/size in level pixels, relative to the view's top-left corner. */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LevelGeometry {
  level: number;
  /** Level pixels per full-resolution image pixel (0 < scale <= 1). */
  scale: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
}

export function maxDziLevel(info: Pick<DziInfo, 'width' | 'height'>): number {
  return Math.ceil(Math.log2(Math.max(info.width, info.height)));
}

export function levelGeometry(info: DziInfo, level: number): LevelGeometry {
  const maxLevel = maxDziLevel(info);
  const clamped = Math.max(0, Math.min(level, maxLevel));
  const divisor = 2 ** (maxLevel - clamped);
  const width = Math.ceil(info.width / divisor);
  const height = Math.ceil(info.height / divisor);
  return {
    level: clamped,
    scale: 1 / divisor,
    width,
    height,
    cols: Math.ceil(width / info.tileSize),
    rows: Math.ceil(height / info.tileSize),
  };
}

/**
 * Tiles covering a `viewWidth × viewHeight` (level pixels) window centred on
 * `centerX, centerY` (full-resolution image pixels).
 */
export function visibleTiles(
  info: DziInfo,
  geometry: LevelGeometry,
  centerX: number,
  centerY: number,
  viewWidth: number,
  viewHeight: number,
  resolveUrl: (url: string) => string = (url) => url,
): MinimapTile[] {
  const { tileSize, overlap, format, tilesBase } = info;
  const cx = centerX * geometry.scale;
  const cy = centerY * geometry.scale;
  const viewLeft = cx - viewWidth / 2;
  const viewTop = cy - viewHeight / 2;

  const firstCol = Math.max(0, Math.floor(viewLeft / tileSize));
  const lastCol = Math.min(geometry.cols - 1, Math.floor((viewLeft + viewWidth) / tileSize));
  const firstRow = Math.max(0, Math.floor(viewTop / tileSize));
  const lastRow = Math.min(geometry.rows - 1, Math.floor((viewTop + viewHeight) / tileSize));

  const tiles: MinimapTile[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      // DZI tiles carry `overlap` extra pixels on every inner edge.
      const x0 = col * tileSize - (col > 0 ? overlap : 0);
      const y0 = row * tileSize - (row > 0 ? overlap : 0);
      const x1 = Math.min(geometry.width, (col + 1) * tileSize + (col < geometry.cols - 1 ? overlap : 0));
      const y1 = Math.min(geometry.height, (row + 1) * tileSize + (row < geometry.rows - 1 ? overlap : 0));
      const url = `${tilesBase}/${geometry.level}/${col}_${row}.${format}`;
      tiles.push({
        key: `${geometry.level}/${col}_${row}`,
        url: resolveUrl(url),
        left: x0 - viewLeft,
        top: y0 - viewTop,
        width: x1 - x0,
        height: y1 - y0,
      });
    }
  }
  return tiles;
}

/**
 * Place a point (full-resolution image px) inside the view (level px, origin
 * top-left). Points outside the view are clamped to its border, inset by
 * `margin`, and flagged so the UI can draw an "off-screen" chevron.
 */
export function placeInView(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  scale: number,
  viewWidth: number,
  viewHeight: number,
  margin: number,
): { x: number; y: number; offscreen: boolean; bearing: number } {
  const dx = (pointX - centerX) * scale;
  const dy = (pointY - centerY) * scale;
  const halfW = viewWidth / 2 - margin;
  const halfH = viewHeight / 2 - margin;
  // Screen bearing: 0 = up, clockwise, radians.
  const bearing = Math.atan2(dx, -dy);
  if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
    return { x: viewWidth / 2 + dx, y: viewHeight / 2 + dy, offscreen: false, bearing };
  }
  const k = Math.min(halfW / Math.max(Math.abs(dx), 1e-6), halfH / Math.max(Math.abs(dy), 1e-6));
  return { x: viewWidth / 2 + dx * k, y: viewHeight / 2 + dy * k, offscreen: true, bearing };
}
