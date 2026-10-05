<template>
  <aside
    class="gdrawer"
    role="dialog"
    :aria-label="t('shared.ui.guide.drawer')"
  >
    <nav
      class="gdrawer__tabs"
      role="tablist"
    >
      <button
        v-for="id in TABS"
        :key="id"
        type="button"
        role="tab"
        class="gdrawer__tab"
        :class="{ 'gdrawer__tab--active': tab === id }"
        :aria-selected="tab === id"
        @click="emit('update:tab', id)"
      >
        {{ t(`shared.ui.guide.tabs.${id}`) }}
      </button>
    </nav>

    <!-- Contents: the guide's own bookmarks. -->
    <ul
      v-if="tab === 'contents'"
      ref="contentsList"
      class="gdrawer__list"
    >
      <template
        v-for="row in contentRows"
        :key="row.index"
      >
        <li
          class="gdrawer__row gdrawer__row--outline"
          :class="{
            'gdrawer__row--current': row.index === currentSection,
            'gdrawer__row--chapter': row.depth === 0,
          }"
          :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
        >
          <button
            v-if="row.hasChildren"
            type="button"
            class="gdrawer__twisty"
            :aria-expanded="expanded.has(row.index)"
            :aria-label="row.title"
            @click="toggle(row.index)"
          >
            {{ expanded.has(row.index) ? '▾' : '▸' }}
          </button>
          <span
            v-else
            class="gdrawer__twisty"
          />
          <button
            type="button"
            class="gdrawer__go"
            :disabled="row.page < 0"
            @click="emit('jump', row.page, [])"
          >
            <span class="gdrawer__title">{{ row.title }}</span>
            <span class="gdrawer__page">{{ row.page + 1 }}</span>
          </button>
        </li>
      </template>
    </ul>

    <!-- Marks: the player's bookmarks and highlights. -->
    <div
      v-else-if="tab === 'marks'"
      class="gdrawer__list"
    >
      <p
        v-if="!marks.length"
        class="gdrawer__empty"
      >
        {{ t('shared.ui.guide.noMarks') }}
      </p>
      <ul v-else>
        <li
          v-for="m in marks"
          :key="m.id"
          class="gdrawer__row"
        >
          <span
            class="gdrawer__mark"
            :class="m.kind === 'bookmark' ? 'gdrawer__mark--ribbon' : `gdrawer__mark--${m.color}`"
          />
          <button
            type="button"
            class="gdrawer__go"
            @click="emit('jump', m.page, m.kind === 'highlight' ? [m.rect] : [])"
          >
            <span class="gdrawer__title">
              {{ m.kind === 'bookmark' ? m.label : m.note || guide.sectionTitle(m.page) }}
              <small v-if="m.kind === 'bookmark' && m.note">{{ m.note }}</small>
            </span>
            <span class="gdrawer__page">{{ m.page + 1 }}</span>
          </button>
          <button
            type="button"
            class="gdrawer__icon"
            :aria-label="t('common.delete')"
            @click="m.id !== undefined && guide.removeAnnotation(m.id)"
          >
            <guide-icon
              name="trash"
              :size="16"
            />
          </button>
        </li>
      </ul>
    </div>

    <!-- Search in the OCR text. -->
    <div
      v-else
      class="gdrawer__search"
    >
      <label class="gdrawer__field">
        <guide-icon
          name="search"
          :size="16"
        />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          enterkeyhint="search"
          :placeholder="t('shared.ui.guide.searchPlaceholder')"
        >
      </label>
      <p
        v-if="!guide.indexComplete()"
        class="gdrawer__progress"
      >
        <span
          class="gdrawer__bar"
          :style="{ width: `${(100 * guide.indexedPages) / Math.max(1, guide.pageCount)}%` }"
        />
        {{ t('shared.ui.guide.indexing', { done: guide.indexedPages, total: guide.pageCount }) }}
      </p>
      <p
        v-if="query.trim().length >= 3 && !results.length"
        class="gdrawer__empty"
      >
        {{ t('shared.ui.guide.noResults') }}
      </p>
      <p
        v-else-if="results.length"
        class="gdrawer__count"
      >
        {{ t('shared.ui.guide.resultCount', { n: results.length }) }}
      </p>
      <ul class="gdrawer__list">
        <li
          v-for="(r, i) in results"
          :key="i"
          class="gdrawer__row"
        >
          <button
            type="button"
            class="gdrawer__go gdrawer__go--hit"
            @click="emit('jump', r.page, r.rects.map(toFraction))"
          >
            <span class="gdrawer__snippet">…{{ r.before }}<mark>{{ r.match }}</mark>{{ r.after }}…</span>
            <span class="gdrawer__page">{{ r.page + 1 }}</span>
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useGuideStore } from '@/stores/guide/useGuideStore';
import { sectionAt } from '@/shared/lib/guide/outline';
import { BOX_UNIT, type SearchHit } from '@/shared/lib/guide/pageText';
import GuideIcon from '../guide-icon/GuideIcon.vue';

