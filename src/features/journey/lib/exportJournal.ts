/**
 * Builds Markdown exports of the journal and saves them.
 *
 *  - One session: `<date>.md`, or a `.zip` with the photos when it has any.
 *  - Notes only: `notes.md` (or `.zip` with photos).
 *  - Everything: `skyrim-journal-<date>.zip` with README.md, notes.md,
 *    sessions/*.md and photos/*.
 */
import { i18n } from '@/i18n';
import { createZip, type ZipEntry } from '@/shared/lib/utils/zip';
import { saveFile, type SavedFile } from '@/shared/lib/utils/saveFile';
import { extensionForMime } from '@/shared/lib/utils/imageFile';
import { journeyDb } from '@/stores/journey/lib/journeyDb';
import {
  fileStamp,
  indexMarkdown,
  notesToMarkdown,
  sessionFileName,
  sessionToMarkdown,
  type MarkdownContext,
} from '@/stores/journey/lib/markdown';
import type { JourneyNote, JourneySession } from '@/stores/journey/lib/types';

interface PhotoFile {
  name: string;
  data: Uint8Array;
}

function context(photoNames: Map<number, string>, prefix: string): MarkdownContext {
  return {
    t: (key, params) => i18n.global.t(`pages.${key}`, params ?? {}),
    locale: i18n.global.locale.value,
    photoPath: (note) => {
      const name = photoNames.get(note.id);
      return name ? `${prefix}${name}` : null;
    },
  };
}

async function collectPhotos(notes: readonly JourneyNote[]): Promise<{ files: PhotoFile[]; names: Map<number, string> }> {
  const files: PhotoFile[] = [];
  const names = new Map<number, string>();
  for (const note of notes) {
    if (!note.hasPhoto) continue;
    const blob = await journeyDb.getPhoto(note.id);
    if (!blob) continue;
    const name = `note-${fileStamp(note.createdAt)}-${String(note.id % 1000).padStart(3, '0')}.${extensionForMime(blob.type)}`;
    files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
    names.set(note.id, name);
  }
  return { files, names };
}

export async function exportSession(session: JourneySession, notes: readonly JourneyNote[]): Promise<SavedFile> {
  const own = notes.filter((n) => n.sessionId === session.id);
  const { files, names } = await collectPhotos(own);
  const md = sessionToMarkdown(session, own, context(names, 'photos/'));
  const base = sessionFileName(session);
  if (files.length === 0) return saveFile(base, md, 'text/markdown');
  const entries: ZipEntry[] = [{ name: base, data: md }, ...files.map((f) => ({ name: `photos/${f.name}`, data: f.data }))];
  return saveFile(base.replace(/\.md$/, '.zip'), createZip(entries), 'application/zip');
}

export async function exportNotes(notes: readonly JourneyNote[]): Promise<SavedFile> {
  const { files, names } = await collectPhotos(notes);
  const md = notesToMarkdown(notes, context(names, 'photos/'));
  const stamp = fileStamp(Date.now());
  if (files.length === 0) return saveFile(`notes-${stamp}.md`, md, 'text/markdown');
  const entries: ZipEntry[] = [{ name: 'notes.md', data: md }, ...files.map((f) => ({ name: `photos/${f.name}`, data: f.data }))];
  return saveFile(`notes-${stamp}.zip`, createZip(entries), 'application/zip');
}

export async function exportAll(sessions: readonly JourneySession[], notes: readonly JourneyNote[]): Promise<SavedFile> {
  const { files, names } = await collectPhotos(notes);
  const rootCtx = context(names, 'photos/');
  const sessionCtx = context(names, '../photos/');
  const entries: ZipEntry[] = [
    { name: 'README.md', data: indexMarkdown(sessions, rootCtx) },
    { name: 'notes.md', data: notesToMarkdown(notes, rootCtx) },
    ...sessions.map((s) => ({ name: `sessions/${sessionFileName(s)}`, data: sessionToMarkdown(s, notes, sessionCtx) })),
    ...files.map((f) => ({ name: `photos/${f.name}`, data: f.data })),
  ];
  return saveFile(`skyrim-journal-${fileStamp(Date.now())}.zip`, createZip(entries), 'application/zip');
}
