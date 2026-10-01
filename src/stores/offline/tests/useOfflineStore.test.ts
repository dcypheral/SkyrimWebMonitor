import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const saved: { entries: unknown[]; meta: unknown } = { entries: [], meta: null };
vi.mock('../lib/snapshotDb', () => ({
  snapshotDb: {
    load: () => Promise.resolve(saved),
    save: vi.fn(),
    clear: vi.fn(),
  },
}));

import { isSnapshotWorthy, mergeFields, useOfflineStore } from '../useOfflineStore';

describe('offline snapshot', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    saved.entries = [];
    saved.meta = null;
  });

  it('keeps browsable data and skips live-only streams', () => {
    expect(isSnapshotWorthy('inventory.weapons')).toBe(true);
    expect(isSnapshotWorthy('game.status')).toBe(false);
    expect(isSnapshotWorthy('journey.position')).toBe(false);
  });

  it('merges partial pushes', () => {
    expect(mergeFields({ health: 1, gold: 5 }, { health: 2 })).toEqual({ health: 2, gold: 5 });
  });

  it('restores categories first, once, without re-recording', async () => {
    saved.entries = [
      { id: 'inventory.weapons', data: { items: [] }, t: 1 },
      { id: 'inventory.categories', data: { categories: [] }, t: 1 },
    ];
    saved.meta = { key: 'meta', savedAt: 123, features: ['map.local'], language: 'ENGLISH' };
    const store = useOfflineStore();
    await store.load();
    expect(store.hasSnapshot).toBe(true);
    expect(store.savedAt).toBe(123);

    const routed: string[] = [];
    const system = vi.fn();
    store.restore((id, data) => {
      routed.push(id);
      store.record(id, data); // the router records too; must be ignored here
    }, system);
    expect(routed).toEqual(['inventory.categories', 'inventory.weapons']);
    expect(system).toHaveBeenCalledWith({ features: ['map.local'], language: 'ENGLISH' });
    expect(store.savedAt).toBe(123);

    store.restore((id) => routed.push(id), system);
    expect(routed).toHaveLength(2);
  });

  it('records live data with a fresh timestamp', () => {
    const store = useOfflineStore();
    store.record('character.stats', { health: 10 });
    expect(store.hasSnapshot).toBe(true);
    store.record('game.status', { status: {} });
    store.record('character.stats', [1, 2]);
    expect(store.savedAt).not.toBeNull();
  });
});
