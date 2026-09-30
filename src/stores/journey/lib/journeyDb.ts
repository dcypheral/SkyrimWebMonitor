/**
 * IndexedDB storage for the hero's journey.
 *
 *  sessions  — one small record per play session (log, totals)
 *  chunks    — path slices (Int32Array), indexed by worldspace so the map
 *              only loads lines for the map it shows
 *  notes     — note metadata (text, pin) without photos, cheap to list
 *  photos    — note photos as Blobs, loaded one at a time on demand
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { JourneyNote, JourneySession, NotePhoto, PathChunk } from './types';

export const JOURNEY_DB_NAME = 'hero-journey';
export const JOURNEY_DB_VERSION = 1;

interface JourneyDB extends DBSchema {
  sessions: { key: number; value: JourneySession };
  chunks: {
    key: string;
    value: PathChunk;
    indexes: { byWorldspace: string; bySession: number };
  };
  notes: { key: number; value: JourneyNote; indexes: { bySession: number } };
  photos: { key: number; value: NotePhoto };
}

let dbPromise: Promise<IDBPDatabase<JourneyDB>> | null = null;

function getDb(): Promise<IDBPDatabase<JourneyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<JourneyDB>(JOURNEY_DB_NAME, JOURNEY_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('chunks')) {
          const chunks = db.createObjectStore('chunks', { keyPath: 'key' });
          chunks.createIndex('byWorldspace', 'worldspace');
          chunks.createIndex('bySession', 'sessionId');
        }
        if (!db.objectStoreNames.contains('notes')) {
          const notes = db.createObjectStore('notes', { keyPath: 'id' });
          notes.createIndex('bySession', 'sessionId');
        }
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'noteId' });
      },
    });
    dbPromise.catch((err) => {
      console.warn('[Journey] Failed to open IndexedDB', err);
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function safe<T>(label: string, fallback: T, fn: (db: IDBPDatabase<JourneyDB>) => Promise<T>): Promise<T> {
  try {
    return await fn(await getDb());
  } catch (err) {
    console.warn(`[Journey] ${label} failed`, err);
    return fallback;
  }
}

const NO_SESSIONS: JourneySession[] = [];
const NO_CHUNKS: PathChunk[] = [];
const NO_NOTES: JourneyNote[] = [];
const NO_BLOB: Blob | null = null;

export const journeyDb = {
  listSessions: () => safe('listSessions', NO_SESSIONS, (db) => db.getAll('sessions')),
  putSession: (s: JourneySession) => safe('putSession', undefined, async (db) => void (await db.put('sessions', s))),

  putChunk: (c: PathChunk) => safe('putChunk', undefined, async (db) => void (await db.put('chunks', c))),
  chunksForWorldspace: (ws: string) =>
    safe('chunksForWorldspace', NO_CHUNKS, (db) => db.getAllFromIndex('chunks', 'byWorldspace', ws)),
  chunksForSession: (id: number) =>
    safe('chunksForSession', NO_CHUNKS, (db) => db.getAllFromIndex('chunks', 'bySession', id)),

  listNotes: () => safe('listNotes', NO_NOTES, (db) => db.getAll('notes')),
  putNote: (n: JourneyNote) => safe('putNote', undefined, async (db) => void (await db.put('notes', n))),
  getPhoto: (noteId: number) =>
    safe('getPhoto', NO_BLOB, async (db) => (await db.get('photos', noteId))?.blob ?? null),
  putPhoto: (noteId: number, blob: Blob) =>
    safe('putPhoto', undefined, async (db) => void (await db.put('photos', { noteId, blob }))),
  deletePhoto: (noteId: number) => safe('deletePhoto', undefined, (db) => db.delete('photos', noteId)),
  deleteNote: (noteId: number) =>
    safe('deleteNote', undefined, async (db) => {
      const tx = db.transaction(['notes', 'photos'], 'readwrite');
      await Promise.all([tx.objectStore('notes').delete(noteId), tx.objectStore('photos').delete(noteId), tx.done]);
    }),

  listChunks: () => safe('listChunks', NO_CHUNKS, (db) => db.getAll('chunks')),

  /** Writes restored data in one transaction (all or nothing). */
  importData: async (data: {
    sessions: readonly JourneySession[];
    chunks: readonly PathChunk[];
    notes: readonly JourneyNote[];
    photos: readonly NotePhoto[];
  }): Promise<void> => {
    const db = await getDb();
    const tx = db.transaction(['sessions', 'chunks', 'notes', 'photos'], 'readwrite');
    for (const s of data.sessions) void tx.objectStore('sessions').put(s);
    for (const c of data.chunks) void tx.objectStore('chunks').put(c);
    for (const n of data.notes) void tx.objectStore('notes').put(n);
    for (const p of data.photos) void tx.objectStore('photos').put(p);
    await tx.done;
  },

  /** Removes everything (sessions, paths, notes, photos). */
  clearAll: () =>
    safe('clearAll', undefined, async (db) => {
      const tx = db.transaction(['sessions', 'chunks', 'notes', 'photos'], 'readwrite');
      await Promise.all([
        tx.objectStore('sessions').clear(),
        tx.objectStore('chunks').clear(),
        tx.objectStore('notes').clear(),
        tx.objectStore('photos').clear(),
        tx.done,
      ]);
    }),

  /** Removes a session with its path; its notes stay (unlinked). */
  deleteSession: (id: number) =>
    safe('deleteSession', undefined, async (db) => {
      const tx = db.transaction(['sessions', 'chunks', 'notes'], 'readwrite');
      await tx.objectStore('sessions').delete(id);
      const chunkKeys = await tx.objectStore('chunks').index('bySession').getAllKeys(id);
      for (const key of chunkKeys) await tx.objectStore('chunks').delete(key);
      const notes = await tx.objectStore('notes').index('bySession').getAll(id);
      for (const note of notes) await tx.objectStore('notes').put({ ...note, sessionId: null });
      await tx.done;
    }),
};
