<template>
  <div class="modal-content note-view">
    <img
      v-if="photoUrl"
      class="note-view__photo"
      :src="photoUrl"
      alt=""
    >
    <p class="note-view__meta">
      {{ when }}<template v-if="note.place">
        · {{ note.place }}
      </template>
    </p>
    <p
      v-if="note.text"
      class="note-view__text"
    >
      {{ note.text }}
    </p>

    <div class="note-view__actions">
      <button
        v-if="note.worldspace && showMapButton"
        type="button"
        class="btn"
        @click="emit('map', note.id)"
      >
        {{ t('pages.journal.showOnMap') }}
      </button>
      <button
        type="button"
        class="btn"
        @click="emit('edit', note.id)"
      >
        {{ t('common.edit') }}
      </button>
      <button
        type="button"
        class="btn note-view__delete"
        :class="{ 'note-view__delete--armed': armed }"
        @click="onDelete"
      >
        {{ armed ? t('pages.journal.confirmDelete') : t('common.delete') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useJourneyStore } from '@/stores/journey/useJourneyStore';
import type { JourneyNote } from '@/stores/journey/lib/types';

const props = withDefaults(defineProps<{ note: JourneyNote; showMapButton?: boolean }>(), { showMapButton: true });
const emit = defineEmits<{ edit: [id: number]; delete: [id: number]; map: [id: number] }>();
const { t, locale } = useI18n();
const store = useJourneyStore();

const photoUrl = ref<string | null>(null);
const armed = ref(false);

const when = computed(() =>
  new Date(props.note.createdAt).toLocaleString(locale.value, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
);

onMounted(async () => {
  if (props.note.hasPhoto) photoUrl.value = await store.photoUrl(props.note.id);
});

function onDelete(): void {
  if (!armed.value) {
    armed.value = true;
    setTimeout(() => (armed.value = false), 3000);
    return;
  }
  emit('delete', props.note.id);
}
</script>

<style scoped lang="scss">
.note-view {
  gap: var(--spacing-sm);
  width: min(400px, 86vw);
  min-width: 0;
  padding: var(--spacing-md);
}

.note-view__photo {
  display: block;
  width: 100%;
  max-height: 46vh;
  object-fit: contain;
  background: #000;
  border: 1px solid var(--skyrim-border-dark);
  border-radius: var(--radius-md);
}

.note-view__meta {
  margin: 0;
  font-family: var(--font-heading);
  font-size: var(--font-size-xs);
  letter-spacing: 0.04em;
  color: var(--skyrim-text-secondary);
}

.note-view__text {
  max-height: 30vh;
  margin: 0;
  overflow-y: auto;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.note-view__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);

  .btn {
    min-height: 36px;
    font-size: var(--font-size-xs);
  }
}

.note-view__delete--armed {
  border-color: #c0604f;
  color: #f0b0a4;
}
</style>
