<template>
  <div
    class="inventory-list"
    :class="{ 'inventory-list--preview-closed': !previewOpen }"
  >
    <div class="list-wrapper">
      <div
        class="list"
        :class="{ 'list--grid': layout === 'grid' }"
        @scroll.passive="onListScroll"
      >
        <!-- Grid of item tiles (inventory) -->
        <inventory-grid
          v-if="layout === 'grid' && gridItems.length > 0"
          :items="gridItems"
          :model-value="modelValue"
          :sort-key="sortKey"
          :grouped="grouped && canGroup"
          @select="handleItemClick"
          @menu="openItemMenu"
        />
        <!-- Items list -->
        <template v-else-if="layout === 'list' && items && items.length > 0">
          <slot
            v-for="(item, index) in items"
            :key="item.formId || index"
            :item="item"
            :active="modelValue === item.formId"
            :on-select="() => handleItemClick(item.formId)"
          >
            <inventory-item
              v-if="'name' in item && 'isFavorite' in item"
              :name="item.name || $t('shared.ui.inventoryItem.unknown')"
              :is-favorite="item.isFavorite"
              :active="modelValue === item.formId"
              :quantity="'count' in item ? item.count : 0"
              @click="handleItemClick(item.formId)"
            />
          </slot>
        </template>

        <!-- Empty state -->
        <div
          v-else
          class="no-data"
        >
          <slot name="empty">
            {{ emptyMessage }}
          </slot>
        </div>
      </div>

      <!-- Action toolbar -->
      <div class="inventory-toolbar">
        <div class="toolbar-start">
          <button
            v-if="layout === 'grid'"
            type="button"
            class="btn toolbar-sort"
          :aria-label="$t('shared.ui.sort.title')"
          @click="openSortMenu"
        >
          <base-icon
            icon-path="delapouite/funnel.svg"
            :size="18"
          />
          <span>{{ $t(`shared.ui.sort.${sortKey}`) }}</span>
        </button>
          <slot name="toolbar-extra" />
        </div>
        <template
          v-for="(actionItem, index) in enabledActions"
          :key="index"
        >
          <div
            v-if="isActionGroup(actionItem)"
            class="d-flex gap-sm"
          >
            <button
              v-for="action in actionItem.group"
              :key="action.id"
              class="btn btn-icon toolbar-btn"
              :class="[
                action.class,
                { favorite: action.id === 'favorite' && isActiveItemFavorite },
              ]"
              :disabled="!modelValue"
              @click="handleActionClick(action.event)"
            >
              <base-icon
                :icon-path="action.icon"
                :size="20"
              />
            </button>
          </div>
          <button
            v-else
            class="btn btn-icon toolbar-btn"
            :class="[
              actionItem.class,
              {
                favorite: actionItem.id === 'favorite' && isActiveItemFavorite,
              },
            ]"
            :disabled="!modelValue"
            @click="handleActionClick(actionItem.event)"
          >
            <base-icon
              :icon-path="actionItem.icon"
              :size="20"
            />
          </button>
        </template>
      </div>
    </div>

    <!-- Handle: lowers/raises the preview (narrow screens only). -->
    <button
      v-if="activeItemData"
      type="button"
      class="preview-handle"
      :aria-expanded="previewOpen"
      :aria-label="previewOpen ? $t('shared.ui.preview.hide') : $t('shared.ui.preview.show')"
      @click="previewOpen = !previewOpen"
    >
      <span
        class="preview-handle__caret"
        :class="{ 'preview-handle__caret--up': !previewOpen }"
        aria-hidden="true"
      />
      <span
        v-if="!previewOpen"
        class="preview-handle__name"
      >{{ activeItemName }}</span>
    </button>

    <div class="item-preview">
      <slot name="preview">
        <!-- Optional preview content goes here -->
        <base-preview
          v-if="activeItem"
          :data="activeItem"
          :stats="activeItemStats"
          :effects="previewEffects"
        >
          <template #icon>
            <item-thumbnail
              v-if="activeInventoryItem"
              :fallback-icon-path="previewIconPath"
              :model-path="activeInventoryItem.modelPath"
              :keywords="activeInventoryItem.keywords"
              :framing="getItemFraming(activeInventoryItem)"
              :size="160"
              expandable
              :name="activeInventoryItem.name"
            />
            <base-icon
              v-else
              :icon-path="previewIconPath"
              :size="48"
            />
          </template>
        </base-preview>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { BaseIcon } from '@/shared/ui';
