<template>
  <div class="modal-content shout-picker">
    <div
      class="shout-picker__tabs"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        class="shout-picker__tab"
        :class="{ 'shout-picker__tab--active': tab === 'shouts' }"
        :aria-selected="tab === 'shouts'"
        @click="tab = 'shouts'"
      >
        {{ t('pages.home.voice.shouts') }}
      </button>
      <button
        type="button"
        role="tab"
        class="shout-picker__tab"
        :class="{ 'shout-picker__tab--active': tab === 'powers' }"
        :aria-selected="tab === 'powers'"
        @click="tab = 'powers'"
      >
        {{ t('pages.home.voice.powers') }}
      </button>
    </div>

    <template v-if="tab === 'shouts'">
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
    </template>

    <template v-else>
      <p
        v-if="powers.length === 0"
        class="text-sm text-secondary m-0"
      >
        {{ t('pages.spellbook.noPowers') }}
      </p>
      <ul
        v-else
        class="shout-picker__list"
      >
        <li
          v-for="power in powers"
          :key="power.formId"
        >
          <button
            type="button"
            class="shout-picker__row"
            :class="{ 'shout-picker__row--equipped': power.isEquipped }"
            :aria-pressed="power.isEquipped"
            @click="emit('selectPower', power.formId)"
          >
            <span class="shout-picker__name">{{ power.name }}</span>
            <span class="shout-picker__kind">
              {{ power.spellType === 'Power' ? t('pages.spellbook.greater') : t('pages.spellbook.lesser') }}
            </span>
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PowerItem, ShoutItem } from '@/stores/magic/lib/types';

const props = withDefaults(
  defineProps<{ shouts: ShoutItem[]; powers?: PowerItem[]; initialTab?: 'shouts' | 'powers' }>(),
  { powers: () => [], initialTab: 'shouts' },
);
const emit = defineEmits<{ select: [formId: string]; selectPower: [formId: string] }>();
const { t } = useI18n();
const tab = ref<'shouts' | 'powers'>(props.initialTab);
</script>

<style scoped lang="scss">
.shout-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: min(340px, 86vw);
}

.shout-picker__tabs {
  display: flex;
  border-bottom: 1px solid var(--skyrim-border-dark);
}

.shout-picker__tab {
  flex: 1;
  padding: 6px 0 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--skyrim-text-secondary);
  font-family: var(--font-heading);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;

  &--active {
    border-bottom-color: var(--skyrim-accent-main);
    color: var(--skyrim-text-primary);
  }
}

.shout-picker__kind {
  font-size: 0.66rem;
  color: var(--skyrim-text-dim);
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
