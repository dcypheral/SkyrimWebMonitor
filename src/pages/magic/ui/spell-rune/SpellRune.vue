<template>
  <button
    type="button"
    class="rune"
    :class="{ 'rune--active': active, 'rune--equipped': !!hand }"
    :style="{ '--rune-color': color }"
    :aria-pressed="active"
    :aria-label="name"
    @click="emit('select')"
  >
    <span class="rune__disc">
      <base-icon
        :icon-path="icon"
        :size="26"
        :background-color="color"
      />
      <span
        v-if="hand"
        class="rune__hand"
      >{{ handLabel }}</span>
      <span
        v-if="isFavorite"
        class="rune__fav"
        aria-hidden="true"
      >★</span>
      <span
        v-if="hotkey"
        class="rune__hotkey"
      >{{ hotkey }}</span>
    </span>
    <span class="rune__name">{{ name }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';

const props = withDefaults(
  defineProps<{
    name: string;
    icon: string;
    color: string;
    /** Equipped hand(s), or 'voice' for the power/shout slot. */
    hand?: 'left' | 'right' | 'both' | 'voice' | null;
    isFavorite?: boolean;
    hotkey?: number | null;
    active?: boolean;
  }>(),
  { hand: null, isFavorite: false, hotkey: null, active: false },
);

const emit = defineEmits<{ select: [] }>();
const { t } = useI18n();

const handLabel = computed(() => {
  switch (props.hand) {
    case 'left':
      return t('pages.spellbook.handShort.left');
    case 'right':
      return t('pages.spellbook.handShort.right');
    case 'both':
      return t('pages.spellbook.handShort.both');
    case 'voice':
      return '◆';
    default:
      return '';
  }
});
</script>

<style scoped lang="scss">
.rune {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  padding: 4px 2px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--skyrim-text-secondary);
  font-family: var(--font-body);
  cursor: pointer;
  touch-action: manipulation;

  &:active {
    transform: scale(0.96);
  }

  &--active {
    background: rgb(255 255 255 / 5%);
    border-color: color-mix(in srgb, var(--rune-color) 45%, transparent);
    color: var(--skyrim-text-primary);
  }
}

/* A glowing sigil: dark disc, coloured ring, soft inner light. */
.rune__disc {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  background:
    radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--rune-color) 22%, transparent), transparent 65%),
    radial-gradient(circle, rgb(20 18 15), rgb(8 8 8));
  border: 1px solid color-mix(in srgb, var(--rune-color) 45%, #222);
  border-radius: 50%;
  box-shadow: inset 0 0 8px rgb(0 0 0 / 70%);

  .rune--equipped & {
    border-color: var(--rune-color);
    box-shadow:
      inset 0 0 8px rgb(0 0 0 / 70%),
      0 0 10px color-mix(in srgb, var(--rune-color) 55%, transparent);
  }
}

.rune__hand,
.rune__hotkey {
  position: absolute;
  bottom: -3px;
  min-width: 16px;
  padding: 0 4px;
  background: rgb(10 10 10 / 92%);
  border: 1px solid var(--rune-color);
  border-radius: 999px;
  font-family: var(--font-heading);
  font-size: 0.56rem;
  line-height: 1.4;
  color: var(--rune-color);
}

.rune__hand {
  left: -3px;
}

.rune__hotkey {
  right: -3px;
  border-color: var(--skyrim-border-medium);
  color: var(--skyrim-text-primary);
}

.rune__fav {
  position: absolute;
  top: -3px;
  right: 0;
  font-size: 0.72rem;
  color: var(--skyrim-accent-main);
  text-shadow: 0 1px 2px #000;
}

.rune__name {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  font-size: 0.66rem;
  line-height: 1.15;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>
