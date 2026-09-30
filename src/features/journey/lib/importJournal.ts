/**
 * Restores an "Export all" zip (or a bare journey.json) into this device's
 * journal. Merges; never deletes. See stores/journey/lib/backup.ts.
 */
import { readZip } from '@/shared/lib/utils/zip';
import { BACKUP_JSON_PATH, parseBackup, planMerge, type MergePlan } from '@/stores/journey/lib/backup';
import { journeyDb } from '@/stores/journey/lib/journeyDb';
import type { NotePhoto } from '@/stores/journey/lib/types';
import { MAX_NOTES, useJourneyStore } from '@/stores/journey/useJourneyStore';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function mimeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export async function importBackup(file: File): Promise<MergePlan['counts']> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;

  let files = new Map<string, Uint8Array>();
  let jsonText: string;
  if (isZip) {
    files = await readZip(bytes);
    const json = files.get(BACKUP_JSON_PATH);
    if (!json) throw new Error('no backup/journey.json in this zip');
    jsonText = new TextDecoder().decode(json);
  } else {
    jsonText = new TextDecoder().decode(bytes);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('not a journey backup');
  }
  const backup = parseBackup(raw);

  const store = useJourneyStore();
  await store.load();
  await store.flush();
  const plan = planMerge(backup, {
    sessions: store.sessions,
    notes: store.notes,
    activeSessionId: store.activeSessionId,
    maxNotes: MAX_NOTES,
  });

  const photos: NotePhoto[] = [];
  for (const id of plan.photoNoteIds) {
    const path = backup.photos.get(id);
    const data = path ? files.get(path) : undefined;
    if (path && data) photos.push({ noteId: id, blob: new Blob([new Uint8Array(data)], { type: mimeFor(path) }) });
  }

  await journeyDb.importData({ sessions: plan.sessions, chunks: plan.chunks, notes: plan.notes, photos });
  await store.reload();
  return plan.counts;
}
