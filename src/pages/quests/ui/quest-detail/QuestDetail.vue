<template>
  <article
    class="qdetail"
    :style="{ '--line-color': QUESTLINE_COLOR[line] }"
  >
    <header class="qdetail__head">
      <button
        type="button"
        class="qdetail__back"
        :aria-label="t('pages.quests.questsList.back')"
        @click="emit('back')"
      >
        <guide-icon name="back" />
      </button>
      <div class="qdetail__titles">
        <span class="qdetail__line">{{ t(`pages.quests.questsList.lines.${line}`) }}</span>
        <h2 class="qdetail__name">
          {{ label }}
        </h2>
      </div>
      <button
        v-if="!quest.isCompleted"
        type="button"
        class="qdetail__track"
        :class="{ 'qdetail__track--on': quest.isActive }"
        :aria-pressed="quest.isActive"
        :disabled="!canAct"
        @click="emit('toggle-active', quest.formId)"
      >
        <span class="qdetail__track-dot" />
        {{ quest.isActive ? t('pages.quests.questsList.tracked') : t('pages.quests.questsList.track') }}
      </button>
    </header>

    <div class="qdetail__scroll">
      <quest-guide-card :quest="quest" />

      <h3 class="qdetail__sub">
        {{ t('pages.quests.questsList.objectives') }}
      </h3>
      <quest-steps-preview
        :steps="steps"
        :scrollable="false"
      />

      <p
        v-if="quest.description"
        class="qdetail__desc"
      >
        {{ quest.description }}
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { GuideIcon } from '@/features/guide';
import { QuestStepsPreview } from '@/entities/ui/quest';
import type { QuestJournalEntry } from '@/stores/quests/lib/types';
import { QUESTLINE_COLOR, questLabel, questlineOf } from '../../lib/questlines';
import QuestGuideCard from '../quest-guide-card/QuestGuideCard.vue';

const props = defineProps<{ quest: QuestJournalEntry; canAct: boolean }>();
const emit = defineEmits<{ back: []; 'toggle-active': [formId: string] }>();

const { t } = useI18n();

const line = computed(() => questlineOf(props.quest));
const label = computed(() => questLabel(props.quest));

const steps = computed(() =>
  [...props.quest.steps]
    .sort((a, b) => b.index - a.index)
    .map((step) => ({
      id: String(step.instanceId),
      text: step.text,
      indicatorCompleted: step.completed,
      indicatorFailed: step.failed,
    })),
);
</script>

<style scoped lang="scss">
.qdetail {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.qdetail__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 8px;
  border-bottom: 1px solid var(--skyrim-border-dark);
  box-shadow: inset 3px 0 0 var(--line-color);
}

.qdetail__back {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 0;
  background: none;
  color: var(--skyrim-text-secondary);
}

.qdetail__titles {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.qdetail__line {
  color: var(--line-color);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.qdetail__name {
  margin: 0;
  overflow: hidden;
  color: var(--skyrim-text-accent);
  font-family: var(--font-heading, serif);
  font-size: 18px;
  font-weight: 400;
  line-height: 1.2;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.qdetail__track {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 6px 10px;
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 14px;
  background: none;
  color: var(--skyrim-text-secondary);
  font-size: 12px;

  &--on {
    border-color: var(--skyrim-accent-main-dim);
    color: var(--skyrim-text-accent);
  }

  &:disabled {
    opacity: 0.5;
  }
}

.qdetail__track-dot {
  width: 8px;
  height: 8px;
  border: 1px solid currentcolor;
  border-radius: 50%;

  .qdetail__track--on & {
    background: var(--skyrim-text-accent);
    box-shadow: 0 0 6px var(--skyrim-border-glow);
  }
}

.qdetail__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.qdetail__sub {
  margin: 4px var(--spacing-md, 12px) 0;
  color: var(--skyrim-text-secondary);
  font-family: var(--font-heading, serif);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.qdetail__desc {
  margin: 8px var(--spacing-md, 12px) 16px;
  color: var(--skyrim-text-secondary);
  font-size: var(--font-size-sm);
  font-style: italic;
  line-height: 1.5;
}
</style>
