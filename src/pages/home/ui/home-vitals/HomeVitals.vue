<template>
  <div class="vitals">
    <div class="vitals__bars">
      <stat-bar
        class="vitals__bar"
        :value="magickaPercentage"
        :max="100"
        color="magicka"
      />
      <stat-bar
        class="vitals__bar vitals__bar--health"
        :value="healthPercentage"
        :max="100"
        color="health"
      />
      <stat-bar
        class="vitals__bar"
        :value="staminaPercentage"
        :max="100"
        color="stamina"
      />
    </div>

    <div class="vitals__stats">
      <span
        class="vitals__level"
        :aria-label="t('pages.home.stats.level', { level: level ?? '-' })"
      >
        <span class="vitals__level-label">{{ t('pages.home.stats.lv') }}</span>
        {{ level ?? '–' }}
      </span>

      <div
        class="vitals__xp"
        role="progressbar"
        :aria-label="t('pages.home.stats.xp')"
        :aria-valuenow="xpPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :title="xpText"
      >
        <div
          class="vitals__xp-fill"
          :style="{ width: `${xpPercent}%` }"
        />
      </div>

      <span
        class="vitals__chip"
        :aria-label="t('pages.home.stats.gold')"
      >
        <base-icon
          icon-path="delapouite/two-coins.svg"
          :size="13"
          background-color="#d8b45a"
        />
        {{ goldText }}
      </span>

      <span
        class="vitals__chip"
        :class="{ 'vitals__chip--over': isOverEncumbered }"
        :aria-label="t('pages.home.stats.carry')"
      >
        <base-icon
          icon-path="delapouite/weight.svg"
          :size="13"
          :background-color="isOverEncumbered ? '#d9604f' : 'var(--skyrim-text-secondary)'"
        />
        {{ carryText }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { BaseIcon, StatBar } from '@/shared/ui';
import { useCharacterStatsDisplay } from '@/pages/character/composables/useCharacterStatsDisplay';
import { useCharacterStore } from '@/stores/character/useCharacterStore';

const { t } = useI18n();

// Same order as the in-game HUD: magicka, health, stamina.
const { healthPercentage, magickaPercentage, staminaPercentage } = useCharacterStatsDisplay();
const { stats } = storeToRefs(useCharacterStore());

/** Stats arrive as number | null | undefined; collapse to number | null. */
function num(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const level = computed(() => num(stats.value.level));

const xpPercent = computed(() => {
  const xp = num(stats.value.xp);
  const next = num(stats.value.xpNext);
  if (xp === null || next === null || next <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((xp / next) * 100)));
});

const xpText = computed(() => {
  const xp = num(stats.value.xp);
  const next = num(stats.value.xpNext);
  if (xp === null || next === null) return '';
  return `${String(Math.floor(xp))} / ${String(Math.floor(next))}`;
});

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

const goldText = computed(() => {
  const gold = num(stats.value.gold);
  if (gold === null) return '–';
  return gold >= 10000 ? compact.format(gold) : String(gold);
});

const isOverEncumbered = computed(() => {
  const w = num(stats.value.inventoryWeight);
  const c = num(stats.value.carryWeight);
  return w !== null && c !== null && w > c;
});

const carryText = computed(() => {
  const w = num(stats.value.inventoryWeight);
  const c = num(stats.value.carryWeight);
  if (w === null || c === null) return '–';
  return `${String(Math.round(w))}/${String(Math.round(c))}`;
});
</script>

<style scoped lang="scss">
.vitals {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vitals__bars {
  display: grid;
  grid-template-columns: 1fr 1.25fr 1fr;
  gap: var(--spacing-sm);
  align-items: center;
}

.vitals__bar :deep(.stat-wrapper) {
  height: 14px;
}

/*
 * One quiet line under the bars: level badge, a hairline XP bar that fills
 * the space, then gold and carry weight. Numbers use tabular figures so the
 * row does not jitter as values change.
 */
.vitals__stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  font-family: var(--font-heading);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--skyrim-text-secondary);
  white-space: nowrap;
}

.vitals__level {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  color: var(--skyrim-text-primary);
  font-size: 0.85rem;
}

.vitals__level-label {
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: var(--skyrim-text-accent);
}

.vitals__xp {
  position: relative;
  flex: 1;
  min-width: 40px;
  height: 3px;
  overflow: hidden;
  background: rgb(255 255 255 / 10%);
  border-radius: 2px;
}

.vitals__xp-fill {
  height: 100%;
  background: linear-gradient(90deg, #8a7040, #e8d49a);
  box-shadow: 0 0 6px rgb(232 212 154 / 55%);
  transition: width var(--transition-normal);
}

.vitals__chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;

  &--over {
    color: #d9604f;
  }
}
</style>
