<template>
  <div class="journal">
    <header class="journal__summary">
      <span class="journal__totals">
        <span>
          <base-icon
            icon-path="lorc/hourglass.svg"
            :size="12"
          />
          {{ formatDuration(totals.activeMs) }}
        </span>
        <span>
          <base-icon
            icon-path="delapouite/trail.svg"
            :size="12"
          />
          {{ formatDistance(totals.distance) }}
        </span>
        <span>
          <base-icon
            icon-path="lorc/quill-ink.svg"
            :size="12"
          />
          {{ totals.notes }}/{{ MAX_NOTES }}
        </span>
      </span>
      <button
        type="button"
        class="btn journal__new"
        :aria-label="t('pages.journal.newNote')"
        @click="noteActions.openNewNote()"
      >
        <base-icon
          icon-path="lorc/quill-ink.svg"
          :size="16"
        />
      </button>
      <button
        type="button"
        class="btn journal__export"
        :disabled="busy || (!sessions.length && !notes.length)"
        @click="runExport(() => exportAll(sessions, notes))"
      >
        <base-icon
          icon-path="delapouite/save.svg"
          :size="14"
        />
        {{ t('pages.journal.exportAll') }}
      </button>
      <button
        type="button"
        class="btn journal__new"
        :disabled="busy"
        :aria-label="t('pages.journal.restore')"
        :title="t('pages.journal.restore')"
        @click="fileInput?.click()"
      >
        <base-icon
          icon-path="delapouite/open-folder.svg"
          :size="16"
        />
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".zip,.json,application/zip,application/json"
        hidden
        @change="onRestoreFile"
      >
    </header>

    <div
      v-if="!detail"
      class="journal__tabs"
      role="tablist"
    >
      <button
        v-for="tab in TABS"
        :key="tab"
        type="button"
        role="tab"
        class="journal__tab"
        :class="{ 'journal__tab--active': view === tab }"
        :aria-selected="view === tab"
        @click="view = tab"
      >
        {{ t(`pages.journal.tabs.${tab}`) }}
        <span
          v-if="tab !== 'shots'"
          class="journal__count"
        >{{ tab === 'sessions' ? sessions.length : notes.length }}</span>
      </button>
    </div>

    <div class="journal__body">
      <session-detail
        v-if="detail"
        :key="detail.id"
        :session="detail"
        @back="detailId = null"
        @rename="(title: string) => store.renameSession(detail!.id, title)"
        @map="showSessionOnMap(detail.id)"
        @export="runExport(() => exportSession(detail!, notes))"
        @delete="deleteSession(detail.id)"
        @note="(id: number) => noteActions.openNote(id)"
      />
      <session-list
        v-else-if="view === 'sessions'"
        :sessions="sessions"
        :active-id="activeSessionId"
        @open="(id: number) => (detailId = id)"
      />
      <template v-else-if="view === 'notes'">
        <notes-list
          :notes="notes"
          @open="(id: number) => noteActions.openNote(id)"
        />
        <button
          v-if="notes.length"
          type="button"
          class="btn journal__notes-export"
          :disabled="busy"
          @click="runExport(() => exportNotes(notes))"
        >
          {{ t('pages.journal.exportNotes') }}
        </button>
      </template>
      <screenshot-test v-else />
    </div>

    <div
      v-if="saved"
      class="journal__toast"
      role="status"
    >
      <span>{{ toastText }}</span>
      <button
        v-if="saved.file && canShare"
        type="button"
        class="btn"
        @click="share"
      >
        {{ t('pages.journal.share') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { canShareFiles, shareFile, type SavedFile } from '@/shared/lib/utils/saveFile';
import { journeyLayers } from '@/shared/lib/settings/journeyLayers';
import { exportAll, exportNotes, exportSession, importBackup, useNoteActions } from '@/features/journey';
import { MAX_NOTES, useJourneyStore } from '@/stores/journey/useJourneyStore';
import { useNavigationStore } from '@/stores/use-navigation-store/useNavigationStore';
import { formatDistance, formatDuration } from '../lib/format';
import SessionList from '../ui/session-list/SessionList.vue';
import SessionDetail from '../ui/session-detail/SessionDetail.vue';
import NotesList from '../ui/notes-list/NotesList.vue';
import ScreenshotTest from '../ui/screenshot-test/ScreenshotTest.vue';

const TABS = ['sessions', 'notes', 'shots'] as const;
type View = (typeof TABS)[number];

const { t } = useI18n();
const store = useJourneyStore();
const nav = useNavigationStore();
const noteActions = useNoteActions();
const { sortedSessions: sessions, sortedNotes: notes, totals, activeSessionId } = storeToRefs(store);

const view = ref<View>('sessions');
const detailId = ref<number | null>(null);
const detail = computed(() => sessions.value.find((s) => s.id === detailId.value) ?? null);

const busy = ref(false);
const saved = ref<{ location: string; file: SavedFile | null; error: string | null; message?: string } | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const toastText = computed(() => {
  const s = saved.value;
  if (!s) return '';
  if (s.message) return s.message;
  return s.error ? t('pages.journal.exportFailed', { reason: s.error }) : t('pages.journal.savedTo', { location: s.location });
});

async function onRestoreFile(event: Event): Promise<void> {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  busy.value = true;
  try {
    const c = await importBackup(file);
    const message =
      c.sessionsAdded + c.sessionsUpdated + c.notesAdded + c.notesUpdated === 0
        ? t('pages.journal.restoreNothing')
        : t('pages.journal.restored', {
          sessions: c.sessionsAdded + c.sessionsUpdated,
          notes: c.notesAdded + c.notesUpdated,
        }) + (c.notesSkipped ? ` ${t('pages.journal.restoreSkipped', { count: c.notesSkipped })}` : '');
    showToast({ location: '', file: null, error: null, message });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    showToast({ location: '', file: null, error: reason, message: t('pages.journal.restoreFailed', { reason }) });
  } finally {
    busy.value = false;
  }
}
const canShare = canShareFiles();
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(value: NonNullable<typeof saved.value>): void {
  saved.value = value;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (saved.value = null), 8000);
}

async function runExport(fn: () => Promise<SavedFile>): Promise<void> {
  busy.value = true;
  try {
    const file = await fn();
    showToast({ location: file.location, file, error: null });
  } catch (err) {
    showToast({ location: '', file: null, error: err instanceof Error ? err.message : String(err) });
  } finally {
    busy.value = false;
  }
}

async function share(): Promise<void> {
  const file = saved.value?.file;
  if (file) await shareFile(file, t('pages.journal.tab')).catch(() => undefined);
}

function showSessionOnMap(id: number): void {
  journeyLayers.path = true;
  journeyLayers.focusSessionId = id;
  nav.setActiveTab('map');
}

async function deleteSession(id: number): Promise<void> {
  detailId.value = null;
  if (journeyLayers.focusSessionId === id) journeyLayers.focusSessionId = null;
  await store.deleteSession(id);
}
</script>

<style scoped lang="scss">
.journal {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 0;
  padding: var(--spacing-sm);
}

.journal__summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.journal__totals {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
  font-family: var(--font-heading);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--skyrim-text-secondary);

  > span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
}

.journal__new {
  width: 38px;
  min-height: 36px;
  padding: 0;
}

.journal__export {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 36px;
  font-size: 0.7rem;
}

.journal__tabs {
  display: flex;
  border-bottom: 1px solid var(--skyrim-border-dark);
}

.journal__tab {
  flex: 1;
  padding: 6px 0 7px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--skyrim-text-secondary);
  font-family: var(--font-heading);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;

  &--active {
    border-bottom-color: var(--skyrim-accent-main);
    color: var(--skyrim-text-primary);
  }
}

.journal__count {
  margin-left: 4px;
  color: var(--skyrim-text-dim);
}

.journal__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 0;
  overflow-y: auto;
}

.journal__notes-export {
  align-self: flex-start;
  min-height: 34px;
  font-size: 0.7rem;
}

.journal__toast {
  position: absolute;
  right: var(--spacing-sm);
  bottom: var(--spacing-sm);
  left: var(--spacing-sm);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 8px 10px;
  background: rgb(12 12 12 / 94%);
  border: 1px solid var(--skyrim-border-accent);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;

  span {
    flex: 1;
  }

  .btn {
    min-height: 32px;
    font-size: 0.7rem;
  }
}
</style>
