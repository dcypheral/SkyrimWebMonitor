<template>
  <div class="lab">
    <header class="lab__header">
      <button
        type="button"
        class="btn lab__back"
        :aria-label="t('shared.ui.alchemy.back')"
        @click="emit('close')"
      >
        ‹
      </button>
      <button
        type="button"
        class="btn lab__suggest"
        :disabled="ingredients.length < 2 || nothingToLearn"
        @click="applyExperiment"
      >
        <base-icon
          icon-path="lorc/cauldron.svg"
          :size="16"
        />
        {{ nothingToLearn ? t('shared.ui.alchemy.nothingToLearn') : t('shared.ui.alchemy.suggest') }}
      </button>
      <label class="lab__spoilers">
        <span>{{ t('shared.ui.alchemy.reveal') }}</span>
        <base-switch
          :model-value="spoilers"
          :aria-label="t('shared.ui.alchemy.reveal')"
          @update:model-value="setSpoilers"
        />
      </label>
    </header>

    <!-- Mortar: three slots, then the result -->
    <section class="lab__mortar">
      <button
        v-if="selected.length"
        type="button"
        class="lab__clear"
        :aria-label="t('shared.ui.alchemy.clear')"
        @click="clear"
      >
        ×
      </button>
      <div class="lab__slots">
        <template
          v-for="i in MAX_INGREDIENTS"
          :key="i"
        >
          <span
            v-if="i > 1"
            class="lab__plus"
            aria-hidden="true"
          >+</span>
          <button
            type="button"
            class="lab__slot"
            :class="{ 'lab__slot--filled': !!selected[i - 1] }"
            :aria-label="selected[i - 1]?.name ?? t('shared.ui.alchemy.emptySlot')"
            :disabled="!selected[i - 1]"
            @click="removeAt(i - 1)"
          >
            <item-thumbnail
              v-if="selected[i - 1]"
              fallback-icon-path="skoll/pestle-mortar.svg"
              :model-path="selected[i - 1]?.modelPath"
              :keywords="selected[i - 1]?.keywords"
              framing="upright"
              :size="40"
            />
            <span
              v-else
              class="lab__slot-empty"
            >{{ i }}</span>
          </button>
        </template>
      </div>

      <div
        class="lab__result"
        :class="`lab__result--${shownKind}`"
        aria-live="polite"
      >
        <div
          v-if="selected.length >= 2"
          class="lab__result-head"
        >
          <base-icon
            :icon-path="shownKind === 'poison' ? 'lorc/bubbling-flask.svg' : 'lorc/potion-ball.svg'"
            :size="18"
            :background-color="kindColor"
          />
          <span class="lab__result-title">{{ resultTitle }}</span>
        </div>
        <ul
          v-if="result.effects.length"
          class="lab__effects"
        >
          <li
            v-for="effect in result.effects"
            :key="effect.name"
            class="lab__effect"
            :class="{
              'lab__effect--harmful': effect.harmful && (effect.visible || spoilers),
              'lab__effect--hidden': !effect.visible && !spoilers,
            }"
          >
            <template v-if="effect.visible || spoilers">
              {{ effect.name }}
            </template>
            <template v-else>
              {{ t('shared.ui.alchemy.unknownEffect') }}
            </template>
            <span
              v-if="!effect.visible"
              class="lab__new"
            >{{ t('shared.ui.alchemy.new') }}</span>
          </li>
        </ul>
        <p
          v-else
          class="lab__hint"
        >
          {{ selected.length < 2 ? t('shared.ui.alchemy.pickHint') : t('shared.ui.alchemy.noReaction') }}
        </p>
        <p
          v-if="result.lessons.length"
          class="lab__lessons"
        >
          ✦ {{ t('shared.ui.alchemy.teaches', { count: result.lessons.length }, result.lessons.length) }}
        </p>
      </div>
    </section>

    <!-- Satchel: every ingredient, with known-effect pips -->
    <div class="lab__grid">
      <button
        v-for="item in sortedIngredients"
        :key="item.formId"
        type="button"
        class="lab__ing"
        :class="{
          'lab__ing--selected': isSelected(item.formId),
          'lab__ing--match': matches.has(item.formId),
          'lab__ing--dim': selected.length > 0 && !isSelected(item.formId) && !matches.has(item.formId),
        }"
        :aria-pressed="isSelected(item.formId)"
        @click="toggle(item)"
      >
        <item-thumbnail
          fallback-icon-path="skoll/pestle-mortar.svg"
          :model-path="item.modelPath"
          :keywords="item.keywords"
          framing="upright"
          :size="38"
        />
        <span class="lab__ing-name">{{ item.name }}</span>
        <span
          class="lab__pips"
          :aria-label="t('shared.ui.alchemy.knownOf', { known: knownEffectCount(item), total: item.effects.length })"
        >
          <span
            v-for="(effect, i) in item.effects"
            :key="i"
            class="lab__pip"
            :class="{ 'lab__pip--known': effect.known, 'lab__pip--lesson': lessonSet.has(`${item.formId}|${effect.name}`) }"
          />
        </span>
      </button>
      <p
        v-if="!sortedIngredients.length"
        class="lab__hint"
      >
        {{ t('shared.ui.alchemy.noIngredients') }}
      </p>
    </div>

    <footer class="lab__progress">
      <span>{{ t('shared.ui.alchemy.progress', { known: totals.known, total: totals.total }) }}</span>
      <span class="lab__progress-bar"><span :style="{ width: `${totals.percent}%` }" /></span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { BaseIcon, BaseSwitch } from '@/shared/ui';
