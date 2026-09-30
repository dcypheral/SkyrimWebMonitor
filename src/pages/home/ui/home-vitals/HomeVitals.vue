<template>
  <div class="vitals">
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
</template>

<script setup lang="ts">
import { StatBar } from '@/shared/ui';
import { useCharacterStatsDisplay } from '@/pages/character/composables/useCharacterStatsDisplay';

// Same order as the in-game HUD: magicka, health, stamina.
const { healthPercentage, magickaPercentage, staminaPercentage } = useCharacterStatsDisplay();
</script>

<style scoped lang="scss">
.vitals {
  display: grid;
  grid-template-columns: 1fr 1.25fr 1fr;
  gap: var(--spacing-sm);
  align-items: center;
}

.vitals__bar :deep(.stat-wrapper) {
  height: 14px;
}
</style>
