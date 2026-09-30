<template>
  <inventory-item
    :name="name"
    :quantity="quantity"
    :is-favorite="isFavorite"
    :active="active"
  >
    <template #icon>
      <item-thumbnail
        :fallback-icon-path="getWeaponIconPath(weaponType)"
        :model-path="modelPath"
        :keywords="keywords"
        :enchanted="enchanted"
        :size="36"
        framing="diagonal"
      />
    </template>
    <template #status>
      <equipped-hand-icon
        v-if="isEquipped"
        :equipped-hand="equippedHand"
      />
    </template>
  </inventory-item>
</template>

<script setup lang="ts">
import { InventoryItem } from '@/shared/ui/items';
import { EquippedHandIcon } from '@/shared/ui';
import { getWeaponIconPath } from '@/shared/lib/constants/weaponIcons';
import { ItemThumbnail } from '@/entities/ui/icons';
import type { WeaponType } from '@/stores/inventory/lib/types';
import type { EquippedHand } from '@/shared/lib/types';

defineProps<{
  name: string;
  weaponType: WeaponType;
  quantity?: number;
  isFavorite?: boolean;
  isEquipped?: boolean;
  equippedHand?: EquippedHand;
  active?: boolean;
  modelPath?: string | null;
  keywords?: string[] | null;
  enchanted?: boolean;
}>();
</script>
