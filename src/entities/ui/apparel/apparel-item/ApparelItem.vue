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
        :fallback-icon-path="getApparelIconPath(bodySlots?.[0] ?? null)"
        :model-path="modelPath"
        :keywords="keywords"
        :enchanted="enchanted"
        :size="36"
        framing="upright"
      />
    </template>
    <template #status>
      <equip-status :is-equipped="isEquipped" />
    </template>
  </inventory-item>
</template>

<script setup lang="ts">
import { InventoryItem, EquipStatus } from '@/shared/ui/items';
import { getApparelIconPath } from '@/shared/lib/constants/apparelIcons';
import { ItemThumbnail } from '@/entities/ui/icons';
import type { ArmorType, BodySlot } from '@/stores/inventory/lib/types';

defineProps<{
  name: string;
  armorType: ArmorType;
  quantity?: number;
  isFavorite?: boolean;
  isEquipped?: boolean;
  active?: boolean;
  bodySlots?: BodySlot[] | null;
  modelPath?: string | null;
  keywords?: string[] | null;
  enchanted?: boolean;
}>();

defineEmits<{
  click: [];
}>();
</script>
