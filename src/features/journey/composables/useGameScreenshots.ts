/**
 * In-game screenshots through the plugin (feature "screenshots").
 * The plugin asks the engine for a screenshot (same as PrintScreen); the
 * engine writes the file a moment later, so `captureNew` polls the list
 * until a new file appears.
 */
import { computed } from 'vue';
import type { ScreenshotFileInfo } from '@/api/websocket';
import { base64ToBlob } from '@/shared/lib/utils/imageFile';
import { useSystemStore } from '@/stores/system/useSystemStore';
import { FEATURES } from '@/stores/system/lib/types';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';

export const SCREENSHOT_MAX_EDGE = 960;
const POLL_MS = 700;
const TIMEOUT_MS = 8000;

export interface GameScreenshot {
  name: string;
  blob: Blob;
  width: number;
  height: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useGameScreenshots() {
  const ws = useWebSocketStore();
  const system = useSystemStore();
  const isAvailable = computed(() => system.isFeatureProvided(FEATURES.SCREENSHOTS));

  async function list(limit = 20): Promise<{ directory: string; total: number; files: ScreenshotFileInfo[] }> {
    const result = await ws.listScreenshots(limit);
    return { directory: result.directory, total: result.total, files: result.files };
  }

  async function fetch(name: string, maxEdge = SCREENSHOT_MAX_EDGE): Promise<GameScreenshot> {
    const r = await ws.getScreenshot(name, maxEdge);
    return {
      name: r.name,
      blob: base64ToBlob(r.dataBase64, r.mimeType),
      width: r.width ?? 0,
      height: r.height ?? 0,
    };
  }

  /** Takes a screenshot now and returns it once the engine has written it. */
  async function captureNew(): Promise<GameScreenshot> {
    const before = (await list(1)).files[0]?.name ?? null;
    const take = await ws.takeScreenshot();
    if (!take.queued) throw new Error('busy');
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_MS);
      const newest = (await list(1)).files[0];
      if (newest && newest.name !== before) {
        // The engine may still be writing a large PNG: wait, retry once.
        await sleep(400);
        try {
          return await fetch(newest.name);
        } catch {
          await sleep(1200);
          return fetch(newest.name);
        }
      }
    }
    throw new Error('timeout');
  }

  async function fetchLatest(): Promise<GameScreenshot | null> {
    const newest = (await list(1)).files[0];
    return newest ? fetch(newest.name) : null;
  }

  return { isAvailable, list, fetch, captureNew, fetchLatest };
}
