<template>
  <section
    v-if="isCompanionModeSupported"
    class="panel"
  >
    <h3 class="modal-title text-base m-0">
      {{ t('app.settings.companion.title') }}
    </h3>
    <div class="d-flex items-center justify-between gap-md">
      <span class="text-sm">{{ t('app.settings.companion.toggle') }}</span>
      <base-switch
        :model-value="companionModeEnabled"
        :aria-label="t('app.settings.companion.toggle')"
        @update:model-value="persistCompanionMode"
      />
    </div>
    <p class="text-sm text-secondary m-0">
      {{ t('app.settings.companion.hint') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { BaseSwitch } from '@/shared/ui';
import {
  companionModeEnabled,
  isCompanionModeSupported,
  persistCompanionMode,
} from '@/shared/lib/native/companionMode';

const { t } = useI18n();
</script>
