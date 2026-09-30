<template>
  <header class="navigation-header">
    <div class="header-row">
      <nav
        v-if="visibleSubTabs.length > 0"
        ref="subtabsRef"
        class="subtab-bar header-subtabs animate-fade-in"
        role="tablist"
        :aria-label="$t('app.navigation.subAriaLabel')"
      >
        <button
          v-for="sub in visibleSubTabs"
          :key="sub.id"
          class="subtab"
          :class="{ active: nav.activeSubTab === sub.id }"
          role="tab"
          :aria-selected="nav.activeSubTab === sub.id"
          @click="nav.setActiveSubTab(sub.id)"
        >
          {{
            getSubtabLabel(sub)
          }}
        </button>
      </nav>
      <h1
        v-else
        class="header-title"
      >
        {{ activeTabLabel }}
      </h1>

      <button
        type="button"
        class="settings-button"
        :aria-label="$t('app.settings.open')"
        @click="openSettings"
      >
        <base-icon
          icon-path="lorc/cog.svg"
          :background-color="'var(--skyrim-text-secondary)'"
        />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { useModal } from '@/shared/lib';
import { SettingsModalContent } from '@/features/settings';
import { useNavigationStore } from '@/stores/use-navigation-store/useNavigationStore';
import type { SubTab } from '@/stores/use-navigation-store/lib/types';

const subtabsRef = ref<HTMLElement | null>(null);
const nav = useNavigationStore();
const { t } = useI18n();
const { openModal } = useModal();

const visibleSubTabs = computed(() => nav.getVisibleSubTabs());
const activeTabLabel = computed(() => nav.tabs.find((tab) => tab.id === nav.activeTab)?.label ?? '');

// Center the active item in the horizontally scrollable container.
// If items fit, CSS `justify-content: safe center` centers them and
// scrollWidth <= clientWidth, so scrollTo is clamped to 0 (no-op).
function centerActive(container: HTMLElement | null, activeSelector: string) {
  if (!container) return;
  const activeBtn: HTMLElement | null = container.querySelector(activeSelector);
  if (!activeBtn) return;

  const btnCenter = activeBtn.offsetLeft + activeBtn.offsetWidth / 2;
  const targetLeft = btnCenter - container.clientWidth / 2;
  const maxLeft = container.scrollWidth - container.clientWidth;

  container.scrollTo({
    left: Math.max(0, Math.min(targetLeft, maxLeft)),
    behavior: 'smooth',
  });
}

function getSubtabLabel(sub: SubTab) {
  if (nav.activeTab === 'magic') {
    return sub.label;
  }
  return t(`app.tabs.${nav.activeTab}.subtabs.${sub.id}`);
}

function openSettings(): void {
  openModal({ component: SettingsModalContent });
}

watch(
  () => nav.activeTab,
  async () => {
    await nextTick();
    if (subtabsRef.value) {
      subtabsRef.value.scrollLeft = 0;
    }
  }
);

watch(
  () => nav.activeSubTab,
  async () => {
    await nextTick();
    centerActive(subtabsRef.value, '.subtab.active');
  }
);
</script>

<style scoped lang="scss">
/*
 * Top bar: sub-tabs of the current section (or its title) + settings.
 * Main sections live in the bottom dock (SkyrimDock), within thumb reach.
 */

.navigation-header {
  flex-shrink: 0;
  background-color: var(--skyrim-bg-medium);
  position: relative;
  z-index: var(--z-sticky);
}

.header-row {
  display: flex;
  align-items: stretch;
  min-height: 40px;
  background-color: var(--skyrim-bg-dark);
  border-bottom: 1px solid var(--skyrim-border-dark);
  box-sizing: border-box;
}

.header-subtabs {
  flex: 1 1 auto;
  min-width: 0;
  justify-content: flex-start;
  padding-inline: var(--spacing-sm);
  scroll-padding-inline: var(--spacing-sm);
  background-color: transparent;
  border-bottom: none;
}

.header-subtabs > .subtab:first-child {
  margin-left: auto;
}

.header-subtabs > .subtab:last-child {
  margin-right: auto;
}

.header-title {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  margin: 0;
  padding-inline: max(var(--spacing-md), env(safe-area-inset-left));
  font-family: var(--font-heading);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--skyrim-text-secondary);
}

.settings-button {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  padding-inline: var(--spacing-sm)
    max(var(--spacing-sm), env(safe-area-inset-right));
  background-color: transparent;
  border: none;
  border-left: 1px solid var(--skyrim-border-dark);
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color var(--transition-normal);

  @media (hover: hover) {
    &:hover {
      background-color: var(--tab-bg-hover);
    }
  }

  &:active {
    background-color: var(--tab-bg-active);
    transition: none;
  }
}
</style>
