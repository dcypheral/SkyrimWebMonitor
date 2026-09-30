/**
 * Turns a stream of position samples into compact path segments.
 *
 * Long-term cost is the main concern: a player can log hundreds of hours.
 * The recorder therefore
 *  - ignores movement under MIN_STEP (standing, turning on the spot),
 *  - folds a new point into the previous one while the path stays straight
 *    (the dropped point lies within STRAIGHT_TOLERANCE of the new line and
 *    the straight run is shorter than MAX_STRAIGHT_RUN),
 *  - breaks the line on fast travel, load doors, interiors and long gaps.
 * Walking along a road costs a point every few seconds at most; a straight
 * horse ride costs one point per MAX_STRAIGHT_RUN.
 */
import type { JourneySample } from './types';

/** World units. 70 units ≈ 1 m. */
export const MIN_STEP = 140;
export const STRAIGHT_TOLERANCE = 45;
export const MAX_STRAIGHT_RUN = 2800;
/** Faster than this between two samples = teleport (fast travel, load door). */
export const TELEPORT_SPEED = 3500; // units per second (a galloping horse is ≈ 1000)
/** A jump this long is a teleport whatever the time between samples. */
export const TELEPORT_DISTANCE = 12000;
/** No samples for this long = start a new segment. */
export const SEGMENT_GAP_MS = 60_000;
/** Movement under this between samples is jitter, not distance. */
export const JITTER = 8;
/** Points per stored chunk. */
export const CHUNK_POINTS = 256;

export interface OpenSegment {
  segment: number;
  worldspace: string;
  /** Chunk index within the segment. */
  seq: number;
  /** Flat [x, y, …] for the chunk being filled. */
  points: number[];
}

export interface IngestResult {
  /** Distance to add to the session (world units). */
  distance: number;
  /** Time to add to the session's active time (ms). */
  activeMs: number;
  /** A chunk that is complete and will not change again. */
  closedChunk: OpenSegment | null;
  /** The open chunk changed (needs a save at the next flush). */
  changed: boolean;
}

export class PathRecorder {
  private open: OpenSegment | null = null;
  private last: JourneySample | null = null;
  private nextSegment: number;

  constructor(firstSegment = 0) {
    this.nextSegment = firstSegment;
  }

  get openChunk(): OpenSegment | null {
    return this.open;
  }

  /** Ends the current segment (e.g. session end); returns it if it has points. */
  closeSegment(): OpenSegment | null {
    const closed = this.open && this.open.points.length >= 4 ? this.open : null;
    this.open = null;
    return closed;
  }

  ingest(sample: JourneySample): IngestResult {
    const result: IngestResult = { distance: 0, activeMs: 0, closedChunk: null, changed: false };
    const prev = this.last;
    this.last = sample;

    if (prev) {
      const dt = sample.t - prev.t;
      if (dt > 0 && dt < SEGMENT_GAP_MS) result.activeMs = dt;
    }

    // No map position: close the line; nothing to draw indoors.
    if (sample.isInterior || !sample.worldspace) {
      result.closedChunk = this.closeSegment();
      return result;
    }

    let breakLine = !prev || prev.isInterior || prev.worldspace !== sample.worldspace;
    if (prev && !breakLine) {
      const dt = sample.t - prev.t;
      const d = Math.hypot(sample.x - prev.x, sample.y - prev.y);
      const speed = dt > 0 ? (d * 1000) / dt : Infinity;
      if (dt > SEGMENT_GAP_MS || d > TELEPORT_DISTANCE || speed > TELEPORT_SPEED) {
        breakLine = true;
      } else if (d > JITTER) {
        result.distance = d;
      }
    }

    if (breakLine) {
      result.closedChunk = this.closeSegment();
      this.open = {
        segment: this.nextSegment++,
        worldspace: sample.worldspace,
        seq: 0,
        points: [Math.round(sample.x), Math.round(sample.y)],
      };
      result.changed = true;
      return result;
    }

    const open = this.open;
    if (!open) return result;
    const x = Math.round(sample.x);
    const y = Math.round(sample.y);
    const pts = open.points;
    const n = pts.length;
    const lx = pts[n - 2];
    const ly = pts[n - 1];
    if (Math.hypot(x - lx, y - ly) < MIN_STEP) return result;

    // Fold the last point away while the path is straight.
    if (n >= 4) {
      const px = pts[n - 4];
      const py = pts[n - 3];
      const run = Math.hypot(x - px, y - py);
      if (run < MAX_STRAIGHT_RUN && distanceToSegment(lx, ly, px, py, x, y) < STRAIGHT_TOLERANCE) {
        pts[n - 2] = x;
        pts[n - 1] = y;
        result.changed = true;
        return result;
      }
    }

    pts.push(x, y);
    result.changed = true;

    if (pts.length >= CHUNK_POINTS * 2) {
      // Close this chunk; the next one starts at its last point so the line
      // stays continuous when chunks are drawn one after another.
      result.closedChunk = { ...open, points: pts.slice() };
      this.open = { segment: open.segment, worldspace: open.worldspace, seq: open.seq + 1, points: [x, y] };
    }
    return result;
  }
}

export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function chunkKey(sessionId: number, segment: number, seq: number): string {
  return `${String(sessionId).padStart(14, '0')}:${String(segment).padStart(6, '0')}:${String(seq).padStart(6, '0')}`;
}

/** 70 world units per metre. */
export function unitsToKm(units: number): number {
  return units / 70 / 1000;
}
