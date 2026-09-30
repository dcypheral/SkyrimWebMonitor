/**
 * Hero's journey: records the player's path and a per-session log while the
 * app is connected, and keeps player notes pinned to the map.
 *
 * Data arrives from two low-rate background subscriptions (see
 * `JOURNEY_SUBSCRIPTIONS`): position once per second, quests and level on
 * change. Writes to IndexedDB are batched (FLUSH_MS) so recording costs
 * almost nothing while playing.
 */
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import {
  journeyObjectivesEnabled,
  journeyRecordingEnabled,
} from '@/shared/lib/settings/journeyPreference';
import { useMapPlayerStore } from '@/stores/map/useMapPlayerStore';
import type { PlayerPosition } from '@/stores/map/lib/types';
import { journeyDb } from './lib/journeyDb';
import { chunkKey, PathRecorder, type OpenSegment } from './lib/pathRecorder';
import { ProgressTracker } from './lib/progressTracker';
import type { JourneyNote, JourneySession, PathChunk, SessionEvent } from './lib/types';

/** No data for this long = the next data starts a new session. */
export const SESSION_GAP_MS = 30 * 60_000;
export const FLUSH_MS = 20_000;
export const MAX_NOTES = 500;
export const MAX_NOTE_TEXT = 4000;
export const MAX_SESSION_EVENTS = 400;

export type NoteLimitError = 'limit';

export interface NoteInput {
  text: string;
  photo?: { blob: Blob; width: number; height: number; source: 'device' | 'game' } | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isPlayerPosition(v: unknown): v is PlayerPosition {
  return isRecord(v) && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.isInterior === 'boolean';
}

/** Plain copy for IndexedDB (drops Vue proxies). */
function clone(session: JourneySession): JourneySession {
  return { ...session, events: session.events.map((e) => ({ ...e })) };
}

function lastEventOfKind(events: readonly SessionEvent[], kind: SessionEvent['kind']): SessionEvent | null {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].kind === kind) return events[i];
  return null;
}

function toChunk(sessionId: number, seg: OpenSegment): PathChunk {
  return {
    key: chunkKey(sessionId, seg.segment, seg.seq),
    sessionId,
    segment: seg.segment,
    seq: seg.seq,
    worldspace: seg.worldspace,
    points: Int32Array.from(seg.points),
  };
}

