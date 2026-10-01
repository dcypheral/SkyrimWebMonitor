/**
 * Offline mode: the app keeps a copy of the last game state it received
 * (inventory, magic, stats, quests, map position, …) and shows it, read-only,
 * while the game is not connected. Live data replaces it on connect.
 */
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { snapshotDb, type SnapshotEntry } from './lib/snapshotDb';

/** Data that only makes sense live, or is stored elsewhere (journal). */
export function isSnapshotWorthy(id: string): boolean {
  return !(id === 'game.status' || id.startsWith('journey.') || id.startsWith('debug.'));
}

/** Merges a push into the stored fields (pushes may carry changed fields only). */
export function mergeFields(prev: Record<string, unknown> | undefined, next: Record<string, unknown>): Record<string, unknown> {
  return prev ? { ...prev, ...next } : { ...next };
}

const FLUSH_MS = 15_000;

export type RouteFn = (id: string, data: unknown) => unknown;

export const useOfflineStore = defineStore('offline', () => {
  /** When the stored state was last updated; null = no snapshot. */
  const savedAt = ref<number | null>(null);
  /** The player asked for the connection screen while offline. */
  const wantsConnectScreen = ref(false);
  const isLoaded = ref(false);

  const entries = new Map<string, SnapshotEntry>();
  const dirty = new Set<string>();
  let features: string[] = [];
  let language: string | null = null;
  let restoring = false;
  let restored = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const hasSnapshot = computed(() => savedAt.value !== null);

  function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
  }

  /** Called for every routed data message. */
  function record(id: string, data: unknown): void {
    if (restoring || !isSnapshotWorthy(id) || !isRecord(data)) return;
    const now = Date.now();
    entries.set(id, { id, data: mergeFields(entries.get(id)?.data, data), t: now });
    dirty.add(id);
    savedAt.value = now;
    scheduleFlush();
  }

  /** Plugin features and game language (from the system query). */
  function recordSystem(fields: Record<string, unknown>): void {
    if (Array.isArray(fields.features)) features = fields.features.filter((f): f is string => typeof f === 'string');
    if (typeof fields.language === 'string') language = fields.language;
  }

  function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, FLUSH_MS);
  }

  async function flush(): Promise<void> {
    if (dirty.size === 0 || savedAt.value === null) return;
    const batch = Array.from(dirty, (id) => entries.get(id)).filter((e): e is SnapshotEntry => !!e);
    dirty.clear();
    await snapshotDb.save(batch, { key: 'meta', savedAt: savedAt.value, features, language });
  }

  async function load(): Promise<void> {
    if (isLoaded.value) return;
    const stored = await snapshotDb.load();
    for (const e of stored.entries) if (!entries.has(e.id)) entries.set(e.id, e);
    if (stored.meta) {
      savedAt.value ??= stored.meta.savedAt;
      if (features.length === 0) features = stored.meta.features;
      language ??= stored.meta.language;
    }
    isLoaded.value = true;
  }

  /**
   * Feeds the stored state through the normal data path once, so every page
   * shows it. Skipped when live data has already arrived.
   */
  function restore(route: RouteFn, applySystem: (fields: Record<string, unknown>) => void): void {
    if (restored || entries.size === 0) return;
    restored = true;
    restoring = true;
    try {
      if (features.length) applySystem({ features, language });
      // Category lists first: they create the sub-tabs the item lists fill.
      const ordered = Array.from(entries.values()).sort((a, b) => Number(b.id.endsWith('.categories')) - Number(a.id.endsWith('.categories')));
      for (const e of ordered) route(e.id, e.data);
    } finally {
      restoring = false;
    }
  }

  /** Live data is flowing: no need to restore any more. */
  function markLive(): void {
    restored = true;
    wantsConnectScreen.value = false;
  }

  async function clear(): Promise<void> {
    entries.clear();
    dirty.clear();
    savedAt.value = null;
    await snapshotDb.clear();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush();
    });
    window.addEventListener('pagehide', () => void flush());
  }

  return { savedAt, hasSnapshot, wantsConnectScreen, isLoaded, record, recordSystem, flush, load, restore, markLive, clear };
});
