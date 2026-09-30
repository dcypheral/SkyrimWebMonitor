<template>
  <Teleport to="body">
    <Transition
      name="game-status-pill"
      appear
    >
      <div
        v-if="visible"
        class="game-status-pill"
        :class="{ 'game-status-pill--dead': dead }"
        role="status"
        aria-live="polite"
        :aria-label="$t('shared.ui.gameStatus.title')"
      >
        <base-icon
          :icon-path="iconPath"
          :size="12"
          :background-color="dead ? '#e08a7c' : '#d8b45a'"
        />
        <span>{{ label }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import { useGameStatusStore } from '@/stores/game/useGameStatusStore';
import { BaseIcon } from '@/shared/ui';

/**
 * Small "actions unavailable" pill on the dock's top edge. It tells the
 * player why taps like Equip or Use do nothing right now (game paused,
 * loading, in a menu or conversation, dead), without covering anything.
 * Short states (opening a menu for a moment) do not flash it: it waits
 * SHOW_DELAY_MS before appearing.
 */
const SHOW_DELAY_MS = 700;

const { t } = useI18n();
const gameStatusStore = useGameStatusStore();
const { isConnected } = storeToRefs(useWebSocketStore());
const { canAct, dead, paused, loading, inMainMenu, inDialogue, controlsEnabled } = storeToRefs(gameStatusStore);

const unavailable = computed(() => isConnected.value && !canAct.value);
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(
  unavailable,
  (value) => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!value) {
      visible.value = false;
      return;
    }
    timer = setTimeout(() => {
      visible.value = true;
    }, SHOW_DELAY_MS);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
});

const iconPath = computed(() => (dead.value ? 'lorc/death-zone.svg' : 'lorc/sands-of-time.svg'));

const label = computed(() => {
  if (dead.value) return t('shared.ui.gameStatus.short.dead');
  if (loading.value) return t('shared.ui.gameStatus.short.loading');
  if (inMainMenu.value) return t('shared.ui.gameStatus.short.inMainMenu');
  if (inDialogue.value) return t('shared.ui.gameStatus.short.inDialogue');
  if (paused.value) return t('shared.ui.gameStatus.short.paused');
  if (!controlsEnabled.value) return t('shared.ui.gameStatus.short.controlsDisabled');
  return t('shared.ui.gameStatus.short.unavailable');
});
</script>

<style scoped lang="scss">
/*
 * Sits on the dock's top border (dock ≈ 52 px tall), centred. Never
 * intercepts touches; the app stays fully usable (view-only).
 */
.game-status-pill {
  position: fixed;
  bottom: calc(52px - 10px + env(safe-area-inset-bottom));
  left: 50%;
  z-index: var(--z-fixed);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 9px 0 7px;
  background: rgb(12 11 9 / 88%);
  border: 1px solid rgb(216 180 90 / 55%);
  border-radius: 999px;
  box-shadow: 0 1px 6px rgb(0 0 0 / 50%);
  color: #d8b45a;
  font-family: var(--font-heading);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  transform: translateX(-50%);

  &--dead {
    border-color: rgb(224 138 124 / 60%);
    color: #e08a7c;
  }
}

.game-status-pill-enter-active,
.game-status-pill-leave-active {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.game-status-pill-enter-from,
.game-status-pill-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px);
}
</style>
