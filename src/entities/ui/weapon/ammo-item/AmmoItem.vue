<template>
  <inventory-item
    :name="name"
    :quantity="quantity"
    :is-favorite="isFavorite"
    :active="active"
    @click="$emit('click')"
  >
    <template #icon>
      <item-thumbnail
        fallback-icon-path="lorc/arrow-cluster.svg"
        :model-path="modelPath"
        :keywords="keywords"
        :size="36"
        framing="diagonal"
      />
    </template>
    <template #status>
      <equip-status :is-equipped="isEquipped" />
    </template>
  </inventory-item>
</template>

<script setup lang="ts">
import { InventoryItem, EquipStatus } from '@/shared/ui/items';
import { ItemThumbnail } from '@/entities/ui/icons';

defineProps<{
  name: string;
  quantity?: number;
  isFavorite?: boolean;
  isEquipped?: boolean;
  active?: boolean;
  modelPath?: string | null;
  keywords?: string[] | null;
}>();

defineEmits<{
  click: [];
}>();
</script>
