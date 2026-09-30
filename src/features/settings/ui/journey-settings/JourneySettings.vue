<template>
  <section class="panel">
    <h3 class="modal-title text-base m-0">
      {{ t('app.settings.journey.title') }}
    </h3>
    <div class="d-flex items-center justify-between gap-md">
      <span class="text-sm">{{ t('app.settings.journey.record') }}</span>
      <base-switch
        :model-value="journeyRecordingEnabled"
        :aria-label="t('app.settings.journey.record')"
        @update:model-value="persistJourneyRecording"
      />
    </div>
    <div class="d-flex items-center justify-between gap-md">
      <span class="text-sm">{{ t('app.settings.journey.objectives') }}</span>
      <base-switch
        :model-value="journeyObjectivesEnabled"
        :aria-label="t('app.settings.journey.objectives')"
        @update:model-value="persistJourneyObjectives"
      />
    </div>
    <p class="text-sm text-secondary m-0">
      {{ t('app.settings.journey.hint') }}
    </p>
    <p class="text-sm text-secondary m-0">
      {{ t('app.settings.journey.storage', { sessions: totals.sessions, notes: totals.notes, size: usage }) }}
    </p>
    <div>
      <button
        type="button"
        class="btn self-start"
        @click="onDeleteAll"
      >
        {{ armed ? t('app.settings.journey.confirmDeleteAll') : t('app.settings.journey.deleteAll') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { BaseSwitch } from '@/shared/ui';
import {
  journeyObjectivesEnabled,
  journeyRecordingEnabled,
  persistJourneyObjectives,
  persistJourneyRecording,
} from '@/shared/lib/settings/journeyPreference';
import { useJourneyStore } from '@/stores/journey/useJourneyStore';

const { t } = useI18n();
const store = useJourneyStore();
const { totals } = storeToRefs(store);
const usage = ref('–');
const armed = ref(false);

onMounted(async () => {
  await store.load();
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.usage !== undefined) usage.value = `${(estimate.usage / 1024 / 1024).toFixed(1)} MB`;
  } catch {
    /* not available in every WebView */
  }
});

async function onDeleteAll(): Promise<void> {
  if (!armed.value) {
    armed.value = true;
    setTimeout(() => (armed.value = false), 3000);
    return;
  }
  armed.value = false;
  await store.clearAll();
}
</script>
