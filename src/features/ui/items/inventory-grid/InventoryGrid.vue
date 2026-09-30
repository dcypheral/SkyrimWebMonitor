<template>
  <div class="inventory-grid">
    <section
      v-for="group in groups"
      :key="group.id"
      class="inventory-grid__group"
    >
      <h3
        v-if="group.labelKey && groups.length > 1"
        class="inventory-grid__heading"
      >
        {{ t(group.labelKey) }}
        <span class="inventory-grid__heading-count">{{ group.items.length }}</span>
      </h3>
      <div class="inventory-grid__tiles">
        <item-tile
          v-for="item in group.items"
          :key="item.formId"
          :item="item"
          :active="modelValue === item.formId"
          @select="emit('select', item.formId)"
          @menu="emit('menu', item.formId)"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { groupItems, sortItems, type ItemSortKey } from '@/shared/lib/utils/itemSorting';
import { getItemFraming } from '@/shared/lib/utils/itemVisual';
import { useItemThumbnailsStore } from '@/stores/item-thumbnails/useItemThumbnailsStore';
import type { InventoryItem } from '@/stores/inventory/lib/types';
import ItemTile from '../item-tile/ItemTile.vue';

const props = withDefaults(
  defineProps<{
    items: InventoryItem[];
    modelValue?: string | null;
    sortKey?: ItemSortKey;
    grouped?: boolean;
  }>(),
  { modelValue: null, sortKey: 'name', grouped: true },
);

const emit = defineEmits<{
  select: [formId: string];
  menu: [formId: string];
}>();

const { t } = useI18n();
const thumbnails = useItemThumbnailsStore();

const groups = computed(() => {
  const sorted = sortItems(props.items, props.sortKey);
  return props.grouped ? groupItems(sorted) : [{ id: 'all', labelKey: '', items: sorted }];
});

// Render and cache every item of this category once, behind whatever is on screen.
watch(
  () => props.items,
  (items) => {
    for (const item of items) {
      if (!item.modelPath) continue;
      thumbnails.request(
        { modelPath: item.modelPath, keywords: item.keywords, framing: getItemFraming(item) },
        'background',
      );
    }
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.inventory-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* A quiet divider label: small caps text with a hairline to the right. */
.inventory-grid__heading {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 3px var(--spacing-xs) 2px;
  background: color-mix(in srgb, var(--skyrim-bg-medium) 85%, transparent);
  backdrop-filter: blur(4px);
  font-family: var(--font-heading);
  font-size: 0.64rem;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--skyrim-text-secondary);
}

.inventory-grid__heading-count {
  color: var(--skyrim-text-dim);
}

.inventory-grid__heading::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--skyrim-border-medium), transparent);
}

.inventory-grid__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
  gap: 2px;
}
</style>
