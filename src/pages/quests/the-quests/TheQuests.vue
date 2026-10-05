<template>
  <div class="ledger">
    <Transition
      :name="openQuest ? 'ledger-in' : 'ledger-out'"
      mode="out-in"
    >
      <quest-detail
        v-if="openQuest"
        key="detail"
        :quest="openQuest"
        :can-act="isConnected"
        @back="openId = null"
        @toggle-active="toggleQuestActive"
      />

      <div
        v-else
        key="list"
        class="ledger__view"
      >
        <div class="ledger__bar">
          <div
            class="ledger__filters"
            role="tablist"
          >
            <button
              v-for="f in FILTERS"
              :key="f"
              type="button"
              role="tab"
              class="ledger__filter"
              :class="{ 'ledger__filter--on': filter === f }"
              :aria-selected="filter === f"
              @click="filter = f"
            >
              {{ t(`pages.quests.questsList.filters.${f}`) }}
              <span class="ledger__count">{{ counts[f] }}</span>
            </button>
          </div>
          <button
            type="button"
            class="ledger__guide"
            :class="{ 'ledger__guide--off': guideStatus !== 'ready' }"
            :aria-label="t('pages.quests.questsList.guide.title')"
            @click="onGuideButton"
          >
            <guide-icon
              name="book"
              :size="22"
            />
          </button>
        </div>

        <div class="ledger__scroll">
          <p
            v-if="!quests.length"
            class="ledger__empty"
          >
            {{ t('pages.quests.questsList.waitingForData') }}
          </p>
          <p
            v-else-if="!groups.length"
            class="ledger__empty"
          >
            {{ t(`pages.quests.questsList.empty.${filter}`) }}
          </p>

          <section
            v-for="g in groups"
            :key="g.line"
            class="ledger__group"
            :style="{ '--line-color': QUESTLINE_COLOR[g.line] }"
          >
            <h3 class="ledger__line">
              <span>{{ t(`pages.quests.questsList.lines.${g.line}`) }}</span>
              <span class="ledger__line-count">{{ g.quests.length }}</span>
            </h3>
            <button
              v-for="q in g.quests"
              :key="q.formId"
              type="button"
              class="ledger__row"
              :class="{ 'ledger__row--done': q.isCompleted }"
              @click="openId = q.formId"
            >
              <span
                class="ledger__track"
                :class="{ 'ledger__track--on': q.isActive }"
                :aria-label="q.isActive ? t('pages.quests.questsList.tracked') : undefined"
              />
              <span class="ledger__name">{{ questLabel(q) }}</span>
              <span
                v-if="guidePage(q) !== null"
                class="ledger__tab"
                :title="t('pages.quests.questsList.guide.title')"
              >{{ (guidePage(q) ?? 0) + 1 }}</span>
            </button>
          </section>
        </div>
      </div>
    </Transition>

    <Transition name="ledger-fade">
      <div
        v-if="sheetOpen"
        class="ledger__scrim"
        @click="sheetOpen = false"
      />
    </Transition>
    <Transition name="ledger-sheet">
      <div
        v-if="sheetOpen"
        class="ledger__sheet"
        role="dialog"
        :aria-label="t('pages.quests.questsList.guide.title')"
      >
        <h3 class="ledger__sheet-title">
          <guide-icon
            name="book"
            :size="18"
          />
          {{ t('pages.quests.questsList.guide.title') }}
        </h3>
        <guide-file-card />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { GuideFileCard, GuideIcon } from '@/features/guide';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import { useQuestStore } from '@/stores/quests/useQuestStore';
import { useGuideStore } from '@/stores/guide/useGuideStore';
import type { QuestJournalEntry } from '@/stores/quests/lib/types';
import { pushBackHandler } from '@/shared/lib/composables/useBackGuard';
import { QUESTLINE_COLOR, groupByQuestline, questLabel } from '../lib/questlines';
import QuestDetail from '../ui/quest-detail/QuestDetail.vue';

