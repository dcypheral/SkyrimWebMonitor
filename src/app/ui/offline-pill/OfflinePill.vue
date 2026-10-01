<template>
  <div
    class="offline-pill"
    role="status"
  >
    <span
      class="offline-pill__dot"
      :class="{ 'offline-pill__dot--trying': isTrying }"
      aria-hidden="true"
    />
    <span class="offline-pill__text">{{ label }}</span>
    <button
      type="button"
      class="offline-pill__btn"
      @click="offline.wantsConnectScreen = true"
    >
      {{ t('app.offline.connect') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { CONNECTION_STATUS } from '@/shared/lib/constants/connection';
import { useOfflineStore } from '@/stores/offline/useOfflineStore';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';

/**
 * Shown above the dock while the app browses the saved game state:
 * says it is offline, how old the data is, and leads to the connection
 * screen. Reconnecting keeps running in the background.
 */
const { t, locale } = useI18n();
const offline = useOfflineStore();
const { savedAt } = storeToRefs(offline);
const ws = useWebSocketStore();

const isTrying = computed(
  () => ws.status === CONNECTION_STATUS.CONNECTING || ws.status === CONNECTION_STATUS.RECONNECTING,
);

const label = computed(() => {
  const at = savedAt.value;
  if (!at) return t('app.offline.title');
  const d = new Date(at);
  const sameDay = d.toDateString() === new Date().toDateString();
  const when = sameDay
    ? d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
  return t('app.offline.savedAt', { when });
});
</script>

<style scoped lang="scss">
/* A slim strip in the layout, right above the dock: it takes its own row
   instead of covering lists or the quest card. */
.offline-pill {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 30px;
  padding: 2px 8px;
  background: rgb(12 12 12 / 92%);
  border-top: 1px solid var(--skyrim-border-dark);
}

.offline-pill__dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  background: #8a8276;
  border-radius: 50%;

  &--trying {
    background: #d8b45a;
    animation: offline-pulse 1.4s ease-in-out infinite;
  }
}

.offline-pill__text {
  overflow: hidden;
  font-family: var(--font-heading);
  font-size: 0.64rem;
  letter-spacing: 0.06em;
  color: var(--skyrim-text-secondary);
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.offline-pill__btn {
  flex-shrink: 0;
  min-height: 24px;
  padding: 0 10px;
  background: var(--skyrim-bg-dark);
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 999px;
  color: var(--skyrim-text-primary);
  font-family: var(--font-heading);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  touch-action: manipulation;
}

@keyframes offline-pulse {
  50% {
    opacity: 0.35;
  }
}
</style>
