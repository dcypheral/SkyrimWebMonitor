/**
 * IndexedDB storage for the strategy guide the player picked from their
 * device. The app never ships the guide: the PDF itself, its text index,
 * the player's bookmarks, highlights and quest links all live here.
 *
 * Everything except the file is keyed by the guide's fingerprint, so picking
 * the same PDF again (after removing it) brings the annotations back.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { GuidePageText } from '@/shared/lib/guide/pageText';
import type { GuideAnnotation, GuideFileRecord, GuideMeta, GuidePageRecord, QuestLinkRecord } from './types';

const DB_NAME = 'strategy-guide';
const DB_VERSION = 1;
const FILE_KEY = 'current';

interface GuideDB extends DBSchema {
  files: { key: string; value: GuideFileRecord };
  meta: { key: string; value: GuideMeta };
  pages: { key: [string, number]; value: GuidePageRecord };
  annotations: { key: number; value: GuideAnnotation; indexes: { byFp: string } };
  links: { key: [string, string]; value: QuestLinkRecord; indexes: { byFp: string } };
}

let dbPromise: Promise<IDBPDatabase<GuideDB>> | null = null;

function getDb(): Promise<IDBPDatabase<GuideDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GuideDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('files');
        db.createObjectStore('meta', { keyPath: 'fp' });
        db.createObjectStore('pages', { keyPath: ['fp', 'page'] });
        db.createObjectStore('annotations', { keyPath: 'id', autoIncrement: true }).createIndex('byFp', 'fp');
        db.createObjectStore('links', { keyPath: ['fp', 'questKey'] }).createIndex('byFp', 'fp');
      },
    });
    dbPromise.catch((err) => {
      console.warn('[Guide] Failed to open IndexedDB', err);
      dbPromise = null;
    });
  }
  return dbPromise;
}

// ─── File ────────────────────────────────────────────────────────────────

export async function readFile(): Promise<GuideFileRecord | null> {
  const db = await getDb();
  return (await db.get('files', FILE_KEY)) ?? null;
}

/** Copies the picked file into app storage. Throws on quota errors. */
export async function writeFile(record: GuideFileRecord): Promise<void> {
  const db = await getDb();
  await db.put('files', record, FILE_KEY);
}

export async function deleteFile(): Promise<void> {
  const db = await getDb();
  await db.delete('files', FILE_KEY);
}

// ─── Meta and text index ────────────────────────────────────────────────

export async function readMeta(fp: string): Promise<GuideMeta | null> {
  const db = await getDb();
  return (await db.get('meta', fp)) ?? null;
}

export async function writeMeta(meta: GuideMeta): Promise<void> {
  const db = await getDb();
  await db.put('meta', meta);
}

export async function writePages(fp: string, pages: ReadonlyArray<GuidePageText & { width: number; height: number }>): Promise<void> {
  if (!pages.length) return;
  const db = await getDb();
  const tx = db.transaction('pages', 'readwrite');
  await Promise.all([...pages.map((p) => tx.store.put({ ...p, fp })), tx.done]);
}

export async function readPages(fp: string): Promise<GuidePageRecord[]> {
  const db = await getDb();
  return db.getAll('pages', IDBKeyRange.bound([fp, 0], [fp, Number.MAX_SAFE_INTEGER]));
}

/** Drops the file's derived data (outline, text index); annotations stay. */
export async function deleteDerived(fp: string): Promise<void> {
  const db = await getDb();
  await db.delete('meta', fp);
  await db.delete('pages', IDBKeyRange.bound([fp, 0], [fp, Number.MAX_SAFE_INTEGER]));
}

// ─── Annotations ────────────────────────────────────────────────────────

export async function readAnnotations(fp: string): Promise<GuideAnnotation[]> {
  const db = await getDb();
  return db.getAllFromIndex('annotations', 'byFp', fp);
}

/** Adds or replaces; returns the id. */
export async function putAnnotation(annotation: GuideAnnotation): Promise<number> {
  const db = await getDb();
  return db.put('annotations', annotation);
}

export async function deleteAnnotation(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('annotations', id);
}

// ─── Quest links ────────────────────────────────────────────────────────

export async function readLinks(fp: string): Promise<QuestLinkRecord[]> {
  const db = await getDb();
  return db.getAllFromIndex('links', 'byFp', fp);
}

export async function putLink(link: QuestLinkRecord): Promise<void> {
  const db = await getDb();
  await db.put('links', link);
}

export async function deleteLink(fp: string, questKey: string): Promise<void> {
  const db = await getDb();
  await db.delete('links', [fp, questKey]);
}

/** For tests: closes the connection so the database can be deleted. */
export async function resetGuideDbForTests(): Promise<void> {
  const open = dbPromise;
  dbPromise = null;
  if (open) (await open.catch(() => null))?.close();
}