type Filter = 'active' | 'misc' | 'done';
const FILTERS: Filter[] = ['active', 'misc', 'done'];

const { t } = useI18n();
const questStore = useQuestStore();
const wsStore = useWebSocketStore();
const guide = useGuideStore();
const { quests } = storeToRefs(questStore);
const { isConnected } = storeToRefs(wsStore);
const { status: guideStatus, reader } = storeToRefs(guide);

const filter = ref<Filter>('active');
const openId = ref<string | null>(null);
const sheetOpen = ref(false);

const inFilter = (q: QuestJournalEntry, f: Filter): boolean => {
  if (f === 'misc') return q.isMisc;
  if (f === 'done') return !q.isMisc && q.isCompleted;
  return !q.isMisc && !q.isCompleted;
};

const counts = computed(() => {
  const c: Record<Filter, number> = { active: 0, misc: 0, done: 0 };
  for (const q of quests.value) for (const f of FILTERS) if (inFilter(q, f)) c[f]++;
  return c;
});

const groups = computed(() => groupByQuestline(quests.value.filter((q) => inFilter(q, filter.value))));

const openQuest = computed(() => quests.value.find((q) => q.formId === openId.value) ?? null);

// The quest left the journal (finished misc task, new save): back to list.
watch(openQuest, (q) => {
  if (!q && openId.value && quests.value.length) openId.value = null;
});

/** Guide page from a bookmark or the player's link (cheap; no text search). */
function guidePage(q: QuestJournalEntry): number | null {
  if (guideStatus.value !== 'ready') return null;
  return guide.matchFor(q, false)?.page ?? null;
}

function onGuideButton(): void {
  if (guideStatus.value === 'ready') guide.openReader();
  else sheetOpen.value = true;
}

// A guide was picked in the sheet: close it.
watch(guideStatus, (s) => {
  if (s === 'ready') sheetOpen.value = false;
});

function toggleQuestActive(formId: string): void {
  const quest = quests.value.find((q) => q.formId === formId);
  if (!quest) return;
  wsStore.sendCommand({ command: 'quest_set_active', formId, active: !quest.isActive });
}

// System back closes the sheet or the quest page while this tab shows.
let removeBack: (() => void) | null = null;
function onBack(): boolean {
  if (reader.value.open) return false;
  if (sheetOpen.value) {
    sheetOpen.value = false;
    return true;
  }
  if (openId.value) {
    openId.value = null;
    return true;
  }
  return false;
}
const attachBack = () => {
  removeBack ??= pushBackHandler(onBack);
};
const detachBack = () => {
  removeBack?.();
  removeBack = null;
};

onMounted(() => {
  void guide.init();
  attachBack();
});
onActivated(attachBack);
onDeactivated(detachBack);
onBeforeUnmount(detachBack);
</script>

<style scoped lang="scss">
.ledger {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ledger__view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ledger__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 0 8px;
}

.ledger__filters {
  flex: 1;
  display: flex;
  padding: 2px;
  border: 1px solid var(--skyrim-border-dark);
  border-radius: 18px;
  background: var(--skyrim-bg-dark);
}

.ledger__filter {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 4px;
  border: 0;
  border-radius: 16px;
  background: none;
  color: var(--skyrim-text-secondary);
  font-family: var(--font-heading, serif);
  font-size: 13px;
  letter-spacing: 0.04em;

  &--on {
    background: var(--skyrim-bg-light);
    color: var(--skyrim-text-accent);
    box-shadow: 0 0 0 1px var(--skyrim-border-medium);
  }
}