export type DrawerTab = 'contents' | 'marks' | 'search';
type Rect = [number, number, number, number];

const TABS: DrawerTab[] = ['contents', 'marks', 'search'];
const SEARCH_DELAY_MS = 250;

const props = defineProps<{
  tab: DrawerTab;
  currentPage: number;
  initialQuery: string;
}>();

const emit = defineEmits<{
  'update:tab': [tab: DrawerTab];
  jump: [page: number, rects: Rect[]];
}>();

const { t } = useI18n();
const guide = useGuideStore();
const { outline, annotations, indexedPages } = storeToRefs(guide);

// ─── Contents ───────────────────────────────────────────────────────────

const currentSection = computed(() => sectionAt(outline.value, props.currentPage));
const expanded = reactive(new Set<number>());

function expandToCurrent(): void {
  const i = currentSection.value;
  if (i < 0) return;
  for (let j = outline.value[i]?.parent ?? -1; j >= 0; j = outline.value[j]?.parent ?? -1) expanded.add(j);
}

function toggle(index: number): void {
  if (expanded.has(index)) expanded.delete(index);
  else expanded.add(index);
}

interface ContentRow {
  index: number;
  title: string;
  page: number;
  depth: number;
  hasChildren: boolean;
}

const contentRows = computed<ContentRow[]>(() => {
  const list = outline.value;
  const rows: ContentRow[] = [];
  list.forEach((entry, index) => {
    // Visible when every ancestor is expanded.
    for (let p = entry.parent; p >= 0; p = list[p]?.parent ?? -1) {
      if (!expanded.has(p)) return;
    }
    rows.push({
      index,
      title: entry.title,
      page: entry.page,
      depth: entry.depth,
      hasChildren: list[index + 1]?.parent === index,
    });
  });
  return rows;
});

const contentsList = ref<HTMLElement | null>(null);

function scrollToCurrent(): void {
  void nextTick(() => {
    const el = contentsList.value?.querySelector('.gdrawer__row--current');
    el?.scrollIntoView({ block: 'center' });
  });
}

// ─── Marks ──────────────────────────────────────────────────────────────

const marks = computed(() => [...annotations.value].sort((a, b) => a.page - b.page || a.createdAt - b.createdAt));

// ─── Search ─────────────────────────────────────────────────────────────

const query = ref(props.initialQuery);
const results = ref<SearchHit[]>([]);
const searchInput = ref<HTMLInputElement | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function runSearch(): void {
  results.value = guide.search(query.value);
}

watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, SEARCH_DELAY_MS);
});

// New pages indexed: refresh the results.
watch(indexedPages, () => {
  if (props.tab === 'search' && query.value.trim().length >= 3) runSearch();
});

const toFraction = (r: [number, number, number, number]): Rect => [r[0] / BOX_UNIT, r[1] / BOX_UNIT, r[2] / BOX_UNIT, r[3] / BOX_UNIT];

