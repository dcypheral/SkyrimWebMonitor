/**
 * Journey backup format (inside the "Export all" zip, next to the Markdown):
 *
 *   backup/journey.json   — sessions, notes, path chunks, photo index
 *   photos/<file>         — note photos (shared with the Markdown export)
 *
 * Restoring merges into what is already on the device: nothing is deleted,
 * newer copies win, and the live session is never overwritten.
 */
import type { JourneyNote, JourneySession, PathChunk, SessionEvent } from './types';

export const BACKUP_FORMAT = 'skyrim-monitor-journey';
export const BACKUP_VERSION = 1;
export const BACKUP_JSON_PATH = 'backup/journey.json';

export interface BackupChunk {
  key: string;
  sessionId: number;
  segment: number;
  seq: number;
  worldspace: string;
  points: number[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  sessions: JourneySession[];
  notes: JourneyNote[];
  chunks: BackupChunk[];
  /** noteId → path of the photo inside the zip. */
  photos: Record<string, string>;
}

export function buildBackup(
  sessions: readonly JourneySession[],
  notes: readonly JourneyNote[],
  chunks: readonly PathChunk[],
  photoPaths: ReadonlyMap<number, string>,
  now = Date.now(),
): BackupFile {
  const photos: Record<string, string> = {};
  for (const [id, path] of photoPaths) photos[String(id)] = path;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    sessions: sessions.map((s) => ({ ...s, events: s.events.slice() })),
    notes: notes.slice(),
    chunks: chunks.map((c) => ({
      key: c.key,
      sessionId: c.sessionId,
      segment: c.segment,
      seq: c.seq,
      worldspace: c.worldspace,
      points: Array.from(c.points),
    })),
    photos,
  };
}

// ─── Validation ─────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

const EVENT_KINDS: ReadonlyArray<SessionEvent['kind']> = ['level', 'objective', 'quest', 'location', 'discovery', 'note'];

function toKind(v: unknown): SessionEvent['kind'] | null {
  return EVENT_KINDS.find((k) => k === v) ?? null;
}

function toEvent(v: unknown): SessionEvent | null {
  if (!isObj(v) || !isNum(v.t) || !isStr(v.text)) return null;
  const kind = toKind(v.kind);
  if (!kind) return null;
  const e: SessionEvent = { t: v.t, kind, text: v.text };
  if (isStr(v.detail)) e.detail = v.detail;
  if (isStr(v.worldspace)) e.worldspace = v.worldspace;
  if (isNum(v.x)) e.x = v.x;
  if (isNum(v.y)) e.y = v.y;
  return e;
}

function toSession(v: unknown): JourneySession | null {
  if (!isObj(v) || !isNum(v.id) || !isNum(v.startedAt) || !isNum(v.endedAt) || !Array.isArray(v.events)) return null;
  return {
    id: v.id,
    startedAt: v.startedAt,
    endedAt: v.endedAt,
    activeMs: isNum(v.activeMs) ? v.activeMs : 0,
    distance: isNum(v.distance) ? v.distance : 0,
    startLevel: isNum(v.startLevel) ? v.startLevel : null,
    endLevel: isNum(v.endLevel) ? v.endLevel : null,
    events: v.events.map(toEvent).filter((e): e is SessionEvent => e !== null),
    title: isStr(v.title) ? v.title : '',
    pointCount: isNum(v.pointCount) ? v.pointCount : 0,
    segments: isNum(v.segments) ? v.segments : 0,
  };
}

function toNote(v: unknown): JourneyNote | null {
  if (!isObj(v) || !isNum(v.id) || !isNum(v.createdAt) || !isStr(v.text)) return null;
  const note: JourneyNote = {
    id: v.id,
    sessionId: isNum(v.sessionId) ? v.sessionId : null,
    createdAt: v.createdAt,
    updatedAt: isNum(v.updatedAt) ? v.updatedAt : v.createdAt,
    text: v.text,
    worldspace: isStr(v.worldspace) ? v.worldspace : null,
    x: isNum(v.x) ? v.x : 0,
    y: isNum(v.y) ? v.y : 0,
    place: isStr(v.place) ? v.place : null,
    hasPhoto: v.hasPhoto === true,
  };
  if (isNum(v.photoWidth)) note.photoWidth = v.photoWidth;
  if (isNum(v.photoHeight)) note.photoHeight = v.photoHeight;
  if (v.photoSource === 'device' || v.photoSource === 'game') note.photoSource = v.photoSource;
  return note;
}

