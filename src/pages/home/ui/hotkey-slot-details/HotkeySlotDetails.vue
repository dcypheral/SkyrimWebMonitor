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
      <div
        v-if="canChooseHand"
        class="slot-details__hands"
      >
        <span class="slot-details__label">{{ t('pages.home.hand.title') }}</span>
        <div class="d-flex gap-md">
          <button
            type="button"
            class="btn flex-1"
            :class="{ active: left }"
            :aria-pressed="left"
            @click="setHand(!left, right)"
          >
            {{ t('pages.home.hand.left') }}
          </button>
          <button
            type="button"
            class="btn flex-1"
            :class="{ active: right }"
            :aria-pressed="right"
            @click="setHand(left, !right)"
          >
            {{ t('pages.home.hand.right') }}
          </button>
        </div>
        <span class="slot-details__hint">{{ handHint }}</span>
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
import { supportsHandChoice, type HotkeySlotEntry } from '@/stores/hotkeys/lib/types';
import { useHotkeysStore } from '@/stores/hotkeys/useHotkeysStore';

const props = defineProps<{ entry: HotkeySlotEntry }>();
const emit = defineEmits<{ use: []; clear: [] }>();
const { t } = useI18n();
const hotkeys = useHotkeysStore();
const iconPath = computed(() => getHotkeyIconPath(props.entry));

// Left/Right are independent toggles; both on = both hands.
const canChooseHand = computed(() => supportsHandChoice(props.entry));
const hand = computed(() => hotkeys.handFor(props.entry));
const left = computed(() => hand.value === 'left' || hand.value === 'both');
const right = computed(() => hand.value === 'right' || hand.value === 'both');
const handHint = computed(() => {
  if (hand.value === 'both') return t('pages.home.hand.hintBoth');
  if (hand.value) return t('pages.home.hand.hintOne');
  return t('pages.home.hand.hintDefault');
});

function setHand(l: boolean, r: boolean): void {
  hotkeys.setHands(props.entry, l, r);
}
</script>

<style scoped lang="scss">
.slot-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: 260px;
}

.slot-details__hands {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slot-details__label {
  font-family: var(--font-heading);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--skyrim-text-secondary);
}

.slot-details__hint {
  font-size: 0.72rem;
  color: var(--skyrim-text-dim);
}

.slot-details__name {
  font-family: var(--font-heading);
  font-size: var(--font-size-lg);
  color: var(--skyrim-text-primary);
}
</style>
