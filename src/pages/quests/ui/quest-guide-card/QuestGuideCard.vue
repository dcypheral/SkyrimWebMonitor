<template>
  <section
    class="qguide"
    :aria-label="t('pages.quests.questsList.guide.title')"
  >
    <!-- No guide on this device yet. -->
    <template v-if="status !== 'ready'">
      <div class="qguide__head">
        <guide-icon
          name="book"
          :size="18"
        />
        <span>{{ t('pages.quests.questsList.guide.title') }}</span>
      </div>
      <guide-file-card compact />
    </template>

    <!-- Guide page found. -->
    <template v-else-if="match">
      <button
        type="button"
        class="qguide__thumb"
        :aria-label="t('pages.quests.questsList.guide.open')"
        @click="open(match.page)"
      >
        <guide-page-thumb :page="match.page" />
        <span class="qguide__pageno">{{ match.page + 1 }}</span>
      </button>
      <div class="qguide__body">
        <span
          class="qguide__source"
          :class="`qguide__source--${match.source}`"
        >{{ t(`pages.quests.questsList.guide.source.${match.source}`) }}</span>
        <span class="qguide__title">{{ match.title }}</span>
        <span
          v-if="path"
          class="qguide__path"
        >{{ path }}</span>
        <button
          type="button"
          class="qguide__open"
          @click="open(match.page)"
        >
          <guide-icon
            name="book"
            :size="16"
          />
          {{ t('pages.quests.questsList.guide.open') }}
        </button>
        <div
          v-if="match.alternatives.length"
          class="qguide__alts"
        >
          <span>{{ t('pages.quests.questsList.guide.also') }}</span>
          <button
            v-for="alt in match.alternatives"
            :key="alt.page"
            type="button"
            class="qguide__alt"
            @click="open(alt.page)"
          >
            {{ alt.title }} · {{ alt.page + 1 }}
          </button>
        </div>
        <button
          v-if="match.source === 'link'"
          type="button"
          class="qguide__quiet"
          @click="guide.unlinkQuest(quest)"
        >
          {{ t('pages.quests.questsList.guide.resetLink') }}
        </button>
        <span
          v-else-if="match.source !== 'bookmark'"
          class="qguide__hint"
        >{{ t('pages.quests.questsList.guide.linkHint') }}</span>
      </div>
    </template>

    <!-- Guide loaded, quest not found (yet). -->
    <template v-else>
      <div class="qguide__head">
        <guide-icon
          name="book"
          :size="18"
        />
        <span>{{ t('pages.quests.questsList.guide.notFound') }}</span>
      </div>
      <p
        v-if="!indexDone"
        class="qguide__hint"
      >
        {{ t('pages.quests.questsList.guide.stillIndexing', { done: indexedPages, total: pageCount }) }}
      </p>
      <div class="qguide__actions">
        <button
          type="button"
          class="qguide__open"
          @click="searchGuide"
        >
          <guide-icon
            name="search"
            :size="16"
          />
          {{ t('pages.quests.questsList.guide.search') }}
        </button>
        <button
          type="button"
          class="qguide__quiet"
          @click="open(guide.lastPage)"
        >
          {{ t('pages.quests.questsList.guide.browse') }}
        </button>
      </div>
      <span class="qguide__hint">{{ t('pages.quests.questsList.guide.linkHint') }}</span>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { GuideFileCard, GuideIcon, GuidePageThumb } from '@/features/guide';
import { useGuideStore } from '@/stores/guide/useGuideStore';
import type { QuestJournalEntry } from '@/stores/quests/lib/types';

const props = defineProps<{ quest: QuestJournalEntry }>();

const { t } = useI18n();
const guide = useGuideStore();
const { status, indexedPages, pageCount } = storeToRefs(guide);

const match = computed(() => (status.value === 'ready' ? guide.matchFor(props.quest, true) : null));
const indexDone = computed(() => guide.indexComplete());

const path = computed(() => {
  const m = match.value;
  if (!m) return '';
  const parts = guide.sectionPath(m.page);
  // The last part is usually the title shown above it.
  if (parts[parts.length - 1] === m.title) parts.pop();
  return parts.join(' › ');
});

function open(page: number): void {
  guide.openReader({ page, quest: props.quest, flash: props.quest.isMisc ? '' : props.quest.name });
}

function searchGuide(): void {
  guide.openReader({ page: guide.lastPage, quest: props.quest, search: props.quest.name });
}
</script>

<style scoped lang="scss">
.qguide {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: var(--spacing-md, 12px);
  padding: 12px;
  border: 1px solid rgb(201 162 39 / 28%);
  border-radius: 6px;
  background:
    linear-gradient(160deg, rgb(201 162 39 / 9%), transparent 55%),
    var(--skyrim-bg-dark);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 40%);
}

.qguide__head {
  flex-basis: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--skyrim-text-accent);
  font-family: var(--font-heading, serif);
  font-size: var(--font-size-sm);
  letter-spacing: 0.04em;

  :deep(svg) {
    color: var(--skyrim-accent-main);
  }
}

.qguide__thumb {
  position: relative;
  width: 82px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: none;
  transform: rotate(-1.5deg);
}

.qguide__pageno {
  position: absolute;
  right: -6px;
  bottom: 8px;
  padding: 1px 6px;
  border-radius: 2px;
  background: #d8c9a3;
  color: #2b2418;
  font-size: 11px;
  font-weight: 600;
  box-shadow: 0 1px 3px rgb(0 0 0 / 50%);
}

.qguide__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.qguide__source {
  padding: 1px 7px;
  border-radius: 9px;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: rgb(255 255 255 / 7%);
  color: var(--skyrim-text-secondary);

  &--bookmark {
    color: #d9c27a;
    background: rgb(201 162 39 / 14%);
  }

  &--link {
    color: #9fd3a6;
    background: rgb(80 200 90 / 13%);
  }

  &--text {
    color: #e8b48a;
    background: rgb(230 140 80 / 13%);
  }
}

.qguide__title {
  color: var(--skyrim-text-accent);
  font-family: var(--font-heading, serif);
  font-size: 15px;
  line-height: 1.2;
}

.qguide__path {
  color: var(--skyrim-text-dim);
  font-size: 11px;
}

.qguide__open {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 7px 12px;
  border: 1px solid var(--skyrim-accent-main-dim);
  border-radius: 4px;
  background: rgb(201 162 39 / 14%);
  color: var(--skyrim-accent-main-light, #e5c44d);
  font-size: var(--font-size-sm);
}

.qguide__alts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-top: 2px;
  color: var(--skyrim-text-dim);
  font-size: 11px;
}

.qguide__alt {
  padding: 2px 8px;
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 10px;
  background: none;
  color: var(--skyrim-text-secondary);
  font-size: 11px;
}

.qguide__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qguide__quiet {
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--skyrim-text-secondary);
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.qguide__hint {
  margin: 0;
  color: var(--skyrim-text-dim);
  font-size: 11px;
  line-height: 1.4;
}
</style>