watch(
  () => props.tab,
  (tab) => {
    guide.requestIndex(tab === 'search');
    if (tab === 'search') {
      runSearch();
      void nextTick(() => searchInput.value?.focus());
    }
    if (tab === 'contents') {
      expandToCurrent();
      scrollToCurrent();
    }
  },
  { immediate: true },
);

onMounted(() => {
  expandToCurrent();
  scrollToCurrent();
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  guide.requestIndex(false);
});
</script>

<style scoped lang="scss">
.gdrawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(88%, 360px);
  display: flex;
  flex-direction: column;
  background: var(--skyrim-bg-medium);
  border-left: 1px solid var(--skyrim-border-medium);
  box-shadow: -8px 0 24px rgb(0 0 0 / 60%);
  z-index: 3;
}

.gdrawer__tabs {
  display: flex;
  border-bottom: 1px solid var(--skyrim-border-dark);
}

.gdrawer__tab {
  flex: 1;
  padding: 10px 4px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--skyrim-text-secondary);
  font-family: var(--font-heading, serif);
  font-size: var(--font-size-sm);
  letter-spacing: 0.06em;
  text-transform: uppercase;

  &--active {
    color: var(--skyrim-text-accent);
    border-bottom-color: var(--skyrim-accent-main);
  }
}

.gdrawer__list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  list-style: none;

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
}

.gdrawer__row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px 0 10px;
  min-height: 38px;
  border-bottom: 1px solid rgb(255 255 255 / 4%);

  &--chapter .gdrawer__title {
    color: var(--skyrim-text-accent);
    font-family: var(--font-heading, serif);
  }

  &--current {
    background: linear-gradient(90deg, rgb(201 162 39 / 18%), transparent);

    .gdrawer__title {
      color: var(--skyrim-accent-main-light, #e5c44d);
    }
  }
}

.gdrawer__twisty {
  width: 18px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: none;
  color: var(--skyrim-text-secondary);
  font-size: 12px;
}

.gdrawer__go {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border: 0;
  background: none;
  color: var(--skyrim-text-primary);
  text-align: left;
  font-size: var(--font-size-sm);

  &--hit {
    align-items: flex-start;
  }
}

.gdrawer__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  small {
    display: block;
    color: var(--skyrim-text-secondary);
    white-space: normal;
  }
}

.gdrawer__page {
  flex-shrink: 0;
  color: var(--skyrim-text-dim);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}

.gdrawer__mark {
  width: 10px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 2px;

  &--ribbon {
    background: #9b1c1c;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%);
  }

  &--amber { background: rgb(255 196 0 / 80%); }
  &--green { background: rgb(80 200 90 / 80%); }
  &--blue { background: rgb(70 150 255 / 80%); }
  &--rose { background: rgb(255 90 120 / 80%); }
}

.gdrawer__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  background: none;
  color: var(--skyrim-text-secondary);
}

.gdrawer__empty,
.gdrawer__count {
  margin: 12px;
  color: var(--skyrim-text-secondary);
  font-size: var(--font-size-sm);
}

.gdrawer__count {
  margin: 4px 12px;
  font-size: 12px;
}

.gdrawer__search {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.gdrawer__field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px;
  padding: 0 10px;
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 4px;
  background: var(--skyrim-bg-dark);
  color: var(--skyrim-text-secondary);

  input {
    flex: 1;
    min-width: 0;
    padding: 9px 0;
    border: 0;
    outline: none;
    background: none;
    color: var(--skyrim-text-accent);
    font-size: 16px;
  }
}

.gdrawer__progress {
  position: relative;
  margin: 0 10px 6px;
  padding: 4px 8px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--skyrim-bg-dark);
  color: var(--skyrim-text-secondary);
  font-size: 12px;
}

.gdrawer__bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgb(201 162 39 / 22%);
  transition: width 0.4s;
}

.gdrawer__snippet {
  flex: 1;
  min-width: 0;
  color: var(--skyrim-text-secondary);
  font-size: 12px;
  line-height: 1.4;

  mark {
    padding: 0 1px;
    border-radius: 2px;
    background: rgb(201 162 39 / 35%);
    color: var(--skyrim-text-accent);
  }
}
</style>
