import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup, planMerge } from '../lib/backup';
import type { JourneyNote, JourneySession, PathChunk } from '../lib/types';

const session = (id: number, endedAt = id + 1000): JourneySession => ({
  id, startedAt: id, endedAt, activeMs: 10, distance: 5, startLevel: 3, endLevel: 4,
  events: [{ t: id, kind: 'discovery', text: 'Riverwood', detail: 'Town', worldspace: 'Tamriel', x: 1, y: 2 }],
  title: '', pointCount: 2, segments: 1,
});
const note = (id: number, updatedAt = id, hasPhoto = false): JourneyNote => ({
  id, sessionId: null, createdAt: id, updatedAt, text: `n${String(id)}`, worldspace: null, x: 0, y: 0, place: null, hasPhoto,
});
const chunk = (sessionId: number): PathChunk => ({
  key: `${String(sessionId)}:0000:0000`, sessionId, segment: 0, seq: 0, worldspace: 'Tamriel', points: Int32Array.from([1, 2, 3, 4]),
});

function roundTrip(sessions: JourneySession[], notes: JourneyNote[], chunks: PathChunk[], photos = new Map<number, string>()) {
  return parseBackup(JSON.parse(JSON.stringify(buildBackup(sessions, notes, chunks, photos, 42))));
}

describe('journey backup', () => {
  it('survives JSON round trip', () => {
    const parsed = roundTrip([session(100)], [note(7, 7, true)], [chunk(100)], new Map([[7, 'photos/a.jpg']]));
    expect(parsed.exportedAt).toBe(42);
    expect(parsed.sessions[0].events[0]).toMatchObject({ kind: 'discovery', text: 'Riverwood', x: 1 });
    expect(Array.from(parsed.chunks[0].points)).toEqual([1, 2, 3, 4]);
    expect(parsed.photos.get(7)).toBe('photos/a.jpg');
  });

  it('rejects foreign files and newer versions', () => {
    expect(() => parseBackup({ hello: 1 })).toThrow('not a journey backup');
    expect(() => parseBackup({ format: 'skyrim-monitor-journey', version: 99 })).toThrow('newer');
  });

  it('merges: adds missing, keeps newer, skips the live session and respects the note limit', () => {
    const backup = roundTrip(
      [session(1), session(2, 5000), session(3)],
      [note(10), note(11, 50), note(12)],
      [chunk(1), chunk(2), chunk(3)],
      new Map([[10, 'photos/x.jpg']]),
    );
    backup.notes[0].hasPhoto = true;
    const plan = planMerge(backup, {
      sessions: [session(2, 9000)],
      notes: [note(11, 20)],
      activeSessionId: 3,
      maxNotes: 2,
    });
    expect(plan.sessions.map((s) => s.id)).toEqual([1]);
    expect(plan.chunks.map((c) => c.sessionId)).toEqual([1]);
    expect(plan.notes.map((n) => n.id)).toEqual([10, 11]);
    expect(plan.photoNoteIds).toEqual([10]);
    expect(plan.counts).toEqual({ sessionsAdded: 1, sessionsUpdated: 0, notesAdded: 1, notesUpdated: 1, notesSkipped: 1 });
  });
});
