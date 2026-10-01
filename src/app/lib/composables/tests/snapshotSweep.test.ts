import { describe, expect, it } from 'vitest';
import { sweepTargets } from '../useSnapshotSweep';

describe('snapshot sweep targets', () => {
  it('covers the browsable lists once each and nothing live-only', () => {
    const ids = sweepTargets().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['inventory.weapons', 'character.records', 'quests.questsList']));
    expect(ids.some((id) => id.startsWith('map.') || id === 'game.status')).toBe(false);
  });
});
