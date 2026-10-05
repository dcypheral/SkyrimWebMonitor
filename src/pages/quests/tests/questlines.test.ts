import { describe, it, expect } from 'vitest';
import type { QuestJournalEntry } from '@/stores/quests/lib/types';
import { groupByQuestline, questLabel, questlineOf } from '../lib/questlines';

function quest(name: string, questType: string, extra: Partial<QuestJournalEntry> = {}): QuestJournalEntry {
  return {
    type: 'quest',
    formId: name,
    questFormId: name,
    questEditorId: name,
    name,
    nameRaw: name,
    description: '',
    descriptionRaw: '',
    descriptionStage: 0,
    questType,
    isMisc: false,
    isActive: false,
    isRunning: true,
    isCompleted: false,
    currentStage: 0,
    currentInstanceId: 0,
    steps: [],
    ...extra,
  };
}

describe('questlines', () => {
  it('maps plugin and legacy quest types', () => {
    expect(questlineOf(quest('a', 'MainQuest'))).toBe('main');
    expect(questlineOf(quest('a', 'Main'))).toBe('main');
    expect(questlineOf(quest('a', 'MagesGuild'))).toBe('college');
    expect(questlineOf(quest('a', 'DLC01_Vampire'))).toBe('dawnguard');
    expect(questlineOf(quest('a', 'None'))).toBe('side');
    expect(questlineOf(quest('a', 'SideQuest', { isMisc: true }))).toBe('misc');
  });

  it('groups in story order, tracked first then A–Z', () => {
    const groups = groupByQuestline([
      quest('Zeta', 'SideQuest'),
      quest('Alpha', 'SideQuest'),
      quest('Tracked', 'SideQuest', { isActive: true }),
      quest('Unbound', 'MainQuest'),
    ]);
    expect(groups.map((g) => g.line)).toEqual(['main', 'side']);
    expect(groups[1]?.quests.map((q) => q.name)).toEqual(['Tracked', 'Alpha', 'Zeta']);
  });

  it('labels misc entries by their open objective', () => {
    const misc = quest('', 'Miscellaneous', {
      isMisc: true,
      steps: [
        { index: 0, text: 'Done task', textRaw: '', completed: true, failed: false, state: '', stateRaw: 0, instanceId: 0 },
        { index: 1, text: 'Find Ysolda a Mammoth Tusk', textRaw: '', completed: false, failed: false, state: '', stateRaw: 0, instanceId: 1 },
      ],
    });
    expect(questLabel(misc)).toBe('Find Ysolda a Mammoth Tusk');
    expect(questLabel(quest('Bleak Falls Barrow', 'MainQuest'))).toBe('Bleak Falls Barrow');
  });
});