function toChunk(v: unknown): PathChunk | null {
  if (
    !isObj(v) ||
    !isStr(v.key) ||
    !isNum(v.sessionId) ||
    !isNum(v.segment) ||
    !isNum(v.seq) ||
    !isStr(v.worldspace) ||
    !Array.isArray(v.points) ||
    !v.points.every(isNum)
  ) {
    return null;
  }
  return {
    key: v.key,
    sessionId: v.sessionId,
    segment: v.segment,
    seq: v.seq,
    worldspace: v.worldspace,
    points: Int32Array.from(v.points),
  };
}

export interface ParsedBackup {
  exportedAt: number;
  sessions: JourneySession[];
  notes: JourneyNote[];
  chunks: PathChunk[];
  photos: Map<number, string>;
}

/** Throws with a short reason when the JSON is not a journey backup. */
export function parseBackup(json: unknown): ParsedBackup {
  if (!isObj(json) || json.format !== BACKUP_FORMAT) throw new Error('not a journey backup');
  if (!isNum(json.version) || json.version > BACKUP_VERSION) throw new Error('backup is from a newer app version');
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const photos = new Map<number, string>();
  if (isObj(json.photos)) {
    for (const [id, path] of Object.entries(json.photos)) {
      if (isStr(path) && Number.isFinite(Number(id))) photos.set(Number(id), path);
    }
  }
  return {
    exportedAt: isNum(json.exportedAt) ? json.exportedAt : 0,
    sessions: list(json.sessions).map(toSession).filter((s): s is JourneySession => s !== null),
    notes: list(json.notes).map(toNote).filter((n): n is JourneyNote => n !== null),
    chunks: list(json.chunks).map(toChunk).filter((c): c is PathChunk => c !== null),
    photos,
  };
}

// ─── Merge ──────────────────────────────────────────────────────────────

export interface MergePlan {
  sessions: JourneySession[];
  chunks: PathChunk[];
  notes: JourneyNote[];
  /** Notes whose photo must be written (ids). */
  photoNoteIds: number[];
  counts: { sessionsAdded: number; sessionsUpdated: number; notesAdded: number; notesUpdated: number; notesSkipped: number };
}

/**
 * Decides what to write. Sessions and notes are matched by id (their start
 * time): a missing one is added, an existing one is replaced only when the
 * backup copy is newer. The live session is left alone. New notes stop at
 * the note limit.
 */
export function planMerge(
  backup: ParsedBackup,
  existing: { sessions: readonly JourneySession[]; notes: readonly JourneyNote[]; activeSessionId: number | null; maxNotes: number },
): MergePlan {
  const sessionsById = new Map(existing.sessions.map((s) => [s.id, s]));
  const notesById = new Map(existing.notes.map((n) => [n.id, n]));
  const counts = { sessionsAdded: 0, sessionsUpdated: 0, notesAdded: 0, notesUpdated: 0, notesSkipped: 0 };

  const sessions: JourneySession[] = [];
  for (const s of backup.sessions) {
    if (s.id === existing.activeSessionId) continue;
    const current = sessionsById.get(s.id);
    if (!current) counts.sessionsAdded++;
    else if (s.endedAt > current.endedAt) counts.sessionsUpdated++;
    else continue;
    sessions.push(s);
  }
  const written = new Set(sessions.map((s) => s.id));
  const chunks = backup.chunks.filter((c) => written.has(c.sessionId));

  const notes: JourneyNote[] = [];
  const photoNoteIds: number[] = [];
  let total = existing.notes.length;
  for (const n of backup.notes) {
    const current = notesById.get(n.id);
    if (current) {
      if (n.updatedAt <= current.updatedAt) continue;
      counts.notesUpdated++;
    } else {
      if (total >= existing.maxNotes) {
        counts.notesSkipped++;
        continue;
      }
      total++;
      counts.notesAdded++;
    }
    const photoInBackup = n.hasPhoto && backup.photos.has(n.id);
    // A photo missing from the zip keeps the one already on the device.
    const hasPhoto = photoInBackup || (n.hasPhoto && current?.hasPhoto === true);
    notes.push({ ...n, hasPhoto });
    if (photoInBackup) photoNoteIds.push(n.id);
  }

  return { sessions, chunks, notes, photoNoteIds, counts };
}