export const useJourneyStore = defineStore('journey', () => {
  const sessions = ref<JourneySession[]>([]);
  const notes = ref<JourneyNote[]>([]);
  const isLoaded = ref(false);
  const activeSessionId = ref<number | null>(null);

  /** Bumped whenever stored path data changes (map layer reloads). */
  const pathVersion = ref(0);
  /** The segment being recorded now (drawn live on the map). */
  const liveSegment = shallowRef<{
    sessionId: number;
    segment: number;
    seq: number;
    worldspace: string;
    points: number[];
  } | null>(null);

  let recorder = new PathRecorder();
  const tracker = new ProgressTracker();
  let lastCell: string | null = null;
  let dirty = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let loadPromise: Promise<void> | null = null;
  const photoUrls = new Map<number, string>();

  const activeSession = computed(() => sessions.value.find((s) => s.id === activeSessionId.value) ?? null);
  const sortedSessions = computed(() => sessions.value.slice().sort((a, b) => b.startedAt - a.startedAt));
  const sortedNotes = computed(() => notes.value.slice().sort((a, b) => b.createdAt - a.createdAt));
  const totals = computed(() => {
    let distance = 0;
    let activeMs = 0;
    for (const s of sessions.value) {
      distance += s.distance;
      activeMs += s.activeMs;
    }
    return { distance, activeMs, sessions: sessions.value.length, notes: notes.value.length };
  });

  // ─── Loading ───────────────────────────────────────────────────────────

  function load(): Promise<void> {
    if (!loadPromise) {
      loadPromise = (async () => {
        const [s, n] = await Promise.all([journeyDb.listSessions(), journeyDb.listNotes()]);
        sessions.value = s;
        notes.value = n;
        isLoaded.value = true;
      })();
    }
    return loadPromise;
  }

  /** Re-reads sessions and notes after a restore. */
  async function reload(): Promise<void> {
    loadPromise = null;
    for (const id of photoUrls.keys()) revokePhoto(id);
    await load();
    pathVersion.value++;
  }

  // ─── Sessions ──────────────────────────────────────────────────────────

  function ensureSession(now: number): JourneySession {
    const current = activeSession.value;
    if (current && now - current.endedAt < SESSION_GAP_MS) return current;

    // Resume the latest session after an app restart if it is recent enough.
    const latest = sortedSessions.value[0];
    if (!current && latest && now - latest.endedAt < SESSION_GAP_MS) {
      activeSessionId.value = latest.id;
      recorder = new PathRecorder(latest.segments);
      tracker.reset();
      return latest;
    }

    if (current) {
      closeActiveSegment();
      void journeyDb.putSession(clone(current));
    }
    const session: JourneySession = {
      id: now,
      startedAt: now,
      endedAt: now,
      activeMs: 0,
      distance: 0,
      startLevel: null,
      endLevel: null,
      events: [],
      title: '',
      pointCount: 0,
      segments: 0,
    };
    sessions.value = [...sessions.value, session];
    activeSessionId.value = session.id;
    recorder = new PathRecorder(0);
    tracker.reset();
    lastCell = null;
    dirty = true;
    return session;
  }

  function mutateSession(id: number, fn: (s: JourneySession) => void): void {
    const index = sessions.value.findIndex((s) => s.id === id);
    if (index < 0) return;
    const copy = { ...sessions.value[index], events: sessions.value[index].events.slice() };
    fn(copy);
    const next = sessions.value.slice();
    next[index] = copy;
    sessions.value = next;
  }

  function pushEvents(session: JourneySession, events: SessionEvent[]): void {
    if (events.length === 0) return;
    mutateSession(session.id, (s) => {
      s.events.push(...events);
      // Trim the oldest "entered" entries first; they matter least.
      while (s.events.length > MAX_SESSION_EVENTS) {
        const i = s.events.findIndex((e) => e.kind === 'location');
        s.events.splice(i >= 0 ? i : 0, 1);
      }
    });
    dirty = true;
    scheduleFlush();
  }

  // ─── Recording ─────────────────────────────────────────────────────────

  function ingest(subscriptionId: string, data: unknown): void {
    if (!journeyRecordingEnabled.value || !isLoaded.value || !isRecord(data)) return;
    if (subscriptionId === 'journey.position') ingestPosition(data.position);
    else if (subscriptionId === 'journey.progress') ingestProgress(data);
    else if (subscriptionId === 'journey.discoveries') ingestDiscoveries(data.discoveries);
  }

  function ingestDiscoveries(raw: unknown): void {
    const now = Date.now();
    const session = ensureSession(now);
    pushEvents(session, tracker.updateDiscoveries(raw, now));
  }

  function ingestPosition(raw: unknown): void {
    if (!isPlayerPosition(raw)) return;
    const now = Date.now();
    const session = ensureSession(now);
    const worldspace = raw.isInterior ? null : (raw.parentWorldspace ?? raw.worldspace);

    // Log interiors the player enters (once per visit).
    const cell = raw.isInterior ? raw.cell : null;
    if (cell && cell !== lastCell) {
      const label = raw.cellName?.trim() || cell;
      const recent = lastEventOfKind(session.events, 'location');
      if (!recent || recent.text !== label || now - recent.t > 10 * 60_000) {
        pushEvents(session, [{ t: now, kind: 'location', text: label }]);
      }
    }
    lastCell = cell;

    const result = recorder.ingest({ t: now, x: raw.x, y: raw.y, worldspace, isInterior: raw.isInterior, cell });

    mutateSession(session.id, (s) => {
      s.endedAt = now;
      s.activeMs += result.activeMs;
      s.distance += result.distance;
      s.segments = Math.max(s.segments, (recorder.openChunk?.segment ?? -1) + 1);
    });

    if (result.closedChunk) {
      void journeyDb.putChunk(toChunk(session.id, result.closedChunk)).then(() => pathVersion.value++);
      mutateSession(session.id, (s) => {
        s.pointCount += (result.closedChunk?.points.length ?? 0) / 2;
      });
    }

    const open = recorder.openChunk;
    if (result.changed || result.closedChunk) {
      liveSegment.value = open
        ? { sessionId: session.id, segment: open.segment, seq: open.seq, worldspace: open.worldspace, points: open.points.slice() }
        : null;
    }
    dirty = true;
    scheduleFlush();
  }

  function ingestProgress(data: Record<string, unknown>): void {
    const now = Date.now();
    const session = ensureSession(now);
    const events: SessionEvent[] = [];

    const level = typeof data.level === 'number' ? data.level : null;
    if (level !== null) {
      events.push(...tracker.updateLevel(level, now));
      mutateSession(session.id, (s) => {
        s.startLevel ??= level;
        s.endLevel = level;
      });
    }

    if (Array.isArray(data.quests)) {
      const found = tracker.updateQuests(data.quests, now);
      if (journeyObjectivesEnabled.value) events.push(...found);
    }
    pushEvents(session, events);
  }

  function closeActiveSegment(): void {
    const id = activeSessionId.value;
    const closed = recorder.closeSegment();
    if (id !== null && closed) {
      void journeyDb.putChunk(toChunk(id, closed)).then(() => pathVersion.value++);
    }
    liveSegment.value = null;
  }

  // ─── Persistence ───────────────────────────────────────────────────────

  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, FLUSH_MS);
  }

  async function flush(): Promise<void> {
    if (!dirty) return;
    dirty = false;
    const session = activeSession.value;
    if (!session) return;
    const open = recorder.openChunk;
    // The open chunk is saved under its final key and overwritten as it grows.
    if (open && open.points.length >= 4) await journeyDb.putChunk(toChunk(session.id, open));
    await journeyDb.putSession(clone(session));
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush();
    });
    window.addEventListener('pagehide', () => void flush());
  }

  // ─── Notes ─────────────────────────────────────────────────────────────

  const canAddNote = computed(() => notes.value.length < MAX_NOTES);

  async function addNote(input: NoteInput): Promise<JourneyNote | NoteLimitError> {
    await load();
    if (notes.value.length >= MAX_NOTES) return 'limit';
    const now = Date.now();
    const player = useMapPlayerStore();
    const dp = player.displayPosition;
    const live = player.position;
    const session = live ? ensureSession(now) : activeSession.value;

    const note: JourneyNote = {
      id: now,
      sessionId: session?.id ?? null,
      createdAt: now,
      updatedAt: now,
      text: input.text.slice(0, MAX_NOTE_TEXT),
      worldspace: dp ? player.currentMapWorldspace : null,
      x: dp ? Math.round(dp.x) : 0,
      y: dp ? Math.round(dp.y) : 0,
      place: live?.isInterior ? live.cell : null,
      hasPhoto: !!input.photo,
      photoWidth: input.photo?.width,
      photoHeight: input.photo?.height,
      photoSource: input.photo?.source,
    };
    if (input.photo) await journeyDb.putPhoto(note.id, input.photo.blob);
    await journeyDb.putNote(note);
    notes.value = [...notes.value, note];

    if (session) {
      const snippet = note.text.trim().split('\n')[0].slice(0, 80);
      pushEvents(session, [{ t: now, kind: 'note', text: snippet, detail: String(note.id) }]);
    }
    return note;
  }

  async function updateNote(id: number, input: NoteInput): Promise<void> {
    const index = notes.value.findIndex((n) => n.id === id);
    if (index < 0) return;
    const prev = notes.value[index];
    const next: JourneyNote = { ...prev, text: input.text.slice(0, MAX_NOTE_TEXT), updatedAt: Date.now() };
    if (input.photo === null) {
      next.hasPhoto = false;
      delete next.photoWidth;
      delete next.photoHeight;
      delete next.photoSource;
      await journeyDb.deletePhoto(id);
      revokePhoto(id);
    } else if (input.photo) {
      next.hasPhoto = true;
      next.photoWidth = input.photo.width;
      next.photoHeight = input.photo.height;
      next.photoSource = input.photo.source;
      await journeyDb.putPhoto(id, input.photo.blob);
      revokePhoto(id);
    }
    await journeyDb.putNote(next);
    const list = notes.value.slice();
    list[index] = next;
    notes.value = list;
  }

  async function deleteNote(id: number): Promise<void> {
    await journeyDb.deleteNote(id);
    revokePhoto(id);
    notes.value = notes.value.filter((n) => n.id !== id);
  }

  async function photoUrl(id: number): Promise<string | null> {
    const cached = photoUrls.get(id);
    if (cached) return cached;
    const blob = await journeyDb.getPhoto(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    photoUrls.set(id, url);
    return url;
  }

  function revokePhoto(id: number): void {
    const url = photoUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    photoUrls.delete(id);
  }

  // ─── Session edits ─────────────────────────────────────────────────────

  async function renameSession(id: number, title: string): Promise<void> {
    mutateSession(id, (s) => {
      s.title = title.slice(0, 120);
    });
    const s = sessions.value.find((x) => x.id === id);
    if (s) await journeyDb.putSession(clone(s));
  }

  async function deleteSession(id: number): Promise<void> {
    if (id === activeSessionId.value) {
      recorder = new PathRecorder();
      activeSessionId.value = null;
      liveSegment.value = null;
    }
    await journeyDb.deleteSession(id);
    sessions.value = sessions.value.filter((s) => s.id !== id);
    notes.value = notes.value.map((n) => (n.sessionId === id ? { ...n, sessionId: null } : n));
    pathVersion.value++;
  }

  /** Deletes every session, path, note and photo. */
  async function clearAll(): Promise<void> {
    recorder = new PathRecorder();
    tracker.reset();
    activeSessionId.value = null;
    liveSegment.value = null;
    for (const id of photoUrls.keys()) revokePhoto(id);
    await journeyDb.clearAll();
    sessions.value = [];
    notes.value = [];
    pathVersion.value++;
  }

  return {
    sessions,
    sortedSessions,
    notes,
    sortedNotes,
    isLoaded,
    activeSessionId,
    activeSession,
    totals,
    pathVersion,
    liveSegment,
    canAddNote,
    load,
    reload,
    ingest,
    flush,
    addNote,
    updateNote,
    deleteNote,
    photoUrl,
    renameSession,
    deleteSession,
    clearAll,
  };
});
