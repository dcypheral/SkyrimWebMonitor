/**
 * Local map data for the Home mini-map. Fetched on demand (local_map_get)
 * when the player enters another interior or exterior cell; nothing is
 * polled while the local map is not shown.
 */
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import { useSystemStore } from '@/stores/system/useSystemStore';
import { FEATURES } from '@/stores/system/lib/types';
import { decodeLocalMap, localAreaKey, type AreaPosition, type LocalMapGeometry } from './lib/localMap';

/** Minimum gap between two requests (cell borders can flicker). */
const MIN_INTERVAL_MS = 1500;
/** A failed area is retried this often (the cell may still be loading)… */
const RETRY_MS = 5000;
/** …this many times. */
const MAX_ATTEMPTS = 3;

export const useLocalMapStore = defineStore('localMap', () => {
  const geometry = shallowRef<LocalMapGeometry | null>(null);
  /** Key the current geometry was requested for. */
  const loadedKey = ref<string | null>(null);
  /** Key whose request failed (no navmesh); not retried until the key changes. */
  const failedKey = ref<string | null>(null);
  const loading = ref(false);

  let lastRequest = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let latest: AreaPosition | null = null;
  let failedAt = 0;
  let attempts = 0;

  function isAvailable(): boolean {
    return useSystemStore().isFeatureProvided(FEATURES.LOCAL_MAP);
  }

  /** Call with each player position while the local map is on screen. */
  function update(position: AreaPosition | null): void {
    latest = position;
    const key = localAreaKey(position);
    if (!key || !isAvailable()) return;
    if (key === loadedKey.value || loading.value) return;
    if (key === failedKey.value && (attempts >= MAX_ATTEMPTS || Date.now() - failedAt < RETRY_MS)) return;

    const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
      if (!retryTimer) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          update(latest);
        }, wait);
      }
      return;
    }
    void request(key);
  }

  async function request(key: string): Promise<void> {
    loading.value = true;
    lastRequest = Date.now();
    try {
      const data = await useWebSocketStore().getLocalMap();
      geometry.value = decodeLocalMap(data);
      loadedKey.value = key;
      failedKey.value = null;
      attempts = 0;
    } catch {
      attempts = failedKey.value === key ? attempts + 1 : 1;
      failedKey.value = key;
      failedAt = Date.now();
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    geometry.value = null;
    loadedKey.value = null;
    failedKey.value = null;
  }

  return { geometry, loadedKey, failedKey, loading, update, reset, isAvailable };
});
