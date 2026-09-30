<template>
  <alchemy-lab
    v-if="isLabOpen"
    @close="isLabOpen = false"
  />
  <inventory-list
    v-else
    v-model="activeItem"
    layout="grid"
    :items="ingredientsList"
    :active-item="activeItemData"
    :active-item-stats="previewStats"
    preview-icon-path="skoll/pestle-mortar.svg"
    @favorite="toggleFavorite"
    @hotkey="openHotkeyPicker"
    @drop="startDrop"
    @item-double-click="useItem"
  >
    <template #toolbar-extra>
      <button
        type="button"
        class="btn btn-icon lab-open"
        :aria-label="t('shared.ui.alchemy.open')"
        :title="t('shared.ui.alchemy.open')"
        @click="isLabOpen = true"
      >
        <base-icon
          icon-path="lorc/cauldron.svg"
          :size="20"
        />
      </button>
    </template>
    <template #preview>
      <ingredient-preview
        v-if="isIngredientItem(activeItemData)"
        :data="activeItemData"
      />
    </template>
  </inventory-list>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { AlchemyLab, InventoryList } from '@/features/ui';
import { BaseIcon } from '@/shared/ui';
import { useInventoryStore } from '@/stores/inventory/useInventoryStore';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import { useInventoryItemActions } from '@/pages/inventory/composables/useInventoryItemActions';
import { getRoundValue } from '@/shared/lib/utils/getDescriptionValues';
import { IngredientPreview } from '@/entities/ui/ingredients';
import { isIngredientItem } from '@/stores/adapters/typeGuards';

const inventoryStore = useInventoryStore();
const { ingredientsList } = storeToRefs(inventoryStore);
const wsStore = useWebSocketStore();
const { t } = useI18n();
const isLabOpen = ref(false);

const {
  activeItem,
  activeItemData,
  toggleFavorite,
  openHotkeyPicker,
  startDrop,
} = useInventoryItemActions(() => ingredientsList.value);

const previewStats = computed(() => [
  {
    label: t('common.weight'),
    value: getRoundValue(activeItemData.value?.weight),
  },
  {
    label: t('common.value'),
    value: getRoundValue(activeItemData.value?.value),
  },
]);

function useItem(formId: string) {
  const item = ingredientsList.value.find((f) => f.formId === formId);
  if (!item) return;

  // Use (consume) the ingredient item
  wsStore.sendCommand({ command: 'use', formId });
}
</script>

<style scoped lang="scss">
.lab-open {
  --skyrim-text-accent: var(--skyrim-accent-main);
}
</style>
