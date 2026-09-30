/**
 * 3D item thumbnails for weapons and apparel.
 *
 * `request()` is cheap and idempotent: components call it when an item row
 * becomes visible. Work runs one job at a time, newest request first (what
 * the user is looking at now), and each result is cached in memory and in
 * IndexedDB. Anything that fails keeps the tinted category icon.
 */
import { defineStore } from 'pinia';
import { reactive, ref } from 'vue';
import { isThumbnailRenderingSupported, type ThumbnailFraming } from '@/shared/lib/nif';
import { itemThumbnailsDisabled } from '@/shared/lib/settings/itemThumbnailsPreference';
import { getItemMaterial } from '@/shared/lib/constants/itemMaterials';
import { logger } from '@/shared/lib/utils/logger';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import { useSystemStore } from '@/stores/system/useSystemStore';
import { FEATURES } from '@/stores/system/lib/types';
import { generateThumbnail, type ThumbnailJob } from './lib/generateThumbnail';
import { clearThumbnails, readThumbnail, writeThumbnail } from './lib/thumbnailDb';

/** Bump when the renderer's look changes so old cached images are replaced. */
export const THUMBNAIL_RENDER_VERSION = 2;

export interface ThumbnailSource {
  modelPath?: string | null;
  keywords?: readonly string[] | null;
  framing: ThumbnailFraming;
}

export function thumbnailKey(source: ThumbnailSource): string | null {
  if (!source.modelPath) return null;
  const material = getItemMaterial(source.keywords);
  return `v${THUMBNAIL_RENDER_VERSION}|${source.modelPath}|${material.id}|${source.framing}`;
}

export const useItemThumbnailsStore = defineStore('itemThumbnails', () => {
  /** key → data URL. */
  const urls = reactive(new Map<string, string>());
  const failed = new Set<string>();
  const queued = new Map<string, ThumbnailJob>();
  const order: string[] = [];
  const textureCache = new Map<string, Promise<HTMLImageElement | null>>();
  const isProcessing = ref(false);
  const generatedCount = ref(0);

  let renderSupported: boolean | null = null;

  function canRender(): boolean {
    if (itemThumbnailsDisabled.value) return false;
    const system = useSystemStore();
    if (!system.isFeatureProvided(FEATURES.INVENTORY_MODELS)) return false;
    if (!system.isFeatureProvided(FEATURES.FILE_DOWNLOAD)) return false;
    if (renderSupported === null) renderSupported = isThumbnailRenderingSupported();
    return renderSupported;
  }

  /** Current URL for this item, or null (fallback icon) while pending/failed. */
  function urlFor(source: ThumbnailSource): string | null {
    if (itemThumbnailsDisabled.value) return null;
    const key = thumbnailKey(source);
    return key ? (urls.get(key) ?? null) : null;
  }

  function request(source: ThumbnailSource): void {
    const key = thumbnailKey(source);
    if (!key || !source.modelPath) return;
    if (urls.has(key) || failed.has(key)) return;
    if (!canRender()) return;

    if (!queued.has(key)) {
      queued.set(key, {
        modelPath: source.modelPath,
        tint: getItemMaterial(source.keywords).rgb,
        framing: source.framing,
      });
    } else {
      // Already waiting: move to the front (it is visible again).
      const index = order.indexOf(key);
      if (index >= 0) order.splice(index, 1);
    }
    order.push(key);
    void processQueue();
  }

  async function processQueue(): Promise<void> {
    if (isProcessing.value) return;
    isProcessing.value = true;
    const websocket = useWebSocketStore();
    const system = useSystemStore();

    try {
      for (let key = order.pop(); key !== undefined; key = order.pop()) {
        // newest request first
        const job = queued.get(key);
        queued.delete(key);
        if (!job || urls.has(key) || failed.has(key)) continue;

        const cached = await readThumbnail(key);
        if (cached) {
          urls.set(key, cached);
          continue;
        }

        if (!websocket.isConnected) {
          // Keep it for later; stop until the next request after reconnect.
          queued.set(key, job);
          order.unshift(key);
          break;
        }

        try {
          const url = await generateThumbnail(job, {
            downloadFile: websocket.downloadFile,
            texturePreview: system.isFeatureProvided(FEATURES.TEXTURE_PREVIEW_MAX_SIZE)
              ? websocket.texturePreview
              : null,
            textureCache,
          });
          if (url) {
            urls.set(key, url);
            generatedCount.value++;
            await writeThumbnail(key, url);
          } else {
            failed.add(key);
          }
        } catch (err) {
          failed.add(key);
          logger.log(`[ItemThumbnails] ${job.modelPath}: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Yield to the UI between renders.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      isProcessing.value = false;
    }
  }

  /** Drop every cached thumbnail (memory + IndexedDB); they re-render on demand. */
  async function clearCache(): Promise<void> {
    urls.clear();
    failed.clear();
    queued.clear();
    order.length = 0;
    textureCache.clear();
    generatedCount.value = 0;
    await clearThumbnails();
  }

  return {
    urls,
    isProcessing,
    generatedCount,
    urlFor,
    request,
    clearCache,
  };
});