import { InventoryItem, BasePreview  } from '@/shared/ui/items';
import { ItemThumbnail } from '@/entities/ui/icons';
import { useModal } from '@/shared/lib';
import { sortKeysFor, type ItemSortKey } from '@/shared/lib/utils/itemSorting';
import { getItemFraming } from '@/shared/lib/utils/itemVisual';
import type { ItemEnchantmentEffect, ListItem } from '@/shared/lib/types';
import type { InventoryItem as InventoryItemData } from '@/stores/inventory/lib/types';
import type { PreviewStats } from '@/shared/ui/items/lib/types';
import InventoryGrid from '../inventory-grid/InventoryGrid.vue';
import ItemActionMenu from '../item-action-menu/ItemActionMenu.vue';
import type { ItemMenuAction } from '../item-action-menu/types';
import SortMenu from '../sort-menu/SortMenu.vue';
import { useInventorySort } from '../composables/useInventorySort';

interface ToolbarAction {
  id: string;
  event: string;
  icon: string;
  class?: string;
}

interface ToolbarActionGroup {
  group: ToolbarAction[];
}

type ToolbarActionItem = ToolbarAction | ToolbarActionGroup;

function isActionGroup(item: ToolbarActionItem): item is ToolbarActionGroup {
  return 'group' in item;
}

interface Props {
  modelValue?: string | null;
  items: ListItem[];
  emptyMessage?: string;
  actions?: ToolbarActionItem[];
  activeItem?: ListItem | null;
  activeItemStats?: PreviewStats[];
  previewEffects?: ItemEnchantmentEffect[];
  previewIconPath?: string;
  /** `grid` shows item tiles with sorting, grouping and a long-press menu. */
  layout?: 'list' | 'grid';
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  emptyMessage: () => '...',
  actions: () => [
    {
      group: [
        {
          id: 'favorite',
          event: 'favorite',
          icon: 'delapouite/round-star.svg',
        },
        { id: 'hotkey', event: 'hotkey', icon: 'delapouite/keyboard.svg' },
      ],
    },
    { id: 'drop', event: 'drop', icon: 'delapouite/trash-can.svg' },
  ],
  activeItem: null,
  activeItemStats: () => [],
  previewEffects: () => [],
  previewIconPath: 'lorc/cog.svg',
  layout: 'list',
});

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
  favorite: [];
  drop: [];
  hotkey: [];
  'item-double-click': [formId: string];
}>();

const activeItemData = computed(() => {
  if (!props.modelValue) return null;
  return props.items?.find((item) => item.formId === props.modelValue) || null;
});

const isActiveItemFavorite = computed(() => {
  if (activeItemData.value && 'isFavorite' in activeItemData.value) {
    return activeItemData.value.isFavorite || false;
  }
  return false;
});

const enabledActions = computed((): ToolbarActionItem[] => {
  return props.actions || [];
});

// ─── Preview panel (narrow screens) ─────────────────────────────────────
// Tapping an item opens the preview; scrolling the list lowers it so the
// grid gets the space; the handle raises/lowers it by hand.
const previewOpen = ref(false);
let lastScrollTop = 0;

function onListScroll(event: Event): void {
  const el = event.target;
  if (!(el instanceof HTMLElement)) return;
  if (previewOpen.value && Math.abs(el.scrollTop - lastScrollTop) > 12) previewOpen.value = false;
  lastScrollTop = el.scrollTop;
}

const activeItemName = computed(() => {
  const item = activeItemData.value;
  return item && 'name' in item && typeof item.name === 'string' ? item.name : '';
});

function handleItemClick(formId: string) {
  if (props.modelValue !== formId || !previewOpen.value) {
    // Tap: select and show the preview. A second tap on the shown item acts.
    emit('update:modelValue', formId);
    previewOpen.value = true;
  } else {
    // Repeat click on already selected item - trigger action
    emit('item-double-click', formId);
  }
}

// ─── Grid mode ──────────────────────────────────────────────────────────

function isInventoryItem(item: ListItem): item is InventoryItemData {
  return 'categoryType' in item && 'count' in item && 'value' in item && 'weight' in item;
}

const gridItems = computed<InventoryItemData[]>(() => (props.items ?? []).filter(isInventoryItem));

const activeInventoryItem = computed<InventoryItemData | null>(() => {
  const item = activeItemData.value;
  return item && isInventoryItem(item) ? item : null;
});

