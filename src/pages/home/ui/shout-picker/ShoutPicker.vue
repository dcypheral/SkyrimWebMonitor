<template>
  <div class="modal-content shout-picker">
    <h3 class="modal-title text-base m-0">{{ t('pages.home.shoutPickerTitle') }}</h3>
    <p
      v-if="shouts.length === 0"
      class="text-sm text-secondary m-0"
    >
      {{ t('pages.home.noShouts') }}
    </p>
    <ul
      v-else
      class="shout-picker__list"
    >
      <li
        v-for="shout in shouts"
        :key="shout.formId"
      >
        <button
          type="button"
          class="shout-picker__row"
          :class="{ 'shout-picker__row--equipped': shout.isEquipped }"
          :aria-pressed="shout.isEquipped"
          @click="emit('select', shout.formId)"
        >
          <span class="shout-picker__name">{{ shout.name }}</span>
          <span class="shout-picker__words">
            <span
              v-for="(word, i) in shout.words"
              :key="word.formId || i"
              class="shout-picker__word"
              :class="{ 'shout-picker__word--known': word.isKnown }"
            >{{ word.isKnown ? word.name : '' }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ShoutItem } from '@/stores/magic/lib/types';

defineProps<{ shouts: ShoutItem[] }>();
const emit = defineEmits<{ select: [formId: string] }>();
const { t } = useI18n();
</script>

<style scoped lang="scss">
.shout-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: min(340px, 86vw);
}

.shout-picker__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  max-height: 60vh;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.shout-picker__row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  min-height: 48px;
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: var(--border-thin) solid var(--skyrim-border-dark);
  border-radius: var(--radius-lg);
  color: var(--skyrim-text-secondary);
  text-align: left;
  cursor: pointer;

  &:active {
    background: var(--bg-accent-soft);
  }

  &--equipped {
    border-color: var(--skyrim-accent-main);
    background: var(--bg-accent-soft);
    color: var(--skyrim-text-primary);
  }
}

.shout-picker__name {
  font-family: var(--font-heading);
  font-size: var(--font-size-base);
}

.shout-picker__words {
  display: flex;
  gap: var(--spacing-sm);
}

.shout-picker__word {
  min-width: 18px;
  padding: 0 4px;
  border-bottom: 2px solid var(--skyrim-border-medium);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  color: var(--skyrim-text-dim);

  &--known {
    border-color: var(--skyrim-accent-main);
    color: var(--skyrim-text-accent);
  }
}
</style>
