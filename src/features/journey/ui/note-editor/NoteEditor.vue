<template>
  <div class="modal-content note-editor">
    <div class="note-editor__head">
      <base-icon
        icon-path="lorc/quill-ink.svg"
        :size="18"
        background-color="var(--skyrim-text-accent)"
      />
      <h3 class="modal-title text-base m-0">
        {{ note ? t('pages.journal.editNote') : t('pages.journal.newNote') }}
      </h3>
    </div>
    <p class="note-editor__where">
      {{ whereText }}
    </p>

    <textarea
      ref="textarea"
      v-model="text"
      class="input note-editor__text"
      rows="4"
      :maxlength="MAX_NOTE_TEXT"
      :placeholder="t('pages.journal.notePlaceholder')"
    />

    <div
      v-if="photoUrl"
      class="note-editor__photo"
    >
      <img
        :src="photoUrl"
        alt=""
      >
      <button
        type="button"
        class="note-editor__photo-remove"
        :aria-label="t('pages.journal.removePhoto')"
        @click="removePhoto"
      >
        ×
      </button>
    </div>

    <div class="note-editor__attach">
      <label class="btn note-editor__attach-btn">
        <base-icon
          icon-path="delapouite/photo-camera.svg"
          :size="16"
        />
        {{ t('pages.journal.addPhoto') }}
        <input
          type="file"
          accept="image/*"
          class="note-editor__file"
          @change="onFile"
        >
      </label>
      <button
        v-if="screenshots.isAvailable.value"
        type="button"
        class="btn note-editor__attach-btn"
        :disabled="isCapturing"
        @click="captureGame"
      >
        <base-icon
          icon-path="lorc/scroll-unfurled.svg"
          :size="16"
        />
        {{ isCapturing ? t('pages.journal.capturing') : t('pages.journal.gameScreenshot') }}
      </button>
    </div>

    <p
      v-if="error"
      class="note-editor__error"
      role="alert"
    >
      {{ error }}
    </p>

    <div class="note-editor__actions">
      <button
        type="button"
        class="btn"
        @click="emit('close')"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!canSave || isSaving"
        @click="save"
      >
        {{ t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { resizeImage } from '@/shared/lib/utils/imageFile';
import { MAX_NOTE_TEXT, MAX_NOTES, useJourneyStore, type NoteInput } from '@/stores/journey/useJourneyStore';
import { useMapPlayerStore } from '@/stores/map/useMapPlayerStore';
import type { JourneyNote } from '@/stores/journey/lib/types';
import { useGameScreenshots } from '../../composables/useGameScreenshots';

const props = defineProps<{ note?: JourneyNote | null }>();
const emit = defineEmits<{ close: []; saved: [id: number] }>();
const { t } = useI18n();

const store = useJourneyStore();
const player = useMapPlayerStore();
const screenshots = useGameScreenshots();

const textarea = ref<HTMLTextAreaElement | null>(null);
const text = ref(props.note?.text ?? '');
/** undefined = unchanged, null = removed, object = new photo */
const photo = ref<NoteInput['photo']>(undefined);
const photoUrl = ref<string | null>(null);
const error = ref<string | null>(null);
const isSaving = ref(false);
const isCapturing = ref(false);
let ownUrl: string | null = null;

const canSave = computed(() => text.value.trim().length > 0 || !!photo.value || (!!props.note?.hasPhoto && photo.value !== null));

const whereText = computed(() => {
  const n = props.note;
  if (n) return n.place ? t('pages.journal.inside', { place: n.place }) : n.worldspace ? t('pages.journal.pinned') : t('pages.journal.noPin');
  const live = player.position;
  if (live?.isInterior && live.cell) return t('pages.journal.inside', { place: live.cell });
  return player.displayPosition ? t('pages.journal.pinHere') : t('pages.journal.noPin');
});

onMounted(async () => {
  if (props.note?.hasPhoto) photoUrl.value = await store.photoUrl(props.note.id);
  await nextTick();
  textarea.value?.focus();
});

onBeforeUnmount(() => {
  if (ownUrl) URL.revokeObjectURL(ownUrl);
});

function showPhoto(blob: Blob): void {
  if (ownUrl) URL.revokeObjectURL(ownUrl);
  ownUrl = URL.createObjectURL(blob);
  photoUrl.value = ownUrl;
}

async function onFile(event: Event): Promise<void> {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
  error.value = null;
  try {
    const resized = await resizeImage(input.files[0]);
    photo.value = { ...resized, source: 'device' };
    showPhoto(resized.blob);
  } catch {
    error.value = t('pages.journal.photoFailed');
  } finally {
    input.value = '';
  }
}

async function captureGame(): Promise<void> {
  error.value = null;
  isCapturing.value = true;
  try {
    const shot = await screenshots.captureNew();
    photo.value = { blob: shot.blob, width: shot.width, height: shot.height, source: 'game' };
    showPhoto(shot.blob);
  } catch (err) {
    error.value = t('pages.journal.screenshotFailed', { reason: err instanceof Error ? err.message : String(err) });
  } finally {
    isCapturing.value = false;
  }
}

function removePhoto(): void {
  photo.value = null;
  photoUrl.value = null;
}

async function save(): Promise<void> {
  isSaving.value = true;
  error.value = null;
  try {
    const input: NoteInput = { text: text.value.trim(), photo: photo.value };
    if (props.note) {
      await store.updateNote(props.note.id, input);
      emit('saved', props.note.id);
      return;
    }
    const created = await store.addNote(input);
    if (created === 'limit') {
      error.value = t('pages.journal.noteLimit', { max: MAX_NOTES });
      return;
    }
    emit('saved', created.id);
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped lang="scss">
.note-editor {
  gap: var(--spacing-sm);
  width: min(380px, 86vw);
  min-width: 0;
  padding: var(--spacing-md);
}

.note-editor__head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.note-editor__where {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--skyrim-text-secondary);
}

.note-editor__text {
  min-height: 88px;
  resize: vertical;
  font-size: var(--font-size-sm);
  line-height: 1.35;
}

.note-editor__photo {
  position: relative;
  align-self: flex-start;

  img {
    display: block;
    max-width: 100%;
    max-height: 140px;
    border: 1px solid var(--skyrim-border-dark);
    border-radius: var(--radius-md);
  }
}

.note-editor__photo-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 28px;
  height: 28px;
  padding: 0;
  background: rgb(0 0 0 / 70%);
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 50%;
  color: var(--skyrim-text-primary);
  cursor: pointer;
}

.note-editor__attach {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.note-editor__attach-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  font-size: var(--font-size-xs);
  cursor: pointer;
}

.note-editor__file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.note-editor__error {
  margin: 0;
  font-size: var(--font-size-xs);
  color: #e08a7c;
}

.note-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
