import { describe, expect, it } from 'vitest';
import { ProgressTracker, type QuestSnapshotEntry } from '../lib/progressTracker';

function quest(id: string, done: number[], completed = false): QuestSnapshotEntry {
  return {
    questFormId: id,
    name: `Quest ${id}`,
    isCompleted: completed,
    steps: [0, 1, 2].map((i) => ({ index: i, text: `Step ${i}`, completed: done.includes(i) })),
  };
}

describe('ProgressTracker', () => {
  it('uses the first snapshot as a baseline', () => {
    const t = new ProgressTracker();
    expect(t.updateQuests([quest('a', [0, 1])], 1)).toEqual([]);
  });

  it('reports newly completed objectives and quests', () => {
    const t = new ProgressTracker();
    t.updateQuests([quest('a', [0])], 1);
    const events = t.updateQuests([quest('a', [0, 1, 2], true)], 2);
    expect(events.map((e) => e.kind)).toEqual(['objective', 'objective', 'quest']);
    expect(events[0]).toMatchObject({ text: 'Step 1', detail: 'Quest a' });
  });

  it('treats a burst of changes as a save load', () => {
    const t = new ProgressTracker();
    t.updateQuests([quest('a', []), quest('b', [])], 1);
    expect(t.updateQuests([quest('a', [0, 1, 2], true), quest('b', [0, 1])], 2)).toEqual([]);
  });

  it('logs level-ups but not big jumps', () => {
    const t = new ProgressTracker();
    expect(t.updateLevel(10, 1)).toEqual([]);
    expect(t.updateLevel(11, 2)).toHaveLength(1);
    expect(t.updateLevel(30, 3)).toEqual([]);
  });
});
