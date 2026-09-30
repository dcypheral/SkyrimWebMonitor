<template>
  <section class="panel">
    <h3 class="modal-title text-base m-0">
      {{ t('app.settings.homeMap.title') }}
    </h3>
    <div class="d-flex items-center justify-between gap-md">
      <span class="text-sm">{{ t('app.settings.homeMap.toggle') }}</span>
      <base-switch
        :model-value="homeMapMode === 'auto'"
        :aria-label="t('app.settings.homeMap.toggle')"
        @update:model-value="(on: boolean) => persistHomeMapMode(on ? 'auto' : 'world')"
      />
    </div>
    <p class="text-sm text-secondary m-0">
      {{ t('app.settings.homeMap.hint') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { BaseSwitch } from '@/shared/ui';
import { homeMapMode, persistHomeMapMode } from '@/shared/lib/settings/homeMapPreference';

const { t } = useI18n();
</script>
