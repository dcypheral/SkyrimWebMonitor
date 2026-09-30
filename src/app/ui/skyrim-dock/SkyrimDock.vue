<template>
  <nav
    class="dock"
    role="tablist"
    :aria-label="$t('app.navigation.mainAriaLabel')"
  >
    <button
      v-for="tab in nav.tabs"
      :key="tab.id"
      type="button"
      class="dock__item"
      :class="{ 'dock__item--active': nav.activeTab === tab.id }"
      role="tab"
      :aria-selected="nav.activeTab === tab.id"
      @click="nav.setActiveTab(tab.id)"
    >
      <base-icon
        :icon-path="DOCK_ICONS[tab.id] ?? 'lorc/cog.svg'"
        :size="22"
        :background-color="nav.activeTab === tab.id ? 'var(--skyrim-accent-main)' : 'var(--skyrim-text-secondary)'"
      />
      <span class="dock__label">{{ dockLabel(tab.id, tab.label) }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { useNavigationStore } from '@/stores/use-navigation-store/useNavigationStore';

const nav = useNavigationStore();
const { t } = useI18n();

const DOCK_ICONS: Record<string, string> = {
  home: 'delapouite/house.svg',
  character: 'delapouite/person.svg',
  inventory: 'delapouite/backpack.svg',
  magic: 'lorc/magic-swirl.svg',
  quests: 'lorc/scroll-unfurled.svg',
  map: 'lorc/treasure-map.svg',
};

// Shorter labels where the section name is long for a dock button.
function dockLabel(tabId: string, fallback: string): string {
  if (tabId === 'inventory') return t('app.navigation.dock.items');
  if (tabId === 'character') return t('app.navigation.dock.stats');
  return fallback;
}
</script>

<style scoped lang="scss">
.dock {
  display: flex;
  flex-shrink: 0;
  align-items: stretch;
  padding-bottom: env(safe-area-inset-bottom);
  background: linear-gradient(180deg, var(--skyrim-bg-medium), var(--skyrim-bg-dark));
  border-top: 1px solid var(--skyrim-border-dark);
  position: relative;
  z-index: var(--z-sticky);
}

.dock__item {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  min-height: 52px;
  padding: 6px 2px;
  background: none;
  border: none;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color var(--transition-fast);

  &:active {
    background-color: var(--tab-bg-active);
  }

  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 22%;
    right: 22%;
    height: 2px;
    background: transparent;
    transition: background-color var(--transition-fast);
  }

  &--active::before {
    background: var(--skyrim-accent-main);
    box-shadow: 0 0 8px var(--skyrim-border-glow);
  }
}

.dock__label {
  max-width: 100%;
  overflow: hidden;
  font-family: var(--font-heading);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--skyrim-text-secondary);

  .dock__item--active & {
    color: var(--skyrim-text-primary);
  }
}
</style>
