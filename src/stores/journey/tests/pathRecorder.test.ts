import { describe, expect, it } from 'vitest';
import { CHUNK_POINTS, MAX_STRAIGHT_RUN, PathRecorder, chunkKey, unitsToKm } from '../lib/pathRecorder';
import type { JourneySample } from '../lib/types';

function s(t: number, x: number, y: number, extra: Partial<JourneySample> = {}): JourneySample {
  return { t: t * 1000, x, y, worldspace: 'Tamriel', isInterior: false, cell: null, ...extra };
}

describe('PathRecorder', () => {
  it('folds straight movement into few points but counts full distance', () => {
    const r = new PathRecorder();
    let distance = 0;
    for (let i = 0; i <= 10; i++) distance += r.ingest(s(i, i * 200, 0)).distance;
    expect(distance).toBe(2000);
    // start + one folded end point
    expect(r.openChunk?.points).toEqual([0, 0, 2000, 0]);
  });

  it('keeps corners', () => {
    const r = new PathRecorder();
    r.ingest(s(0, 0, 0));
    r.ingest(s(1, 300, 0));
    r.ingest(s(2, 600, 0));
    r.ingest(s(3, 600, 300));
    r.ingest(s(4, 600, 600));
    expect(r.openChunk?.points).toEqual([0, 0, 600, 0, 600, 600]);
  });

  it('limits straight runs so long curves keep their shape', () => {
    const r = new PathRecorder();
    const steps = Math.ceil((MAX_STRAIGHT_RUN * 2) / 200) + 2;
    for (let i = 0; i <= steps; i++) r.ingest(s(i, i * 200, 0));
    expect((r.openChunk?.points.length ?? 0) / 2).toBeGreaterThan(2);
  });

  it('ignores standing still', () => {
    const r = new PathRecorder();
    for (let i = 0; i < 20; i++) r.ingest(s(i, 5 * (i % 2), 0));
    expect(r.openChunk?.points).toEqual([0, 0]);
  });

  it('breaks the line on fast travel and does not count its distance', () => {
    const r = new PathRecorder();
    r.ingest(s(0, 0, 0));
    r.ingest(s(1, 300, 0));
    const jump = r.ingest(s(2, 90000, 50000));
    expect(jump.distance).toBe(0);
    expect(jump.closedChunk?.points).toEqual([0, 0, 300, 0]);
    expect(r.openChunk?.segment).toBe(1);
  });

  it('closes the line indoors and starts a new one outside', () => {
    const r = new PathRecorder();
    r.ingest(s(0, 0, 0));
    r.ingest(s(1, 300, 0));
    const inside = r.ingest(s(2, 0, 0, { isInterior: true, worldspace: null, cell: 'Cave' }));
    expect(inside.closedChunk).not.toBeNull();
    expect(r.openChunk).toBeNull();
    r.ingest(s(30, 300, 0));
    expect(r.openChunk?.segment).toBe(1);
  });

  it('splits long segments into chunks that join', () => {
    const r = new PathRecorder();
    let closed = null;
    // zig-zag so no point folds away
    for (let i = 0; i < CHUNK_POINTS + 5 && !closed; i++) {
      closed = r.ingest(s(i, i * 200, i % 2 === 0 ? 0 : 300)).closedChunk;
    }
    expect(closed?.points.length).toBe(CHUNK_POINTS * 2);
    const open = r.openChunk;
    expect(open?.seq).toBe(1);
    expect(open?.points.slice(0, 2)).toEqual(closed?.points.slice(-2));
  });

  it('counts active time only without long gaps', () => {
    const r = new PathRecorder();
    r.ingest(s(0, 0, 0));
    expect(r.ingest(s(1, 0, 0)).activeMs).toBe(1000);
    expect(r.ingest(s(500, 0, 0)).activeMs).toBe(0);
  });
});

describe('helpers', () => {
  it('sorts chunk keys in order', () => {
    expect(chunkKey(1, 2, 3) < chunkKey(1, 2, 10)).toBe(true);
    expect(chunkKey(1, 2, 99) < chunkKey(1, 3, 0)).toBe(true);
  });

  it('converts units to km', () => {
    expect(unitsToKm(70000)).toBe(1);
  });
});
