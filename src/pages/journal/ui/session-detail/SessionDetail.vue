<template>
  <div class="detail">
    <div class="detail__head">
      <button
        type="button"
        class="btn detail__back"
        :aria-label="t('pages.journal.back')"
        @click="emit('back')"
      >
        ‹
      </button>
      <input
        v-model="title"
        class="input detail__title"
        :placeholder="t('pages.journal.titlePlaceholder')"
        maxlength="120"
        @change="emit('rename', title)"
      >
    </div>

    <p class="detail__date">
      {{ sessionDate(session, locale) }}
    </p>

    <div class="detail__stats">
      <span>
        <base-icon
          icon-path="lorc/hourglass.svg"
          :size="13"
        />
        {{ formatDuration(session.activeMs) }}
      </span>
      <span>
        <base-icon
          icon-path="delapouite/trail.svg"
          :size="13"
        />
        {{ formatDistance(session.distance) }}
      </span>
      <span v-if="session.startLevel !== null && session.endLevel !== null">
        {{ session.startLevel === session.endLevel
          ? t('pages.journal.levelOnly', { level: session.endLevel })
          : t('pages.journal.levelRange', { from: session.startLevel, to: session.endLevel }) }}
      </span>
    </div>

    <div class="detail__actions">
      <button
        type="button"
        class="btn"
        @click="emit('map')"
      >
        <base-icon
          icon-path="delapouite/trail.svg"
          :size="14"
        />
        {{ t('pages.journal.showOnMap') }}
      </button>
      <button
        type="button"
        class="btn"
        @click="emit('export')"
      >
        <base-icon
          icon-path="delapouite/save.svg"
          :size="14"
        />
        {{ t('pages.journal.export') }}
      </button>
      <button
        type="button"
        class="btn detail__delete"
        :class="{ 'detail__delete--armed': armed }"
        @click="onDelete"
      >
        {{ armed ? t('pages.journal.confirmDelete') : t('common.delete') }}
      </button>
    </div>

    <ol
      v-if="session.events.length"
      class="timeline"
    >
      <li
        v-for="(e, i) in session.events"
        :key="i"
        class="timeline__item"
        :class="`timeline__item--${e.kind}`"
      >
        <span class="timeline__time">{{ time(e.t) }}</span>
        <span
          class="timeline__dot"
          aria-hidden="true"
        />
        <button
          v-if="e.kind === 'note' && e.detail"
          type="button"
          class="timeline__text timeline__link"
          @click="emit('note', Number(e.detail))"
        >
          {{ t('pages.journal.event.note', { text: e.text || '…' }) }}
        </button>
        <span
          v-else
          class="timeline__text"
        >
          {{ eventText(e) }}
        </span>
      </li>
    </ol>
    <p
      v-else
      class="detail__empty"
    >
      {{ t('pages.journal.noEvents') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import type { JourneySession, SessionEvent } from '@/stores/journey/lib/types';
import { formatDistance, formatDuration, sessionDate } from '../../lib/format';

const props = defineProps<{ session: JourneySession }>();
const emit = defineEmits<{
  back: [];
  rename: [title: string];
  map: [];
  export: [];
  delete: [];
  note: [id: number];
}>();
const { t, locale } = useI18n();

const title = ref(props.session.title);
watch(
  () => props.session.title,
  (v) => (title.value = v),
);

const armed = ref(false);
function onDelete(): void {
  if (!armed.value) {
    armed.value = true;
    setTimeout(() => (armed.value = false), 3000);
    return;
  }
  emit('delete');
}

function time(ms: number): string {
  return new Date(ms).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
}

function eventText(e: SessionEvent): string {
  switch (e.kind) {
    case 'level':
      return t('pages.journal.event.level', { level: e.text });
    case 'objective':
      return t('pages.journal.event.objective', { objective: e.text, quest: e.detail ?? '' });
    case 'quest':
      return t('pages.journal.event.quest', { quest: e.text });
    case 'location':
      return t('pages.journal.event.location', { place: e.text });
    default:
      return e.text;
  }
}
</script>

<style scoped lang="scss">
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.detail__head {
  display: flex;
  gap: var(--spacing-sm);
}

.detail__back {
  min-width: 40px;
  min-height: 38px;
  padding: 0;
  font-size: 1.3rem;
}

.detail__title {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-sm);
}

.detail__date {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 0.72rem;
  color: var(--skyrim-text-secondary);
}

.detail__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;

  > span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
}

.detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 34px;
    font-size: 0.7rem;
  }
}

.detail__delete--armed {
  border-color: #c0604f;
  color: #f0b0a4;
}

.timeline {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline__item {
  display: grid;
  grid-template-columns: 58px 14px 1fr;
  align-items: start;
  padding: 3px 0;
  font-size: var(--font-size-xs);
}

.timeline__time {
  font-size: 0.66rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.6;
  white-space: nowrap;
  color: var(--skyrim-text-dim);
}

.timeline__dot {
  width: 7px;
  height: 7px;
  margin-top: 5px;
  background: var(--skyrim-border-medium);
  border-radius: 50%;

  .timeline__item--objective & {
    background: #8fd18a;
  }

  .timeline__item--quest & {
    background: #f3c45e;
    transform: rotate(45deg);
    border-radius: 1px;
  }

  .timeline__item--level & {
    background: #9cc4ff;
  }

  .timeline__item--note & {
    background: #f2e6c4;
  }
}

.timeline__text {
  line-height: 1.3;
  color: var(--skyrim-text-primary);

  .timeline__item--location & {
    color: var(--skyrim-text-secondary);
  }
}

.timeline__link {
  padding: 0;
  background: none;
  border: none;
  font: inherit;
  text-align: left;
  text-decoration: underline dotted;
  cursor: pointer;
}

.detail__empty {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--skyrim-text-dim);
}
</style>
