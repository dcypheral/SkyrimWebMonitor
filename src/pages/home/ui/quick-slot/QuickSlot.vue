<template>
  <button
    type="button"
    class="quick-slot"
    :class="{
      'quick-slot--active': active,
      'quick-slot--open': open,
      'quick-slot--empty': !item,
    }"
    :aria-label="item ? `${label}: ${item.name}` : label"
    :aria-expanded="open"
    @pointerdown="press.onPointerDown"
    @pointermove="press.onPointerMove"
    @pointerup="press.onPointerUp"
    @pointercancel="press.onPointerCancel"
    @pointerleave="press.onPointerCancel"
    @click="press.onClick"
    @contextmenu.prevent
  >
    <item-thumbnail
      v-if="item"
      :fallback-icon-path="fallbackIcon"
      :model-path="item.modelPath"
      :keywords="item.keywords"
      framing="diagonal"
      :size="38"
    />
    <base-icon
      v-else
      :icon-path="fallbackIcon"
      :size="22"
      background-color="var(--skyrim-text-dim)"
    />
    <span
      v-if="count !== null"
      class="quick-slot__count"
    >{{ count > 999 ? '999+' : count }}</span>
  </button>
</template>

<script setup lang="ts">
import { BaseIcon } from '@/shared/ui';
import { ItemThumbnail } from '@/entities/ui/icons';
import { useLongPress } from '@/shared/lib/composables/useLongPress';
import type { AmmoItem, WeaponItem } from '@/stores/inventory/lib/types';

withDefaults(
  defineProps<{
    item: WeaponItem | AmmoItem | null;
    label: string;
    fallbackIcon: string;
    /** Lit ring: the item is equipped right now. */
    active?: boolean;
    /** Its picker is showing. */
    open?: boolean;
    count?: number | null;
  }>(),
  { active: false, open: false, count: null },
);

const emit = defineEmits<{ tap: []; hold: [] }>();
const press = useLongPress(
  () => emit('tap'),
  () => emit('hold'),
);
</script>

<style scoped lang="scss">
.quick-slot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  background: radial-gradient(circle at 50% 40%, rgb(60 54 42 / 95%), rgb(12 11 9 / 92%) 72%);
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: 50%;
  box-shadow: var(--shadow-medium);
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-touch-callout: none;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  &:active {
    transform: scale(0.93);
  }

  &--active {
    border-color: var(--skyrim-border-accent);
    box-shadow: var(--shadow-medium), 0 0 10px var(--skyrim-border-glow);
  }

  &--open {
    border-color: var(--skyrim-text-accent);
  }

  &--empty {
    opacity: 0.75;
  }

  :deep(.item-thumbnail) {
    opacity: 0.55;
    filter: grayscale(0.6);
  }

  &--active :deep(.item-thumbnail) {
    opacity: 1;
    filter: none;
  }
}

.quick-slot__count {
  position: absolute;
  right: -4px;
  bottom: -3px;
  min-width: 20px;
  padding: 1px 5px;
  background: rgb(10 10 10 / 90%);
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 999px;
  font-family: var(--font-heading);
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  color: var(--skyrim-text-primary);
}
</style>
