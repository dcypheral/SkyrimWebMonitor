<template>
  <div class="handheld-device">
    <template v-if="showMain">
      <!-- Home uses the whole screen; its vitals row replaces the top bar. -->
      <skyrim-navigation
        v-if="activeTab !== 'home'"
        :active-tab="activeTab"
        :active-sub-tab="activeSubTab"
      />

      <main class="content-area d-flex flex-col flex-1 min-h-0">
        <skyrim-content
          :tab="activeTab"
          :sub-tab="activeSubTab"
        />
      </main>

      <offline-pill v-if="!isConnected" />
      <skyrim-dock />
    </template>

    <connection-status v-else />
    <skyrim-modal />
    <model-viewer-overlay />
    <guide-reader v-if="guideReaderOpen" />
    <game-status-backdrop />
    <combat-indicator />
    <exit-toast :visible="showToast" />
    <app-toast />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { SkyrimNavigation, SkyrimContent, SkyrimDock, OfflinePill } from '@/app/ui';
import {
  ConnectionStatus,
  SkyrimModal,
  ExitToast,
  GameStatusBackdrop,
  CombatIndicator,
  AppToast,
} from '@/shared/ui';
import { useNavigationStore } from '@/stores/use-navigation-store/useNavigationStore';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import { useOfflineStore } from '@/stores/offline/useOfflineStore';
import { useGuideStore } from '@/stores/guide/useGuideStore';
import { useAppLoader } from '@/app/lib/composables/useAppLoader';
import { ModelViewerOverlay } from '@/entities/ui/icons';
import { useBackGuard } from '@/shared/lib/composables/useBackGuard';
import { installCompanionMode } from '@/shared/lib/native/companionMode';

const navigationStore = useNavigationStore();
const { activeTab, activeSubTab } = storeToRefs(navigationStore);

const websocketStore = useWebSocketStore();
const { isConnected } = storeToRefs(websocketStore);

// Offline: browse the saved game state until the game connects.
const offline = useOfflineStore();
const { hasSnapshot, wantsConnectScreen } = storeToRefs(offline);
const showMain = computed(() => isConnected.value || (hasSnapshot.value && !wantsConnectScreen.value));

// The reader (and pdf.js with it) loads only when a guide page is opened.
const GuideReader = defineAsyncComponent(() => import('@/features/guide/ui/guide-reader/GuideReader.vue'));
const guideStore = useGuideStore();
// Stays mounted after the first open so closing can animate.
const guideReaderOpen = ref(false);
watch(
  () => guideStore.reader.open,
  (open) => {
    if (open) guideReaderOpen.value = true;
  },
);

useAppLoader();
installCompanionMode();
const { showToast } = useBackGuard();
</script>

<style scoped lang="scss">
/* Vignette overlay is unique to this device frame; layout uses utilities. */

.handheld-device {
  position: relative;
  width: 100%;
  height: 100vh;
  margin: 0 auto;
  background-color: var(--skyrim-bg-dark);
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse at top, transparent 60%, rgb(0 0 0 / 30%) 100%),
      radial-gradient(ellipse at bottom, transparent 60%, rgb(0 0 0 / 40%) 100%);
  }
}
</style>
