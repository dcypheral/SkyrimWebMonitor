<template>
  <button
    type="button"
    class="tile"
    :class="{
      'tile--active': active,
      'tile--equipped': equipped,
      'tile--stolen': item.isStolen,
    }"
    :style="{ '--tile-glow': material.color }"
    :aria-label="ariaLabel"
    :aria-pressed="active"
    @pointerdown="press.onPointerDown"
    @pointermove="press.onPointerMove"
    @pointerup="press.onPointerUp"
    @pointercancel="press.onPointerCancel"
    @pointerleave="press.onPointerCancel"
    @click="press.onClick"
    @contextmenu.prevent
  >
    <span class="tile__stage">
      <item-thumbnail
        :fallback-icon-path="fallbackIcon"
        :model-path="item.modelPath"
        :keywords="item.keywords"
        :enchanted="enchanted"
        :framing="framing"
        :size="thumbSize"
      />
    </span>
    <span class="tile__name">{{ item.name }}</span>
    <span
      v-if="item.count > 1"
      class="tile__count"
    >{{ item.count }}</span>
    <span
      v-if="item.isFavorite"
      class="tile__favorite"
      aria-hidden="true"
    >★</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ItemThumbnail } from '@/entities/ui/icons';
import { getItemMaterial } from '@/shared/lib/constants/itemMaterials';
import { useLongPress } from '@/shared/lib/composables/useLongPress';
import {
  getItemFallbackIcon,
  getItemFraming,
  isItemEnchanted,
  isItemEquipped,
} from '@/shared/lib/utils/itemVisual';
import type { InventoryItem } from '@/stores/inventory/lib/types';

const props = withDefaults(
  defineProps<{
    item: InventoryItem;
    active?: boolean;
    thumbSize?: number;
  }>(),
  { active: false, thumbSize: 56 },
);

const emit = defineEmits<{
  select: [];
  menu: [];
}>();

const fallbackIcon = computed(() => getItemFallbackIcon(props.item));
const framing = computed(() => getItemFraming(props.item));
const equipped = computed(() => isItemEquipped(props.item));
const enchanted = computed(() => isItemEnchanted(props.item));
const material = computed(() => getItemMaterial(props.item.keywords));
const ariaLabel = computed(() =>
  props.item.count > 1 ? `${props.item.name} ×${props.item.count}` : props.item.name,
);

const press = useLongPress(
  () => emit('select'),
  () => emit('menu'),
);
</script>

<style scoped lang="scss">
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  padding: 4px 3px;
  background: transparent;
  border: var(--border-thin) solid transparent;
  border-radius: var(--radius-lg);
  color: var(--skyrim-text-secondary);
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-touch-callout: none;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);

  &:active {
    transform: scale(0.96);
  }

  &--active {
    background: var(--bg-accent-soft);
    border-color: var(--skyrim-accent-main-dim);
    color: var(--skyrim-text-primary);
  }
}

/* Backdrop that lifts dark models off the dark UI: soft light pool tinted by
   the item's material, plus a faint vignette ring. */
.tile__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  max-width: 76px;
  background:
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--tile-glow) 22%, transparent) 0%, transparent 62%),
    radial-gradient(circle at 50% 50%, rgb(255 255 255 / 7%) 0%, rgb(0 0 0 / 35%) 100%);
  border: var(--border-thin) solid var(--skyrim-border-dark);
  border-radius: 50%;
  box-shadow: inset 0 2px 6px rgb(0 0 0 / 55%);

  .tile--active & {
    border-color: var(--skyrim-accent-main-dim);
  }

  /* Equipped: a lit ring, readable at a glance without extra badges. */
  .tile--equipped & {
    border-color: var(--skyrim-accent-main);
    box-shadow:
      inset 0 2px 6px rgb(0 0 0 / 55%),
      0 0 0 2px color-mix(in srgb, var(--skyrim-accent-main) 35%, transparent),
      0 0 10px var(--skyrim-border-glow);
  }

  :deep(.item-thumbnail) {
    width: 82%;
    height: 82%;
  }
}

.tile__name {
  display: -webkit-box;
  width: 100%;
  overflow: hidden;
  font-family: var(--font-body);
  font-size: 0.72rem;
  line-height: 1.12;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;

  .tile--stolen & {
    color: var(--color-danger-light);
  }
}

.tile__count {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 20px;
  padding: 1px 5px;
  background: rgb(0 0 0 / 70%);
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: 999px;
  font-family: var(--font-heading);
  font-size: 0.65rem;
  color: var(--skyrim-text-accent);
}

.tile__favorite {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 0.8rem;
  color: var(--skyrim-accent-main);
  text-shadow: 0 1px 2px #000;
}

</style>
