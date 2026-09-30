import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useQuestStore } from '@/stores/quests/useQuestStore';
import type { QuestJournalEntry, QuestStep } from '@/stores/quests/lib/types';

const STORAGE_KEY = 'skyrim-monitor-home-quest';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* localStorage can be unavailable in restricted WebViews */
  }
}

/** Current objective: the latest displayed step that is neither done nor failed. */
export function currentObjective(quest: QuestJournalEntry | null | undefined): QuestStep | null {
  if (!quest) return null;
  const open = quest.steps.filter((s) => !s.completed && !s.failed && s.text.trim().length > 0);
  if (open.length === 0) return null;
  const displayed = open.filter((s) => s.state === 'Displayed');
  const pool = displayed.length > 0 ? displayed : open;
  return pool[pool.length - 1];
}

/**
 * The quest shown on the home screen. Candidates are the quests the player
 * tracks in the journal (isActive); when none are tracked, running main /
 * side quests are used instead. The chosen quest is remembered per device.
 */
export function useTrackedQuest() {
  const { quests } = storeToRefs(useQuestStore());
  const selectedId = ref<string | null>(readStored());

  const candidates = computed<QuestJournalEntry[]>(() => {
    const open = quests.value.filter((q) => !q.isCompleted && currentObjective(q));
    const tracked = open.filter((q) => q.isActive);
    if (tracked.length > 0) return tracked;
    return open.filter((q) => !q.isMisc);
  });

  const isTracked = computed(() => candidates.value.some((q) => q.isActive));

  const quest = computed<QuestJournalEntry | null>(() => {
    const list = candidates.value;
    if (list.length === 0) return null;
    return list.find((q) => q.questFormId === selectedId.value) ?? list[0];
  });

  const objective = computed(() => currentObjective(quest.value));

  const position = computed(() => {
    const index = candidates.value.findIndex((q) => q.questFormId === quest.value?.questFormId);
    return { index: Math.max(0, index), total: candidates.value.length };
  });

  function cycle(step: 1 | -1): void {
    const list = candidates.value;
    if (list.length < 2) return;
    const next = list[(position.value.index + step + list.length) % list.length];
    selectedId.value = next.questFormId;
  }

  watch(selectedId, (id) => {
    if (id) writeStored(id);
  });

  return { quest, objective, isTracked, position, cycle };
}
