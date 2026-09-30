<template>
  <div class="modal-content sort-menu">
    <h3 class="modal-title text-base m-0">{{ t('shared.ui.sort.title') }}</h3>
    <div class="sort-menu__options">
      <button
        v-for="key in keys"
        :key="key"
        type="button"
        class="sort-menu__option"
        :class="{ 'sort-menu__option--active': key === current }"
        :aria-pressed="key === current"
        @click="emit('select', key)"
      >
        {{ t(`shared.ui.sort.${key}`) }}
      </button>
    </div>
    <label
      v-if="canGroup"
      class="sort-menu__group"
    >
      <span>{{ t('shared.ui.sort.groupByType') }}</span>
      <base-switch
        :model-value="grouped"
        :aria-label="t('shared.ui.sort.groupByType')"
        @update:model-value="emit('group', $event)"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { BaseSwitch } from '@/shared/ui';
import type { ItemSortKey } from '@/shared/lib/utils/itemSorting';

defineProps<{
  keys: ItemSortKey[];
  current: ItemSortKey;
  grouped: boolean;
  canGroup: boolean;
}>();
const emit = defineEmits<{ select: [key: ItemSortKey]; group: [value: boolean] }>();
const { t } = useI18n();
</script>

<style scoped lang="scss">
.sort-menu {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: min(300px, 86vw);
}

.sort-menu__options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.sort-menu__option {
  min-height: 44px;
  background: transparent;
  border: var(--border-thin) solid var(--skyrim-border-dark);
  border-radius: var(--radius-lg);
  font-family: var(--font-heading);
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-secondary);
  cursor: pointer;

  &--active {
    border-color: var(--skyrim-accent-main);
    background: var(--bg-accent-soft);
    color: var(--skyrim-text-primary);
  }
}

.sort-menu__group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-primary);
}
</style>
