<template>
  <button
    type="button"
    class="shout"
    :class="{ 'shout--empty': !shout, 'shout--compact': compact }"
    :aria-label="shout ? `${t('pages.home.shout')}: ${shout.name}` : t('pages.home.noShout')"
    @click="emit('pick')"
  >
    <base-icon
      v-if="!compact"
      icon-path="lorc/shouting.svg"
      :size="18"
      :background-color="shout ? 'var(--skyrim-text-accent)' : 'var(--skyrim-text-dim)'"
    />
    <span class="shout__text">
      <span class="shout__name">{{ shout?.name ?? t('pages.home.noShout') }}</span>
      <span
        v-if="shout && shout.words.length"
        class="shout__words"
      :aria-label="t('pages.home.wordsKnown', { known: knownWords, total: shout.words.length })"
    >
      <span
        v-for="(word, i) in shout.words"
        :key="word.formId || i"
        class="shout__word"
          :class="{ 'shout__word--known': word.isKnown }"
        />
      </span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import type { ShoutItem } from '@/stores/magic/lib/types';

const props = withDefaults(
  defineProps<{
    shout: ShoutItem | null;
    /** Two-line layout (name over word marks) for narrow rows. */
    compact?: boolean;
  }>(),
  { compact: false },
);
const emit = defineEmits<{ pick: [] }>();
const { t } = useI18n();

const knownWords = computed(() => props.shout?.words.filter((w) => w.isKnown).length ?? 0);
</script>

<style scoped lang="scss">
.shout {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  min-height: 40px;
  padding: 6px 12px 6px 10px;
  background: rgb(10 10 10 / 82%);
  border: var(--border-thin) solid var(--skyrim-border-accent);
  border-radius: 999px;
  box-shadow: var(--shadow-medium), 0 0 12px var(--skyrim-border-glow);
  color: var(--skyrim-text-primary);
  cursor: pointer;
  touch-action: manipulation;
  backdrop-filter: blur(2px);
  transition: transform var(--transition-fast);

  &:active {
    transform: scale(0.96);
  }

  &--empty {
    border-color: var(--skyrim-border-medium);
    box-shadow: var(--shadow-soft);
  }
}

.shout__text {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  .shout--compact & {
    flex-direction: column;
    gap: 3px;
  }
}

.shout--compact {
  min-height: 44px;
  padding: 4px 12px 5px;

  .shout__name {
    max-width: 100%;
    font-size: 0.78rem;
    line-height: 1.1;
  }
}

.shout__name {
  overflow: hidden;
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;

  .shout--empty & {
    color: var(--skyrim-text-dim);
  }
}

.shout__words {
  display: inline-flex;
  gap: 3px;
}

.shout__word {
  width: 6px;
  height: 6px;
  border: 1px solid var(--skyrim-text-dim);
  transform: rotate(45deg);

  &--known {
    background: var(--skyrim-accent-main);
    border-color: var(--skyrim-accent-main);
  }
}
</style>
