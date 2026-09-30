/**
 * Level-of-detail helpers for drawing long paths on a zoomable map.
 *
 * Douglas–Peucker with an explicit stack (no recursion limits on very long
 * lines). Input and output are flat [x0, y0, x1, y1, …] arrays.
 */
import { distanceToSegment } from './pathRecorder';

export function simplifyFlat(points: ArrayLike<number>, tolerance: number): number[] {
  const n = points.length >> 1;
  if (n <= 2 || tolerance <= 0) return Array.from(points);

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];

  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) break;
    const [first, last] = range;
    const ax = points[first * 2];
    const ay = points[first * 2 + 1];
    const bx = points[last * 2];
    const by = points[last * 2 + 1];
    let maxDist = -1;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegment(points[i * 2], points[i * 2 + 1], ax, ay, bx, by);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index >= 0 && maxDist > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) out.push(points[i * 2], points[i * 2 + 1]);
  }
  return out;
}

/**
 * Detail levels, in image pixels. The map picks the coarsest level whose
 * tolerance is still under about half a screen pixel.
 */
export const LOD_TOLERANCES = [0.25, 1, 4, 16] as const;

export function pickLod(imagePxPerScreenPx: number): number {
  const allowed = imagePxPerScreenPx * 0.6;
  let pick = 0;
  for (let i = 0; i < LOD_TOLERANCES.length; i++) {
    if (LOD_TOLERANCES[i] <= allowed) pick = i;
  }
  return pick;
}

/** SVG path data for a list of flat polylines ("M x y L x y …"). */
export function toPathData(lines: ReadonlyArray<ArrayLike<number>>): string {
  const parts: string[] = [];
  for (const line of lines) {
    if (line.length < 4) continue;
    parts.push(`M${line[0].toFixed(1)} ${line[1].toFixed(1)}`);
    for (let i = 2; i < line.length; i += 2) {
      parts.push(`L${line[i].toFixed(1)} ${line[i + 1].toFixed(1)}`);
    }
  }
  return parts.join('');
}
