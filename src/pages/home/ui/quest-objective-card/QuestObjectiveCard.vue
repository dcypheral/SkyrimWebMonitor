<template>
  <section class="quest-card">
    <button
      v-if="total > 1"
      type="button"
      class="quest-card__nav"
      :aria-label="t('pages.home.prevQuest')"
      @click="emit('cycle', -1)"
    >
      ‹
    </button>

    <button
      type="button"
      class="quest-card__body"
      @click="emit('open')"
    >
      <template v-if="questName">
        <span class="quest-card__title">
          <span class="quest-card__diamond" />
          <span class="quest-card__quest">{{ questName }}</span>
          <span
            v-if="!isTracked"
            class="quest-card__tag"
          >{{ t('pages.home.notTracked') }}</span>
          <span
            v-if="total > 1"
            class="quest-card__counter"
          >{{ t('pages.home.questCounter', { index: index + 1, total }) }}</span>
        </span>
        <span class="quest-card__objective">{{ objective }}</span>
      </template>
      <template v-else>
        <span class="quest-card__title">
          <span class="quest-card__diamond quest-card__diamond--empty" />
          <span class="quest-card__quest">{{ t('pages.home.noQuest') }}</span>
        </span>
        <span class="quest-card__objective quest-card__objective--hint">{{ t('pages.home.noQuestHint') }}</span>
      </template>
    </button>

    <button
      v-if="total > 1"
      type="button"
      class="quest-card__nav"
      :aria-label="t('pages.home.nextQuest')"
      @click="emit('cycle', 1)"
    >
      ›
    </button>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  questName: string | null;
  objective: string | null;
  isTracked: boolean;
  index: number;
  total: number;
}>();

const emit = defineEmits<{
  open: [];
  cycle: [step: 1 | -1];
}>();

const { t } = useI18n();
</script>

<style scoped lang="scss">
.quest-card {
  display: flex;
  align-items: stretch;
  min-height: 58px;
  background: linear-gradient(180deg, rgb(255 255 255 / 3%), rgb(0 0 0 / 20%));
  border: var(--border-thin) solid var(--skyrim-border-dark);
  border-radius: var(--radius-lg);
}

.quest-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: none;
  border: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.quest-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-family: var(--font-heading);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--skyrim-text-secondary);
}

.quest-card__diamond {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  background: var(--skyrim-accent-main);
  box-shadow: 0 0 6px var(--skyrim-border-glow);
  transform: rotate(45deg);

  &--empty {
    background: transparent;
    border: 1px solid var(--skyrim-text-dim);
    box-shadow: none;
  }
}

.quest-card__quest {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quest-card__tag,
.quest-card__counter {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 0.62rem;
  color: var(--skyrim-text-dim);
}

.quest-card__tag + .quest-card__counter {
  margin-left: 6px;
}

.quest-card__objective {
  display: -webkit-box;
  overflow: hidden;
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  line-height: 1.2;
  color: var(--skyrim-text-primary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;

  &--hint {
    font-size: var(--font-size-sm);
    color: var(--skyrim-text-dim);
  }
}

.quest-card__nav {
  flex-shrink: 0;
  width: 36px;
  background: none;
  border: none;
  color: var(--skyrim-text-secondary);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;

  &:active {
    color: var(--skyrim-accent-main);
  }
}
</style>
