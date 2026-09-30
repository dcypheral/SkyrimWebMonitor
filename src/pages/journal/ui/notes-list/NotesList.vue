<template>
  <div class="notes">
    <input
      v-model="query"
      class="input notes__search"
      type="search"
      :placeholder="t('pages.journal.searchNotes')"
    >
    <ul
      v-if="filtered.length"
      class="notes__list"
    >
      <li
        v-for="n in filtered"
        :key="n.id"
      >
        <button
          type="button"
          class="note"
          @click="emit('open', n.id)"
        >
          <span class="note__thumb">
            <img
              v-if="thumbs[n.id]"
              :src="thumbs[n.id]"
              alt=""
            >
            <base-icon
              v-else
              icon-path="lorc/quill-ink.svg"
              :size="20"
              background-color="var(--skyrim-text-secondary)"
            />
          </span>
          <span class="note__body">
            <span class="note__text">{{ firstLine(n.text) }}</span>
            <span class="note__meta">
              {{ when(n.createdAt) }}<template v-if="n.place"> · {{ n.place }}</template>
              <template v-if="!n.worldspace && !n.place"> · {{ t('pages.journal.noPinShort') }}</template>
            </span>
          </span>
        </button>
      </li>
    </ul>
    <p
      v-else
      class="notes__empty"
    >
      {{ notes.length ? t('pages.journal.noMatches') : t('pages.journal.noNotes') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { useJourneyStore } from '@/stores/journey/useJourneyStore';
import type { JourneyNote } from '@/stores/journey/lib/types';

const props = defineProps<{ notes: JourneyNote[] }>();
const emit = defineEmits<{ open: [id: number] }>();
const { t, locale } = useI18n();
const store = useJourneyStore();

const query = ref('');
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.notes;
  return props.notes.filter((n) => n.text.toLowerCase().includes(q) || (n.place ?? '').toLowerCase().includes(q));
});

/** Photo thumbnails load lazily for what is listed. */
const thumbs = reactive<Record<number, string>>({});
watch(
  filtered,
  async (list) => {
    for (const n of list.slice(0, 60)) {
      if (!n.hasPhoto || thumbs[n.id]) continue;
      const url = await store.photoUrl(n.id);
      if (url) thumbs[n.id] = url;
    }
  },
  { immediate: true },
);

function firstLine(text: string): string {
  const line = text.trim().split('\n')[0];
  return line || t('pages.journal.photoNote');
}

function when(ms: number): string {
  return new Date(ms).toLocaleString(locale.value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped lang="scss">
.notes {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.notes__search {
  font-size: var(--font-size-sm);
}

.notes__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.note {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px;
  background: rgb(255 255 255 / 3%);
  border: 1px solid var(--skyrim-border-dark);
  border-radius: var(--radius-md);
  color: var(--skyrim-text-primary);
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
}

.note__thumb {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  overflow: hidden;
  background: rgb(0 0 0 / 35%);
  border-radius: var(--radius-sm);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.note__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.note__text {
  overflow: hidden;
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note__meta {
  overflow: hidden;
  font-size: 0.7rem;
  color: var(--skyrim-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes__empty {
  margin: var(--spacing-lg) 0;
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-dim);
  text-align: center;
}
</style>
