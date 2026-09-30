import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useQuestStore } from '@/stores/quests/useQuestStore';
import { currentObjective, useTrackedQuest } from '../composables/useTrackedQuest';
import type { QuestJournalEntry, QuestStep } from '@/stores/quests/lib/types';

function step(index: number, text: string, extra: Partial<QuestStep> = {}): QuestStep {
  return {
    index, text, textRaw: text, completed: false, failed: false,
    state: 'Displayed', stateRaw: 1, instanceId: 0, ...extra,
  };
}

function quest(id: string, name: string, extra: Partial<QuestJournalEntry> = {}): QuestJournalEntry {
  return {
    type: 'quest', formId: id, questFormId: id, questEditorId: name, name, nameRaw: name,
    description: '', descriptionRaw: '', descriptionStage: 0, questType: 'Main',
    isMisc: false, isActive: false, isRunning: true, isCompleted: false,
    currentStage: 10, currentInstanceId: 0, steps: [step(0, `${name} objective`)], ...extra,
  };
}

describe('currentObjective', () => {
  it('picks the latest open displayed step', () => {
    const q = quest('0x1', 'Q', {
      steps: [step(0, 'Done', { completed: true }), step(1, 'First'), step(2, 'Second')],
    });
    expect(currentObjective(q)?.text).toBe('Second');
  });

  it('returns null when every step is finished', () => {
    const q = quest('0x1', 'Q', { steps: [step(0, 'Done', { completed: true })] });
    expect(currentObjective(q)).toBeNull();
  });
});

describe('useTrackedQuest', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('prefers journal-tracked quests and cycles through them', () => {
    useQuestStore().setQuests({
      quests: [
        quest('0x1', 'Untracked'),
        quest('0x2', 'Golden Claw', { isActive: true }),
        quest('0x3', 'Dragon Rising', { isActive: true }),
      ],
    });
    const tracked = useTrackedQuest();
    expect(tracked.isTracked.value).toBe(true);
    expect(tracked.quest.value?.name).toBe('Golden Claw');
    tracked.cycle(1);
    expect(tracked.quest.value?.name).toBe('Dragon Rising');
    tracked.cycle(1);
    expect(tracked.quest.value?.name).toBe('Golden Claw');
  });

  it('falls back to running non-misc quests when nothing is tracked', () => {
    useQuestStore().setQuests({
      quests: [quest('0x1', 'Misc thing', { isMisc: true }), quest('0x2', 'Main quest')],
    });
    const tracked = useTrackedQuest();
    expect(tracked.isTracked.value).toBe(false);
    expect(tracked.quest.value?.name).toBe('Main quest');
  });
});
