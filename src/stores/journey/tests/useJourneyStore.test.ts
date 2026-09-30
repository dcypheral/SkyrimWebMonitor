import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { journeyDb } from '../lib/journeyDb';
import { MAX_NOTES, SESSION_GAP_MS, useJourneyStore } from '../useJourneyStore';
import { useMapPlayerStore } from '@/stores/map/useMapPlayerStore';

function pos(x: number, y: number, extra: Record<string, unknown> = {}) {
  return {
    position: {
      x, y, z: 0, angle: 0, cell: null, cellFormId: null, isInterior: false,
      worldspace: 'Tamriel', worldspaceFormId: '0x3C', parentWorldspace: 'Tamriel', parentWorldspaceFormId: '0x3C',
      ...extra,
    },
  };
}

function advance(ms: number): void {
  vi.setSystemTime(Date.now() + ms);
}

describe('useJourneyStore', () => {
  beforeEach(async () => {
    await journeyDb.clearAll();
    setActivePinia(createPinia());
    // Only fake the clock: IndexedDB (fake-indexeddb) needs real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
  });

  it('starts a session, adds distance and a new session after a long gap', async () => {
    const store = useJourneyStore();
    await store.load();
    store.ingest('journey.position', pos(0, 0));
    advance(1000);
    store.ingest('journey.position', pos(300, 0));
    expect(store.sessions).toHaveLength(1);
    expect(store.activeSession?.distance).toBe(300);

    advance(SESSION_GAP_MS + 1000);
    store.ingest('journey.position', pos(300, 0));
    expect(store.sessions).toHaveLength(2);
  });

  it('logs entered interiors once', async () => {
    const store = useJourneyStore();
    await store.load();
    const inside = { isInterior: true, cell: 'Bleak Falls Barrow', parentWorldspace: null, worldspace: null };
    store.ingest('journey.position', pos(0, 0, inside));
    advance(1000);
    store.ingest('journey.position', pos(10, 0, inside));
    expect(store.activeSession?.events.filter((e) => e.kind === 'location')).toHaveLength(1);
  });

  it('logs objectives from progress updates', async () => {
    const store = useJourneyStore();
    await store.load();
    const q = (done: boolean) => ({
      questFormId: '0x1', name: 'Q', isCompleted: false,
      steps: [{ index: 0, text: 'Do it', completed: done }],
    });
    store.ingest('journey.progress', { quests: [q(false)], level: 5 });
    store.ingest('journey.progress', { quests: [q(true)], level: 6 });
    const kinds = store.activeSession?.events.map((e) => e.kind);
    expect(kinds).toEqual(['level', 'objective']);
    expect(store.activeSession?.startLevel).toBe(5);
    expect(store.activeSession?.endLevel).toBe(6);
  });

  it('pins notes at the player and enforces the limit', async () => {
    const store = useJourneyStore();
    await store.load();
    const player = useMapPlayerStore();
    player.setPosition(pos(1234, -567).position);
    const note = await store.addNote({ text: 'Found a shrine' });
    expect(note).not.toBe('limit');
    if (note === 'limit') return;
    expect(note).toMatchObject({ worldspace: 'Tamriel', x: 1234, y: -567 });
    expect(store.activeSession?.events.slice(-1)[0]).toMatchObject({ kind: 'note', text: 'Found a shrine' });

    store.notes = Array.from({ length: MAX_NOTES }, (_, i) => ({ ...note, id: i }));
    expect(await store.addNote({ text: 'one too many' })).toBe('limit');
  });

  it('persists sessions and notes', async () => {
    const store = useJourneyStore();
    await store.load();
    store.ingest('journey.position', pos(0, 0));
    advance(1000);
    store.ingest('journey.position', pos(500, 0));
    await store.addNote({ text: 'kept' });
    await store.flush();

    setActivePinia(createPinia());
    const again = useJourneyStore();
    await again.load();
    expect(again.sessions).toHaveLength(1);
    expect(again.notes.map((n) => n.text)).toEqual(['kept']);
  });
});
