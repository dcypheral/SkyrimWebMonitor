<template>
  <ul
    v-if="sessions.length"
    class="sessions"
  >
    <li
      v-for="s in sessions"
      :key="s.id"
    >
      <button
        type="button"
        class="session"
        :class="{ 'session--live': s.id === activeId }"
        @click="emit('open', s.id)"
      >
        <span class="session__date">
          {{ sessionDate(s, locale) }}
          <span
            v-if="s.id === activeId"
            class="session__live"
          >{{ t('pages.journal.recording') }}</span>
        </span>
        <span
          v-if="s.title"
          class="session__title"
        >{{ s.title }}</span>
        <span class="session__stats">
          <span>
            <base-icon
              icon-path="lorc/hourglass.svg"
              :size="12"
            />
            {{ formatDuration(s.activeMs) }}
          </span>
          <span>
            <base-icon
              icon-path="delapouite/trail.svg"
              :size="12"
            />
            {{ formatDistance(s.distance) }}
          </span>
          <span v-if="countEvents(s, 'objective')">
            ✓ {{ countEvents(s, 'objective') }}
          </span>
          <span v-if="countEvents(s, 'note')">
            <base-icon
              icon-path="lorc/quill-ink.svg"
              :size="12"
            />
            {{ countEvents(s, 'note') }}
          </span>
        </span>
      </button>
    </li>
  </ul>
  <p
    v-else
    class="empty"
  >
    {{ t('pages.journal.noSessions') }}
  </p>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import type { JourneySession } from '@/stores/journey/lib/types';
import { countEvents, formatDistance, formatDuration, sessionDate } from '../../lib/format';

defineProps<{ sessions: JourneySession[]; activeId: number | null }>();
const emit = defineEmits<{ open: [id: number] }>();
const { t, locale } = useI18n();
</script>

<style scoped lang="scss">
.sessions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.session {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 8px 10px;
  background: rgb(255 255 255 / 3%);
  border: 1px solid var(--skyrim-border-dark);
  border-left: 3px solid var(--skyrim-border-medium);
  border-radius: var(--radius-md);
  color: var(--skyrim-text-primary);
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;

  &:active {
    background: rgb(255 255 255 / 6%);
  }

  &--live {
    border-left-color: #f3c45e;
  }
}

.session__date {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-heading);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--skyrim-text-secondary);
}

.session__live {
  padding: 0 6px;
  border: 1px solid #f3c45e;
  border-radius: 999px;
  font-size: 0.6rem;
  color: #f3c45e;
  text-transform: uppercase;
}

.session__title {
  font-size: var(--font-size-sm);
}

.session__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--skyrim-text-secondary);

  > span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
}

.empty {
  margin: var(--spacing-lg) 0;
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-dim);
  text-align: center;
}
</style>