const canGroup = computed(() =>
  gridItems.value.some((i) => i.categoryType === 'Weapon' || i.categoryType === 'Apparel'),
);
const sortCategory = computed(() => gridItems.value[0]?.categoryType ?? '');
const { sortKey, grouped } = useInventorySort(sortCategory);

const { openModal, closeModal } = useModal();

function openSortMenu(): void {
  openModal({
    component: SortMenu,
    props: {
      keys: sortKeysFor(gridItems.value),
      current: sortKey.value,
      grouped: grouped.value,
      canGroup: canGroup.value,
    },
    on: {
      select: (key: ItemSortKey) => {
        sortKey.value = key;
        closeModal();
      },
      group: (value: boolean) => {
        grouped.value = value;
        closeModal();
      },
    },
  });
}

function openItemMenu(formId: string): void {
  const item = gridItems.value.find((i) => i.formId === formId);
  if (!item) return;
  emit('update:modelValue', formId);
  openModal({
    component: ItemActionMenu,
    props: { item },
    on: {
      action: (action: ItemMenuAction) => {
        closeModal();
        if (action === 'activate') emit('item-double-click', formId);
        else if (action === 'favorite') emit('favorite');
        else if (action === 'hotkey') emit('hotkey');
        else emit('drop');
      },
    },
  });
}

function handleActionClick(actionEvent: string) {
  if (actionEvent === 'favorite') emit('favorite');
  else if (actionEvent === 'drop') emit('drop');
  else if (actionEvent === 'hotkey') emit('hotkey');
}
</script>

<style scoped lang="scss">
/*
 * Toolbar buttons use .btn .btn-icon from the design system; only
 * the colour-token override behaviour for nested icons (favorite /
 * hotkey states) is component-specific.
 */

.inventory-list {
  display: flex;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  gap: var(--spacing-md);
}

.list-wrapper {
  flex: 0 0 var(--inventory-list-wrapper-width, 60%);
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.list {
  min-width: 0;
  overflow: hidden auto;
}

.item-preview {
  flex: 1 1 0%;
  min-width: 0;
  overflow: hidden;
}

.inventory-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

/*
 * Narrow screens (handheld lower screen): stack list → compact preview →
 * toolbar instead of the side-by-side split, so names are not truncated.
 */
@media (width <= 560px) {
  .inventory-list {
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .list-wrapper {
    display: contents;
  }

  .list {
    order: 1;
    flex: 1 1 auto;
    min-height: 0;
  }

  .preview-handle {
    order: 2;
    display: flex;
  }

  .item-preview {
    order: 3;
    flex: 0 0 auto;
    max-height: 40%;
    overflow: hidden;
    transition: max-height var(--transition-normal), opacity var(--transition-normal);

    &:empty {
      display: none;
    }
  }

  .inventory-list--preview-closed .item-preview {
    max-height: 0;
    margin-top: calc(-1 * var(--spacing-sm));
    opacity: 0;
  }

  .inventory-toolbar {
    order: 4;
  }
}

/* Wide screens keep the side-by-side preview; the handle is not needed. */
@media (width > 560px) {
  .preview-handle {
    display: none;
  }
}

.preview-handle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 22px;
  padding: 2px var(--spacing-sm);
  background: none;
  border: none;
  border-top: 1px solid var(--skyrim-border-dark);
  color: var(--skyrim-text-secondary);
  font-family: var(--font-heading);
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  cursor: pointer;
  touch-action: manipulation;
}

.preview-handle__caret {
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--skyrim-text-secondary);
  border-bottom: 2px solid var(--skyrim-text-secondary);
  transform: translateY(-2px) rotate(45deg);
  transition: transform var(--transition-fast);

  &--up {
    transform: translateY(2px) rotate(-135deg);
  }
}

.preview-handle__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: uppercase;
}

.list--grid {
  padding-right: 2px;
}

.toolbar-start {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-right: auto;
}

.toolbar-sort {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 var(--spacing-md);
  font-family: var(--font-heading);
  font-size: var(--font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.toolbar-btn {
  --skyrim-text-accent: var(--skyrim-text-secondary);

  @media (hover: hover) {
    &:hover:not(:disabled) {
      --skyrim-text-accent: var(--skyrim-text-primary);
    }

    &.favorite:hover:not(:disabled),
    &.hotkey-bound:hover:not(:disabled) {
      --skyrim-text-accent: var(--skyrim-accent-main);
    }
  }

  &.favorite,
  &.hotkey-bound {
    --skyrim-text-accent: var(--skyrim-accent-main);
  }
}
</style>
