<template>
  <section class="panel">
    <h3 class="modal-title text-base m-0">
      {{ t('app.settings.guide.title') }}
    </h3>
    <guide-file-card />
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { GuideFileCard } from '@/features/guide';

const { t } = useI18n();
</script>
