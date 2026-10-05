<template>
  <div class="gfile">
    <input
      ref="input"
      type="file"
      accept="application/pdf,.pdf"
      class="gfile__input"
      @change="onPicked"
    >

    <template v-if="status === 'ready'">
      <div class="gfile__row">
        <guide-icon
          name="book"
          :size="26"
          class="gfile__icon"
        />
        <div class="gfile__info">
          <span class="gfile__name">{{ fileName }}</span>
          <span class="gfile__meta">
            {{ t('shared.ui.guide.fileMeta', { pages: pageCount, size: sizeText }) }}
          </span>
        </div>
      </div>
      <p
        v-if="!persisted"
        class="gfile__warn"
      >
        {{ t('shared.ui.guide.notPersisted') }}
      </p>
      <p class="gfile__meta">
        <template v-if="indexDone">
          {{ t('shared.ui.guide.indexReady') }}
        </template>
        <template v-else>
          {{ t('shared.ui.guide.indexing', { done: indexedPages, total: pageCount }) }}
        </template>
      </p>
      <div class="gfile__actions">
        <button
          type="button"
          class="gfile__btn"
          @click="pick"
        >
          {{ t('shared.ui.guide.replace') }}
        </button>
        <button
          type="button"
          class="gfile__btn gfile__btn--quiet"
          @click="confirmRemove"
        >
          {{ removeArmed ? t('shared.ui.guide.removeConfirm') : t('shared.ui.guide.remove') }}
        </button>
      </div>
    </template>

    <template v-else-if="status === 'loading'">
      <p class="gfile__meta gfile__busy">
        {{ t('shared.ui.guide.opening') }}
      </p>
    </template>

    <template v-else>
      <p
        v-if="!compact"
        class="gfile__text"
      >
        {{ t('shared.ui.guide.pitch') }}
      </p>
      <p
        v-if="status === 'error' && error"
        class="gfile__warn"
      >
        {{ t('shared.ui.guide.openFailed') }} ({{ error }})
      </p>
      <button
        type="button"
        class="gfile__btn gfile__btn--primary"
        @click="pick"
      >
        <guide-icon
          name="file"
          :size="18"
        />
        {{ t('shared.ui.guide.choose') }}
      </button>
      <p class="gfile__fine">
        {{ t('shared.ui.guide.privacy') }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useGuideStore } from '@/stores/guide/useGuideStore';
import GuideIcon from '../guide-icon/GuideIcon.vue';

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const { t } = useI18n();
const guide = useGuideStore();
const { status, error, fileName, fileSize, pageCount, indexedPages, persisted } = storeToRefs(guide);

void guide.init();

const input = ref<HTMLInputElement | null>(null);
const removeArmed = ref(false);
let disarmTimer: ReturnType<typeof setTimeout> | null = null;

const indexDone = computed(() => guide.indexComplete());
const sizeText = computed(() => `${(fileSize.value / 1024 / 1024).toFixed(0)} MB`);

function pick(): void {
  input.value?.click();
}

function onPicked(e: Event): void {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  const file = el.files?.[0];
  el.value = '';
  if (file) void guide.pickFile(file);
}

function confirmRemove(): void {
  if (!removeArmed.value) {
    removeArmed.value = true;
    disarmTimer = setTimeout(() => {
      removeArmed.value = false;
    }, 3000);
    return;
  }
  if (disarmTimer) clearTimeout(disarmTimer);
  removeArmed.value = false;
  void guide.removeFile();
}
</script>

<style scoped lang="scss">
.gfile {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gfile__input {
  display: none;
}

.gfile__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.gfile__icon {
  color: var(--skyrim-accent-main);
}

.gfile__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.gfile__name {
  overflow: hidden;
  color: var(--skyrim-text-accent);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gfile__meta,
.gfile__text,
.gfile__fine,
.gfile__warn {
  margin: 0;
  color: var(--skyrim-text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.gfile__text {
  font-size: var(--font-size-sm);
}

.gfile__fine {
  color: var(--skyrim-text-dim);
}

.gfile__warn {
  color: #e08a6a;
}

.gfile__busy::after {
  content: '…';
  animation: gfile-dots 1.2s steps(4) infinite;
}

@keyframes gfile-dots {
  0% { opacity: 0.2; }
  100% { opacity: 1; }
}

.gfile__actions {
  display: flex;
  gap: 8px;
}

.gfile__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 4px;
  background: var(--skyrim-bg-light);
  color: var(--skyrim-text-primary);
  font-size: var(--font-size-sm);

  &--primary {
    border-color: var(--skyrim-accent-main-dim);
    background: rgb(201 162 39 / 14%);
    color: var(--skyrim-accent-main-light, #e5c44d);
  }

  &--quiet {
    background: none;
    color: var(--skyrim-text-secondary);
  }
}
</style>
