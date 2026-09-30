<template>
  <div class="modal-content action-menu">
    <header class="action-menu__header">
      <item-thumbnail
        :fallback-icon-path="fallbackIcon"
        :model-path="item.modelPath"
        :keywords="item.keywords"
        :enchanted="enchanted"
        :framing="framing"
        :size="72"
      />
      <div class="action-menu__title">
        <span class="action-menu__name">{{ item.name }}</span>
        <span class="action-menu__meta">
          <template v-if="item.count > 1">×{{ item.count }} · </template>{{ t('shared.ui.itemMenu.valueWeight', { value: item.value, weight: formatWeight(item.weight) }) }}
        </span>
      </div>
    </header>

    <div class="action-menu__actions">
      <button
        type="button"
        class="action-menu__action action-menu__action--primary"
        @click="emit('action', 'activate')"
      >
        <base-icon
          :icon-path="primaryIcon"
          :size="22"
        />
        <span>{{ primaryLabel }}</span>
      </button>
      <button
        type="button"
        class="action-menu__action"
        @click="emit('action', 'favorite')"
      >
        <base-icon
          icon-path="delapouite/round-star.svg"
          :size="22"
          :background-color="item.isFavorite ? 'var(--skyrim-accent-main)' : 'var(--skyrim-text-secondary)'"
        />
        <span>{{ item.isFavorite ? t('shared.ui.itemMenu.unfavorite') : t('shared.ui.itemMenu.favorite') }}</span>
      </button>
      <button
        type="button"
        class="action-menu__action"
        @click="emit('action', 'hotkey')"
      >
        <base-icon
          icon-path="delapouite/keyboard.svg"
          :size="22"
        />
        <span>{{ t('shared.ui.itemMenu.hotkey') }}</span>
      </button>
      <button
        type="button"
        class="action-menu__action action-menu__action--danger"
        @click="emit('action', 'drop')"
      >
        <base-icon
          icon-path="delapouite/trash-can.svg"
          :size="22"
          background-color="var(--color-danger-light)"
        />
        <span>{{ t('shared.ui.itemMenu.drop') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { ItemThumbnail } from '@/entities/ui/icons';
import {
  getItemFallbackIcon,
  getItemFraming,
  isItemEnchanted,
  isItemEquipped,
} from '@/shared/lib/utils/itemVisual';
import type { InventoryItem } from '@/stores/inventory/lib/types';
import type { ItemMenuAction } from './types';

const props = defineProps<{ item: InventoryItem }>();
const emit = defineEmits<{ action: [action: ItemMenuAction] }>();
const { t } = useI18n();

const fallbackIcon = computed(() => getItemFallbackIcon(props.item));
const framing = computed(() => getItemFraming(props.item));
const enchanted = computed(() => isItemEnchanted(props.item));

const EQUIPPABLE = new Set(['Weapon', 'Apparel', 'Ammo']);
const primaryLabel = computed(() => {
  const c = props.item.categoryType;
  if (EQUIPPABLE.has(c)) {
    return isItemEquipped(props.item) ? t('shared.ui.itemMenu.unequip') : t('shared.ui.itemMenu.equip');
  }
  if (c === 'Book') return t('shared.ui.itemMenu.read');
  if (c === 'Potion' || c === 'Food' || c === 'Ingredient') return t('shared.ui.itemMenu.consume');
  return t('shared.ui.itemMenu.use');
});
const primaryIcon = computed(() => {
  const c = props.item.categoryType;
  if (EQUIPPABLE.has(c)) return 'sbed/hand.svg';
  if (c === 'Book') return 'lorc/open-book.svg';
  return 'lorc/potion-ball.svg';
});

function formatWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}
</script>

<style scoped lang="scss">
.action-menu {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: min(320px, 86vw);
}

.action-menu__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.action-menu__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.action-menu__name {
  font-family: var(--font-heading);
  font-size: var(--font-size-lg);
  color: var(--skyrim-text-primary);
}

.action-menu__meta {
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-secondary);
}

.action-menu__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.action-menu__action {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 52px;
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgb(255 255 255 / 3%);
  border: var(--border-thin) solid var(--skyrim-border-dark);
  border-radius: var(--radius-lg);
  font-family: var(--font-heading);
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-primary);
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;

  &:active {
    background: var(--bg-accent-soft);
  }

  &--primary {
    grid-column: 1 / -1;
    justify-content: center;
    border-color: var(--skyrim-accent-main-dim);
    background: var(--bg-accent-faint);
  }

  &--danger span {
    color: var(--color-danger-light);
  }
}
</style>
