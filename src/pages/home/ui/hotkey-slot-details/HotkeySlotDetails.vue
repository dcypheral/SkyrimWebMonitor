<template>
  <div class="modal-content slot-details">
    <h3 class="modal-title text-base m-0">
      {{ t('pages.home.hotkeySlot', { slot: entry.slot }) }}
    </h3>
    <template v-if="entry.bound">
      <div class="d-flex items-center gap-md">
        <base-icon
          v-if="iconPath"
          :icon-path="iconPath"
          :size="40"
        />
        <span class="slot-details__name">{{ entry.name }}</span>
      </div>
      <div class="d-flex gap-md">
        <button
          type="button"
          class="btn flex-1"
          @click="emit('use')"
        >
          {{ t('pages.home.hotkeyUse') }}
        </button>
        <button
          type="button"
          class="btn flex-1"
          @click="emit('clear')"
        >
          {{ t('pages.home.hotkeyClear') }}
        </button>
      </div>
    </template>
    <p class="text-sm text-secondary m-0">
      {{ t('pages.home.hotkeyAssignHint') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { getHotkeyIconPath } from '@/shared/lib/utils/hotkeyIcons';
import type { HotkeySlotEntry } from '@/stores/hotkeys/lib/types';

const props = defineProps<{ entry: HotkeySlotEntry }>();
const emit = defineEmits<{ use: []; clear: [] }>();
const { t } = useI18n();
const iconPath = computed(() => getHotkeyIconPath(props.entry));
</script>

<style scoped lang="scss">
.slot-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: 260px;
}

.slot-details__name {
  font-family: var(--font-heading);
  font-size: var(--font-size-lg);
  color: var(--skyrim-text-primary);
}
</style>
