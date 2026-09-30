<template>
  <section class="panel">
    <h3 class="modal-title text-base m-0">{{ t('app.settings.itemThumbnails.title') }}</h3>
    <template v-if="isModelsProvided">
      <div class="d-flex items-center justify-between gap-md">
        <span class="text-sm">{{ t('app.settings.itemThumbnails.disable') }}</span>
        <base-switch
          :model-value="itemThumbnailsDisabled"
          :aria-label="t('app.settings.itemThumbnails.disable')"
          @update:model-value="persistItemThumbnailsDisabled"
        />
      </div>
      <div>
        <button
          type="button"
          class="btn self-start"
          :disabled="isClearing"
          @click="clearCache"
        >
          <span v-if="isClearing">{{ t('app.settings.itemThumbnails.clearing') }}</span>
          <span v-else>{{ t('app.settings.itemThumbnails.clear') }}</span>
        </button>
        <p class="text-sm text-secondary m-0">{{ t('app.settings.itemThumbnails.hint') }}</p>
        <p class="text-sm text-secondary m-0">
          {{ t('app.settings.itemThumbnails.count', { count: generatedCount }) }}
        </p>
      </div>
    </template>
    <p
      v-else
      class="text-sm text-secondary m-0"
    >
      {{ t('app.settings.updateDll') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { BaseSwitch } from '@/shared/ui';
import { itemThumbnailsDisabled, persistItemThumbnailsDisabled } from '@/shared/lib';
import { useItemThumbnailsStore } from '@/stores/item-thumbnails/useItemThumbnailsStore';
import { useSystemStore } from '@/stores/system/useSystemStore';
import { FEATURES } from '@/stores/system/lib/types';

const { t } = useI18n();
const thumbnailsStore = useItemThumbnailsStore();
const { generatedCount } = storeToRefs(thumbnailsStore);
const systemStore = useSystemStore();
const isModelsProvided = computed(() => systemStore.isFeatureProvided(FEATURES.INVENTORY_MODELS));
const isClearing = ref(false);

async function clearCache(): Promise<void> {
  isClearing.value = true;
  try {
    await thumbnailsStore.clearCache();
  } finally {
    isClearing.value = false;
  }
}
</script>
