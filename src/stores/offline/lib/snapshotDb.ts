/**
 * IndexedDB copy of the last game state the app received, for offline
 * browsing between sessions.
 *
 *  entries — latest data per subscription id (fields merged over time)
 *  meta    — when it was saved, plugin features and game language
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface SnapshotEntry {
  id: string;
  data: Record<string, unknown>;
  /** ms since epoch of the last update */
  t: number;
}

export interface SnapshotMeta {
  key: 'meta';
  savedAt: number;
  features: string[];
  language: string | null;
}

interface SnapshotSchema extends DBSchema {
  entries: { key: string; value: SnapshotEntry };
  meta: { key: string; value: SnapshotMeta };
}

let dbPromise: Promise<IDBPDatabase<SnapshotSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<SnapshotSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<SnapshotSchema>('game-snapshot', 1, {
      upgrade(db) {
        db.createObjectStore('entries', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      },
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export const snapshotDb = {
  async load(): Promise<{ entries: SnapshotEntry[]; meta: SnapshotMeta | null }> {
    try {
      const db = await getDb();
      const [entries, meta] = await Promise.all([db.getAll('entries'), db.get('meta', 'meta')]);
      return { entries, meta: meta ?? null };
    } catch {
      return { entries: [], meta: null };
    }
  },

  async save(entries: readonly SnapshotEntry[], meta: SnapshotMeta): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(['entries', 'meta'], 'readwrite');
      for (const e of entries) void tx.objectStore('entries').put(e);
      void tx.objectStore('meta').put(meta);
      await tx.done;
    } catch (err) {
      console.warn('[Offline] Saving the snapshot failed', err);
    }
  },

  async clear(): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(['entries', 'meta'], 'readwrite');
      await Promise.all([tx.objectStore('entries').clear(), tx.objectStore('meta').clear(), tx.done]);
    } catch {
      /* nothing to clear */
    }
  },
};
