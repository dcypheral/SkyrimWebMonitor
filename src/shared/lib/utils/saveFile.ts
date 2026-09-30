/**
 * Saves an exported file where the player can reach it.
 *
 *  - Android app (Capacitor): writes to Documents/SkyrimJournal/ (visible in
 *    the Files app) and returns the location; `shareFile` opens the share
 *    sheet for it.
 *  - Browser / Electron: a normal download.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const EXPORT_FOLDER = 'SkyrimJournal';

export interface SavedFile {
  /** Human-readable location, e.g. "Documents/SkyrimJournal/journal.zip". */
  location: string;
  /** Native file URI (Android) for sharing; null for browser downloads. */
  uri: string | null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

export async function saveFile(name: string, data: Uint8Array | string, mimeType: string): Promise<SavedFile> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  if (Capacitor.isNativePlatform()) {
    const path = `${EXPORT_FOLDER}/${name}`;
    const result = await Filesystem.writeFile({
      path,
      data: bytesToBase64(bytes),
      directory: Directory.Documents,
      recursive: true,
    });
    return { location: `Documents/${path}`, uri: result.uri };
  }

  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { location: name, uri: null };
}

export function canShareFiles(): boolean {
  return Capacitor.isNativePlatform();
}

export async function shareFile(file: SavedFile, title: string): Promise<void> {
  if (!file.uri) return;
  await Share.share({ title, files: [file.uri] });
}