import { ItemThumbnail } from '@/entities/ui/icons';
import {
  MAX_INGREDIENTS,
  bestExperiment,
  brew,
  isCompatible,
  knownEffectCount,
} from '@/shared/lib/utils/alchemy';
import { useInventoryStore } from '@/stores/inventory/useInventoryStore';
import type { IngredientItem } from '@/stores/inventory/lib/types';

const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();

const SPOILER_KEY = 'skyrim-monitor-alchemy-spoilers';

const { ingredientsList } = storeToRefs(useInventoryStore());
const ingredients = computed<IngredientItem[]>(() =>
  ingredientsList.value.filter((i): i is IngredientItem => 'effects' in i && Array.isArray(i.effects)),
);

const selectedIds = ref<string[]>([]);
const spoilers = ref(readSpoilers());

const selected = computed(() =>
  selectedIds.value
    .map((id) => ingredients.value.find((i) => i.formId === id))
    .filter((i): i is IngredientItem => !!i),
);

// Drop selections the player no longer has (used up in game).
watch(ingredients, (list) => {
  selectedIds.value = selectedIds.value.filter((id) => list.some((i) => i.formId === id));
});

const result = computed(() => brew(selected.value));
const lessonSet = computed(() => new Set(result.value.lessons.map((l) => `${l.formId}|${l.effect}`)));

const matches = computed(() => {
  const set = new Set<string>();
  for (const item of ingredients.value) {
    if (isCompatible(selected.value, item, spoilers.value)) set.add(item.formId);
  }
  return set;
});

/** Least-known first: the satchel doubles as a to-learn list. */
const sortedIngredients = computed(() =>
  ingredients.value
    .slice()
    .sort(
      (a, b) =>
        knownEffectCount(a) / (a.effects.length || 1) - knownEffectCount(b) / (b.effects.length || 1) ||
        a.name.localeCompare(b.name),
    ),
);

// Searching every pair/trio is O(n³); run it only on demand, not per update.
const nothingToLearn = ref(false);
watch(
  () => ingredients.value.length,
  () => {
    nothingToLearn.value = false;
  },
);

const totals = computed(() => {
  let known = 0;
  let total = 0;
  for (const i of ingredients.value) {
    known += knownEffectCount(i);
    total += i.effects.length;
  }
  return { known, total, percent: total ? Math.round((known / total) * 100) : 0 };
});

/**
 * Potion / poison / impure, judged only on effects the player may see, so
 * the label never leaks an unknown effect while spoilers are off.
 */
const shownKind = computed(() => {
  const r = result.value;
  if (r.kind === 'none' || spoilers.value) return r.kind;
  const shown = r.effects.filter((e) => e.visible);
  if (shown.length === 0) return 'unknown';
  const harmful = shown.filter((e) => e.harmful).length;
  if (harmful === 0) return 'potion';
  return harmful === shown.length ? 'poison' : 'mixed';
});

const kindColor = computed(() => {
  switch (shownKind.value) {
    case 'potion':
      return '#8fd18a';
    case 'poison':
      return '#d9604f';
    case 'mixed':
      return '#d8b45a';
    default:
      return 'var(--skyrim-text-dim)';
  }
});

const resultTitle = computed(() => {
  const r = result.value;
  if (r.kind === 'none') return t('shared.ui.alchemy.kind.none');
  const lead = r.effects.find((e) => e.visible || spoilers.value);
  const kind = t(`shared.ui.alchemy.kind.${shownKind.value}`);
  return lead ? t('shared.ui.alchemy.of', { kind, effect: lead.name }) : kind;
});

function isSelected(formId: string): boolean {
  return selectedIds.value.includes(formId);
}

function toggle(item: IngredientItem): void {
  if (isSelected(item.formId)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== item.formId);
  } else if (selectedIds.value.length < MAX_INGREDIENTS) {
    selectedIds.value = [...selectedIds.value, item.formId];
  } else {
    // Full mortar: replace the last pick so experimenting stays one tap.
    selectedIds.value = [...selectedIds.value.slice(0, MAX_INGREDIENTS - 1), item.formId];
  }
}

function removeAt(index: number): void {
  selectedIds.value = selectedIds.value.filter((_, i) => i !== index);
}

function clear(): void {
  selectedIds.value = [];
}

function applyExperiment(): void {
  const found = bestExperiment(ingredients.value);
  if (found) selectedIds.value = [...found.ingredients];
  else nothingToLearn.value = true;
}

