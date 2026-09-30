<template>
  <div class="shots">
    <p class="shots__intro">
      {{ t('pages.journal.shots.intro') }}
    </p>

    <p
      v-if="!screenshots.isAvailable.value"
      class="shots__warn"
    >
      {{ t('pages.journal.shots.needPlugin') }}
    </p>

    <template v-else>
      <div class="shots__actions">
        <button
          type="button"
          class="btn"
          :disabled="busy"
          @click="take"
        >
          {{ t('pages.journal.shots.take') }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="busy"
          @click="refresh"
        >
          {{ t('pages.journal.shots.refresh') }}
        </button>
      </div>

      <p
        v-if="status"
        class="shots__status"
        :class="{ 'shots__status--error': statusIsError }"
      >
        {{ status }}
      </p>

      <figure
        v-if="preview"
        class="shots__preview"
      >
        <img
          :src="preview.url"
          alt=""
        >
        <figcaption>
          {{ preview.name }} · {{ preview.width }}×{{ preview.height }} · {{ formatBytes(preview.bytes) }}
          · {{ preview.ms }} ms
        </figcaption>
        <button
          type="button"
          class="btn"
          :disabled="busy"
          @click="saveAsNote"
        >
          {{ t('pages.journal.shots.saveAsNote') }}
        </button>
      </figure>

      <p
        v-if="directory"
        class="shots__dir"
      >
        {{ t('pages.journal.shots.folder', { folder: directory, total }) }}
      </p>
      <ul class="shots__list">
        <li
          v-for="f in files"
          :key="f.name"
        >
          <button
            type="button"
            class="shots__file"
            :disabled="busy"
            @click="open(f.name)"
          >
            <span>{{ f.name }}</span>
            <span class="shots__file-meta">{{ formatBytes(f.size) }} · {{ fileTime(f.modified) }}</span>
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ScreenshotFileInfo } from '@/api/websocket';
import { useGameScreenshots, type GameScreenshot } from '@/features/journey';
import { MAX_NOTES, useJourneyStore } from '@/stores/journey/useJourneyStore';
import { formatBytes } from '../../lib/format';

const { t, locale } = useI18n();
const screenshots = useGameScreenshots();
const journey = useJourneyStore();

const busy = ref(false);
const status = ref('');
const statusIsError = ref(false);
const directory = ref('');
const total = ref(0);
const files = ref<ScreenshotFileInfo[]>([]);
const preview = ref<{ url: string; name: string; width: number; height: number; bytes: number; ms: number; shot: GameScreenshot } | null>(null);

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function setStatus(text: string, error = false): void {
  status.value = text;
  statusIsError.value = error;
}

function show(shot: GameScreenshot, ms: number): void {
  if (preview.value) URL.revokeObjectURL(preview.value.url);
  preview.value = {
    url: URL.createObjectURL(shot.blob),
    name: shot.name,
    width: shot.width,
    height: shot.height,
    bytes: shot.blob.size,
    ms,
    shot,
  };
}

async function refresh(): Promise<void> {
  busy.value = true;
  try {
    const result = await screenshots.list(10);
    directory.value = result.directory;
    total.value = result.total;
    files.value = result.files;
    setStatus(result.total ? '' : t('pages.journal.shots.none'));
  } catch (err) {
    setStatus(t('pages.journal.shots.failed', { reason: reason(err) }), true);
  } finally {
    busy.value = false;
  }
}

async function take(): Promise<void> {
  busy.value = true;
  setStatus(t('pages.journal.shots.waiting'));
  const started = performance.now();
  try {
    const shot = await screenshots.captureNew();
    show(shot, Math.round(performance.now() - started));
    setStatus(t('pages.journal.shots.ok'));
  } catch (err) {
    setStatus(t('pages.journal.shots.failed', { reason: reason(err) }), true);
  } finally {
    busy.value = false;
  }
  await refresh();
}

async function open(name: string): Promise<void> {
  busy.value = true;
  const started = performance.now();
  try {
    show(await screenshots.fetch(name), Math.round(performance.now() - started));
    setStatus('');
  } catch (err) {
    setStatus(t('pages.journal.shots.failed', { reason: reason(err) }), true);
  } finally {
    busy.value = false;
  }
}

async function saveAsNote(): Promise<void> {
  const p = preview.value;
  if (!p) return;
  busy.value = true;
  try {
    const result = await journey.addNote({
      text: '',
      photo: { blob: p.shot.blob, width: p.width, height: p.height, source: 'game' },
    });
    setStatus(result === 'limit' ? t('pages.journal.noteLimit', { max: MAX_NOTES }) : t('pages.journal.shots.saved'), result === 'limit');
  } finally {
    busy.value = false;
  }
}

function fileTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  if (screenshots.isAvailable.value) void refresh();
});

onBeforeUnmount(() => {
  if (preview.value) URL.revokeObjectURL(preview.value.url);
});
</script>

<style scoped lang="scss">
.shots {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  font-size: var(--font-size-xs);
}

.shots__intro,
.shots__dir {
  margin: 0;
  color: var(--skyrim-text-secondary);
  line-height: 1.35;
}

.shots__dir {
  overflow-wrap: anywhere;
}

.shots__warn,
.shots__status--error {
  color: #e08a7c;
}

.shots__status {
  margin: 0;
}

.shots__actions {
  display: flex;
  gap: var(--spacing-sm);

  .btn {
    min-height: 36px;
    font-size: var(--font-size-xs);
  }
}

.shots__preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;

  img {
    width: 100%;
    max-height: 40vh;
    object-fit: contain;
    background: #000;
    border: 1px solid var(--skyrim-border-dark);
    border-radius: var(--radius-md);
  }

  figcaption {
    color: var(--skyrim-text-secondary);
  }

  .btn {
    align-self: flex-start;
    min-height: 34px;
    font-size: var(--font-size-xs);
  }
}

.shots__list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shots__file {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  background: rgb(255 255 255 / 3%);
  border: 1px solid var(--skyrim-border-dark);
  border-radius: var(--radius-sm);
  color: var(--skyrim-text-primary);
  font-family: var(--font-body);
  font-size: var(--font-size-xs);
  cursor: pointer;
}

.shots__file-meta {
  color: var(--skyrim-text-secondary);
  white-space: nowrap;
}
</style>