.ledger__count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgb(255 255 255 / 7%);
  color: var(--skyrim-text-secondary);
  font-family: system-ui, sans-serif;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.ledger__guide {
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 36px;
  flex-shrink: 0;
  border: 1px solid var(--skyrim-accent-main-dim);
  border-radius: 6px;
  background:
    linear-gradient(160deg, rgb(201 162 39 / 22%), rgb(201 162 39 / 6%));
  color: var(--skyrim-accent-main-light, #e5c44d);

  &--off {
    border-color: var(--skyrim-border-medium);
    background: none;
    color: var(--skyrim-text-secondary);

    &::after {
      content: '+';
      position: absolute;
      top: 2px;
      right: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--skyrim-accent-main);
      color: #1a1408;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      font-weight: 700;
      line-height: 14px;
      text-align: center;
    }
  }
}

.ledger__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 8px;
}

.ledger__empty {
  margin: 24px 12px;
  color: var(--skyrim-text-secondary);
  font-size: var(--font-size-sm);
  text-align: center;
}

.ledger__group {
  margin-bottom: 6px;
}

.ledger__line {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 6px 8px 4px 12px;
  background: linear-gradient(var(--skyrim-bg-medium) 70%, transparent);
  color: var(--line-color);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 6px;
    height: 2px;
    background: var(--line-color);
  }
}

.ledger__line-count {
  color: var(--skyrim-text-dim);
  font-family: system-ui, sans-serif;
  letter-spacing: 0;
}

.ledger__row {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 0 6px 12px;
  border: 0;
  border-left: 2px solid transparent;
  background: none;
  color: var(--skyrim-text-primary);
  text-align: left;

  &:active,
  &:focus-visible {
    border-left-color: var(--line-color);
    background: linear-gradient(90deg, rgb(255 255 255 / 6%), transparent);
  }

  &--done .ledger__name {
    color: var(--skyrim-text-dim);
    text-decoration: line-through;
    text-decoration-color: rgb(255 255 255 / 15%);
  }
}

.ledger__track {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border: 1px solid var(--skyrim-text-dim);
  border-radius: 50%;

  &--on {
    border-color: var(--skyrim-text-accent);
    background: var(--skyrim-text-accent);
    box-shadow: 0 0 6px var(--skyrim-border-glow);
  }
}

.ledger__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-heading, serif);
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ledger__tab {
  flex-shrink: 0;
  min-width: 34px;
  padding: 3px 7px 3px 9px;
  border-radius: 3px 0 0 3px;
  background: linear-gradient(90deg, #cfbf98, #e2d5b3);
  color: #3a3020;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
  box-shadow: -1px 1px 3px rgb(0 0 0 / 45%);
}

.ledger__scrim {
  position: absolute;
  inset: 0;
  z-index: 4;
  background: rgb(0 0 0 / 55%);
}

.ledger__sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 14px 18px;
  border-top: 1px solid var(--skyrim-accent-main-dim);
  border-radius: 10px 10px 0 0;
  background: var(--skyrim-bg-medium);
  box-shadow: 0 -8px 24px rgb(0 0 0 / 60%);
}

.ledger__sheet-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--skyrim-text-accent);
  font-family: var(--font-heading, serif);
  font-size: 16px;
  font-weight: 400;

  :deep(svg) {
    color: var(--skyrim-accent-main);
  }
}

.ledger-in-enter-active,
.ledger-in-leave-active,
.ledger-out-enter-active,
.ledger-out-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.ledger-in-enter-from {
  opacity: 0;
  transform: translateX(18px);
}

.ledger-in-leave-to {
  opacity: 0;
  transform: translateX(-18px);
}

.ledger-out-enter-from {
  opacity: 0;
  transform: translateX(-18px);
}

.ledger-out-leave-to {
  opacity: 0;
  transform: translateX(18px);
}

.ledger-fade-enter-active,
.ledger-fade-leave-active {
  transition: opacity 0.18s ease;
}

.ledger-fade-enter-from,
.ledger-fade-leave-to {
  opacity: 0;
}

.ledger-sheet-enter-active,
.ledger-sheet-leave-active {
  transition: transform 0.2s ease;
}

.ledger-sheet-enter-from,
.ledger-sheet-leave-to {
  transform: translateY(100%);
}
</style>
