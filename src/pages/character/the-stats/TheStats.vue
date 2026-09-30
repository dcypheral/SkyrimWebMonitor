<template>
  <div class="records">
    <div
      class="records__tabs"
      role="tablist"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="records__tab"
        :class="{ 'records__tab--active': active === tab.id }"
        :aria-selected="active === tab.id"
        :aria-label="tab.label"
        @click="active = tab.id"
      >
        <base-icon
          :icon-path="tab.icon"
          :size="18"
          :background-color="active === tab.id ? 'var(--skyrim-accent-main)' : 'var(--skyrim-text-dim)'"
        />
        <span
          v-if="active === tab.id"
          class="records__tab-label"
        >{{ tab.label }}</span>
      </button>
    </div>

    <p
      v-if="!supported"
      class="records__note"
    >
      {{ t('pages.records.needPlugin') }}
    </p>

    <!-- Active effects -->
    <div
      v-else-if="active === 'effects'"
      class="records__body"
    >
      <p
        v-if="!groupedEffects.length"
        class="records__note"
      >
        {{ received ? t('pages.records.noEffects') : t('pages.records.waiting') }}
      </p>
      <section
        v-for="group in groupedEffects"
        :key="group.source"
        class="effect-group"
      >
        <h3 class="effect-group__source">
          {{ group.source || t('pages.records.unknownSource') }}
          <span
            v-if="group.remaining > 0"
            class="effect-group__time"
          >{{ formatSeconds(group.remaining) }}</span>
        </h3>
        <div
          v-for="(e, i) in group.effects"
          :key="i"
          class="effect"
          :class="{ 'effect--bad': e.detrimental }"
        >
          <span class="effect__name">{{ e.name }}</span>
          <span
            v-if="e.magnitude"
            class="effect__mag"
          >{{ formatMagnitude(e.magnitude) }}</span>
          <span
            v-if="e.duration > 0"
            class="effect__bar"
          >
            <span :style="{ width: `${Math.round((e.remaining / e.duration) * 100)}%` }" />
          </span>
        </div>
      </section>
    </div>

    <!-- General stats category -->
    <dl
      v-else
      class="records__body records__list"
    >
      <p
        v-if="!currentStats.length"
        class="records__note"
      >
        {{ t('pages.records.waiting') }}
      </p>
      <div
        v-for="s in currentStats"
        :key="s.name"
        class="stat-row"
        :class="{ 'stat-row--zero': s.value === 0 }"
      >
        <dt>{{ statLabel(s.name) }}</dt>
        <dd>{{ s.value.toLocaleString(locale) }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { STAT_CATEGORIES, useRecordsStore, type ActiveEffectEntry, type StatCategory } from '@/stores/character/useRecordsStore';
import { useSystemStore } from '@/stores/system/useSystemStore';
import { FEATURES } from '@/stores/system/lib/types';

type TabId = 'effects' | StatCategory;

const ICONS: Record<TabId, string> = {
  effects: 'lorc/aura.svg',
  General: 'lorc/scroll-unfurled.svg',
  Quest: 'lorc/tied-scroll.svg',
  Combat: 'lorc/crossed-swords.svg',
  Magic: 'lorc/magic-swirl.svg',
  Crafting: 'lorc/anvil.svg',
  Crime: 'darkzaitzev/robber-hand.svg',
};

const { t, te, locale } = useI18n();
const system = useSystemStore();
const { stats, effects, received } = storeToRefs(useRecordsStore());

const supported = computed(() => system.isFeatureProvided(FEATURES.PLAYER_RECORDS));
const active = ref<TabId>('effects');

const tabs = computed(() =>
  (['effects', ...STAT_CATEGORIES] as const).map((id) => ({
    id,
    icon: ICONS[id],
    label: t(`pages.records.tabs.${id}`),
  })),
);

const currentStats = computed(() => (active.value === 'effects' ? [] : stats.value[active.value]));

/** Effects grouped by source spell/item, like the game's Active Effects list. */
const groupedEffects = computed(() => {
  const map = new Map<string, { source: string; remaining: number; effects: ActiveEffectEntry[] }>();
  for (const e of effects.value) {
    const key = e.source || e.name;
    const group = map.get(key) ?? { source: e.source, remaining: 0, effects: [] };
    group.effects.push(e);
    group.remaining = Math.max(group.remaining, e.remaining);
    map.set(key, group);
  }
  // Timed effects first (they change), then permanent ones.
  return [...map.values()].sort((a, b) => (b.remaining > 0 ? 1 : 0) - (a.remaining > 0 ? 1 : 0) || a.source.localeCompare(b.source));
});

function statLabel(name: string): string {
  const key = `pages.records.stats.${name.replace(/[^A-Za-z]/g, '')}`;
  return te(key) ? t(key) : name;
}

function formatSeconds(seconds: number): string {
  const s = Math.round(seconds);
  if (s >= 3600) return `${String(Math.floor(s / 3600))} h ${String(Math.floor((s % 3600) / 60))} m`;
  if (s >= 60) return `${String(Math.floor(s / 60))} m ${String(s % 60).padStart(2, '0')} s`;
  return `${String(s)} s`;
}

function formatMagnitude(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(1);
}
</script>

<style scoped lang="scss">
.records {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 0;
}

.records__tabs {
  display: flex;
  gap: 4px;
}

.records__tab {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 6px;
  background: rgb(255 255 255 / 3%);
  border: 1px solid var(--skyrim-border-dark);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: flex-grow var(--transition-normal);

  &--active {
    flex-grow: 2.6;
    border-color: var(--skyrim-accent-main-dim);
  }
}

.records__tab-label {
  overflow: hidden;
  font-family: var(--font-heading);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--skyrim-text-primary);
}

.records__body {
  flex: 1;
  min-height: 0;
  margin: 0;
  overflow-y: auto;
}

.records__note {
  margin: var(--spacing-md) 0;
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-dim);
  text-align: center;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: 7px 4px;
  border-bottom: 1px solid rgb(255 255 255 / 5%);
  font-size: var(--font-size-sm);

  dt {
    color: var(--skyrim-text-secondary);
  }

  dd {
    margin: 0;
    font-family: var(--font-heading);
    font-variant-numeric: tabular-nums;
    color: var(--skyrim-text-primary);
  }

  &--zero dd {
    color: var(--skyrim-text-dim);
  }
}

.effect-group {
  margin-bottom: var(--spacing-sm);
}

.effect-group__source {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 2px;
  padding: 4px 2px;
  border-bottom: 1px solid var(--skyrim-border-dark);
  font-family: var(--font-heading);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--skyrim-text-primary);
}

.effect-group__time {
  font-variant-numeric: tabular-nums;
  color: var(--skyrim-accent-main);
}

.effect {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 2px 10px;
  padding: 4px 2px;
  font-size: var(--font-size-xs);
  color: #bfe3b8;

  &--bad {
    color: #f0b0a4;
  }
}

.effect__mag {
  font-variant-numeric: tabular-nums;
}

.effect__bar {
  grid-column: 1 / -1;
  height: 2px;
  overflow: hidden;
  background: rgb(255 255 255 / 8%);

  span {
    display: block;
    height: 100%;
    background: currentcolor;
  }
}
</style>
