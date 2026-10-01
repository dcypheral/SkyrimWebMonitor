<template>
  <div class="modal-content hotkey-picker-modal">
    <div class="modal-header">
      <h3 class="modal-title">
        {{ $t('modals.hotkeys.title') }}
      </h3>
      <p
        v-if="itemName"
        class="modal-subtitle"
      >
        {{ itemName }}
      </p>
    </div>

    <hotkey-slots-grid
      :active-slot="activeSlot"
      gap="sm"
      class="hotkey-picker-grid"
      @select="handleSlotClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useHotkeysStore } from '@/stores/hotkeys/useHotkeysStore';
import HotkeySlotsGrid from '../hotkey-slots-grid/HotkeySlotsGrid.vue';

interface Props {
  currentSlot?: number | null;
  itemName?: string | null;
  /** When given, the highlighted slot follows the live hotkey data. */
  formId?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  currentSlot: null,
  itemName: null,
  formId: null,
});

const hotkeys = useHotkeysStore();
const activeSlot = computed(() => (props.formId ? hotkeys.getSlotForFormId(props.formId) : props.currentSlot));

const emit = defineEmits<{
  select: [slot: number];
  close: [];
}>();

function handleSlotClick(slot: number) {
  emit('select', slot);
}
</script>

<style scoped lang="scss">
/*
 * Modal frame, title, subtitle and button styles come from the
 * design system (.modal-content, .modal-header, .modal-title,
 * .modal-subtitle, .btn). Slot grid is provided by HotkeySlotsGrid.
 */

.hotkey-picker-modal {
  min-width: 320px;
}

.hotkey-picker-grid {
  max-height: 60vh;
  overflow-y: auto;
}

.hotkey-picker-grid :deep(.slot-btn) {
  min-width: 0;
  padding: var(--spacing-sm);
}
</style>
