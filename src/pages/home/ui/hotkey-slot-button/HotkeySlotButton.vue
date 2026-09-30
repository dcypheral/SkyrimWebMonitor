<template>
  <button
    type="button"
    class="slot"
    :class="{ 'slot--empty': !entry.bound, 'slot--spell': isSpell }"
    :aria-label="ariaLabel"
    @pointerdown="press.onPointerDown"
    @pointermove="press.onPointerMove"
    @pointerup="press.onPointerUp"
    @pointercancel="press.onPointerCancel"
    @pointerleave="press.onPointerCancel"
    @click="press.onClick"
    @contextmenu.prevent
  >
    <span class="slot__number">{{ entry.slot }}</span>
    <base-icon
      v-if="iconPath"
      class="slot__icon"
      :icon-path="iconPath"
      :size="iconSize"
      :background-color="iconColor"
    />
    <span
      v-if="entry.bound"
      class="slot__name"
    >{{ entry.name }}</span>
    <span
      v-if="count !== null"
      class="slot__count"
    >×{{ count }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { getHotkeyIconPath } from '@/shared/lib/utils/hotkeyIcons';
import type { HotkeySlotEntry } from '@/stores/hotkeys/lib/types';
import { useLongPress } from '../../composables/useLongPress';

const props = withDefaults(
  defineProps<{
    entry: HotkeySlotEntry;
    iconSize?: number;
  }>(),
  { iconSize: 30 },
);

const emit = defineEmits<{
  trigger: [];
  details: [];
}>();

const { t } = useI18n();

const iconPath = computed(() => getHotkeyIconPath(props.entry));
const isSpell = computed(() => props.entry.bound && props.entry.kind === 'spell');
const iconColor = computed(() =>
  isSpell.value ? 'var(--home-spell-color)' : 'var(--skyrim-text-accent)',
);
const count = computed(() => {
  const e = props.entry;
  if (!e.bound || e.kind !== 'item') return null;
  return e.count > 1 ? e.count : null;
});
const ariaLabel = computed(() => {
  const slot = t('pages.home.hotkeySlot', { slot: props.entry.slot });
  return props.entry.bound ? `${slot}: ${props.entry.name}` : `${slot}: ${t('pages.home.hotkeyEmpty')}`;
});

const press = useLongPress(
  () => {
    if (props.entry.bound) emit('trigger');
    else emit('details');
  },
  () => emit('details'),
);
</script>

<style scoped lang="scss">
.slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 6px 4px 4px;
  background: linear-gradient(180deg, rgb(255 255 255 / 4%), rgb(0 0 0 / 25%));
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%), var(--shadow-soft);
  color: var(--skyrim-text-primary);
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-touch-callout: none;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background-color var(--transition-fast);

  &:active {
    transform: scale(0.95);
    border-color: var(--skyrim-accent-main);
    background-color: var(--bg-accent-soft);
  }

  &--empty {
    background: transparent;
    border-style: dashed;
    border-color: var(--skyrim-border-dark);
    box-shadow: none;
  }
}

.slot__number {
  position: absolute;
  top: 3px;
  left: 6px;
  font-family: var(--font-heading);
  font-size: 0.7rem;
  line-height: 1;
  color: var(--skyrim-text-dim);

  .slot--empty & {
    position: static;
    font-size: var(--font-size-base);
  }
}

.slot__name {
  max-width: 100%;
  overflow: hidden;
  font-family: var(--font-body);
  font-size: 0.68rem;
  line-height: 1.1;
  color: var(--skyrim-text-secondary);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot__count {
  position: absolute;
  top: 3px;
  right: 6px;
  font-family: var(--font-heading);
  font-size: 0.65rem;
  line-height: 1;
  color: var(--skyrim-text-accent);
}
</style>
