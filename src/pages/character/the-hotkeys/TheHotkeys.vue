<template>
  <div class="hotkeys-page">
    <hotkey-slots-grid
      disable-inactive
      class="hotkeys-page-grid"
      gap="md"
      @select="triggerSlot"
    />
  </div>
</template>

<script setup lang="ts">
import { HotkeySlotsGrid } from '@/shared/ui';
import { useHotkeysStore } from '@/stores/hotkeys/useHotkeysStore';

const hotkeys = useHotkeysStore();

function triggerSlot(slot: number) {
  const entry = hotkeys.slotsBySlotNumber[slot];
  if (entry) hotkeys.trigger(entry);
}
</script>

<style scoped lang="scss">
.hotkeys-page {
  display: flex;
  flex: 1;
  justify-content: center;
  min-height: 0;
  padding: var(--spacing-md);
  overflow-y: auto;
}

.hotkeys-page-grid {
  max-width: 640px;
  align-self: flex-start;
}
</style>