function setSpoilers(value: boolean): void {
  spoilers.value = value;
  try {
    localStorage.setItem(SPOILER_KEY, value ? '1' : '0');
  } catch {
    /* localStorage can be unavailable in restricted WebViews */
  }
}

function readSpoilers(): boolean {
  try {
    return localStorage.getItem(SPOILER_KEY) === '1';
  } catch {
    return false;
  }
}
</script>

<style scoped lang="scss">
.lab {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  height: 100%;
  min-height: 0;
}

.lab__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.lab__back {
  min-width: 40px;
  min-height: 38px;
  padding: 0;
  font-size: 1.3rem;
  line-height: 1;
}

.lab__spoilers {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  color: var(--skyrim-text-secondary);
}

.lab__mortar {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px var(--spacing-sm) var(--spacing-sm);
  background: radial-gradient(ellipse at 50% 0%, rgb(90 78 52 / 25%), transparent 70%), rgb(0 0 0 / 30%);
  border: var(--border-thin) solid var(--skyrim-border-dark);
  border-radius: var(--radius-lg);
}

.lab__slots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.lab__plus {
  font-family: var(--font-heading);
  color: var(--skyrim-text-dim);
}

.lab__slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  padding: 0;
  background: radial-gradient(circle at 50% 40%, rgb(60 54 42 / 90%), rgb(12 11 9 / 90%) 72%);
  border: 1px dashed var(--skyrim-border-medium);
  border-radius: 50%;
  cursor: pointer;

  &--filled {
    border-style: solid;
    border-color: var(--skyrim-border-accent);
    box-shadow: 0 0 10px var(--skyrim-border-glow);
  }

  &:disabled {
    cursor: default;
  }
}

.lab__slot-empty {
  font-family: var(--font-heading);
  color: var(--skyrim-text-dim);
}

.lab__result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 44px;
}

.lab__clear {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: 1px solid var(--skyrim-border-dark);
  border-radius: 50%;
  color: var(--skyrim-text-secondary);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.lab__result-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lab__result-title {
  font-family: var(--font-heading);
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-primary);
}

.lab__effects {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lab__effect {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgb(143 209 138 / 12%);
  border: 1px solid rgb(143 209 138 / 35%);
  border-radius: 999px;
  font-size: 0.72rem;
  color: #cfe8c9;

  &--harmful {
    background: rgb(217 96 79 / 12%);
    border-color: rgb(217 96 79 / 40%);
    color: #f0c0b6;
  }

  &--hidden {
    background: rgb(255 255 255 / 5%);
    border-style: dashed;
    border-color: var(--skyrim-border-medium);
    color: var(--skyrim-text-secondary);
  }
}

.lab__new {
  font-family: var(--font-heading);
  font-size: 0.56rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--skyrim-accent-main);
}

.lab__lessons {
  margin: 0;
  font-size: 0.72rem;
  color: var(--skyrim-accent-main);
}

.lab__hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--skyrim-text-dim);
}

.lab__suggest {
  display: inline-flex;
  flex: 1;
  min-width: 0;
  min-height: 38px;
  overflow: hidden;
  font-size: var(--font-size-xs);
  white-space: nowrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.lab__grid {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  align-content: start;
  gap: 4px;
  min-height: 0;
  overflow-y: auto;
}

.lab__ing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 2px 5px;
  background: rgb(255 255 255 / 3%);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--skyrim-text-secondary);
  font-family: var(--font-body);
  cursor: pointer;
  touch-action: manipulation;
  transition:
    opacity var(--transition-fast),
    border-color var(--transition-fast);

  &--selected {
    border-color: var(--skyrim-border-accent);
    background: rgb(232 212 154 / 10%);
    color: var(--skyrim-text-primary);
  }

  &--match {
    border-color: rgb(143 209 138 / 55%);
    box-shadow: inset 0 0 10px rgb(143 209 138 / 18%);
  }

  &--dim {
    opacity: 0.4;
  }
}

.lab__ing-name {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  font-size: 0.64rem;
  line-height: 1.15;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.lab__pips {
  display: flex;
  gap: 3px;
}

.lab__pip {
  width: 6px;
  height: 6px;
  border: 1px solid var(--skyrim-text-dim);
  border-radius: 50%;

  &--known {
    background: var(--skyrim-text-accent);
    border-color: var(--skyrim-text-accent);
  }

  &--lesson {
    border-color: var(--skyrim-accent-main);
    box-shadow: 0 0 4px var(--skyrim-accent-main);
  }
}

.lab__progress {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.66rem;
  color: var(--skyrim-text-dim);
  white-space: nowrap;
}

.lab__progress-bar {
  flex: 1;
  height: 3px;
  overflow: hidden;
  background: rgb(255 255 255 / 10%);
  border-radius: 2px;

  > span {
    display: block;
    height: 100%;
    background: var(--skyrim-text-accent);
  }
}
</style>
