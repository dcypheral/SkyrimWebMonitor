<template>
  <div
    class="quick-picker"
    role="listbox"
    :aria-label="title"
  >
    <div class="quick-picker__title">
      {{ title }}
    </div>
    <div
      v-if="items.length"
      class="quick-picker__strip"
    >
      <button
        v-for="item in items"
        :key="item.formId"
        type="button"
        role="option"
        class="quick-picker__option"
        :class="{ 'quick-picker__option--active': item.isEquipped }"
        :aria-selected="item.isEquipped"
        @click="emit('select', item.formId)"
      >
        <span class="quick-picker__stage">
          <item-thumbnail
            :fallback-icon-path="fallbackIcon"
            :model-path="item.modelPath"
            :keywords="item.keywords"
            framing="diagonal"
            :size="40"
          />
          <span
            v-if="showCount"
            class="quick-picker__count"
          >{{ item.count }}</span>
        </span>
        <span class="quick-picker__name">{{ shortName(item.name) }}</span>
        <span class="quick-picker__damage">{{ Math.round(item.damage) }}</span>
      </button>
    </div>
    <p
      v-else
      class="quick-picker__empty"
    >
      {{ emptyText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ItemThumbnail } from '@/entities/ui/icons';
import type { AmmoItem, WeaponItem } from '@/stores/inventory/lib/types';

defineProps<{
  title: string;
  items: ReadonlyArray<WeaponItem | AmmoItem>;
  fallbackIcon: string;
  emptyText: string;
  showCount?: boolean;
}>();

const emit = defineEmits<{ select: [formId: string] }>();

/** "Ebony Arrow" → "Ebony": the category is already clear from the slot. */
function shortName(name: string): string {
  const trimmed = name.replace(/\s+(Arrows?|Bolts?|Bow)$/i, '').trim();
  return trimmed.length > 0 ? trimmed : name;
}
</script>

<style scoped lang="scss">
.quick-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: rgb(10 10 10 / 88%);
  border: var(--border-thin) solid var(--skyrim-border-accent);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-medium);
  backdrop-filter: blur(3px);
  animation: quick-picker-in var(--transition-fast, 150ms) ease-out;
}

.quick-picker__title {
  padding: 0 4px;
  font-family: var(--font-heading);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--skyrim-text-accent);
}

.quick-picker__strip {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.quick-picker__option {
  display: flex;
  flex: 0 0 54px;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 2px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--skyrim-text-secondary);
  font-family: var(--font-body);
  cursor: pointer;
  scroll-snap-align: start;
  touch-action: manipulation;

  &:active {
    background: rgb(255 255 255 / 6%);
  }

  &--active {
    border-color: var(--skyrim-border-accent);
    background: rgb(232 212 154 / 8%);
    color: var(--skyrim-text-primary);
  }
}

.quick-picker__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: radial-gradient(circle, rgb(70 62 46 / 70%), transparent 70%);
  border-radius: 50%;
}

.quick-picker__count {
  position: absolute;
  right: -6px;
  bottom: -2px;
  padding: 0 4px;
  background: rgb(10 10 10 / 90%);
  border-radius: 999px;
  font-family: var(--font-heading);
  font-size: 0.6rem;
  font-variant-numeric: tabular-nums;
  color: var(--skyrim-text-primary);
}

.quick-picker__name {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  font-size: 0.66rem;
  line-height: 1.15;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.quick-picker__damage {
  font-family: var(--font-heading);
  font-size: 0.58rem;
  color: var(--skyrim-text-dim);

  &::before {
    content: '⚔ ';
  }
}

.quick-picker__empty {
  margin: 0;
  padding: 6px;
  font-size: var(--font-size-xs);
  color: var(--skyrim-text-dim);
}

@keyframes quick-picker-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
