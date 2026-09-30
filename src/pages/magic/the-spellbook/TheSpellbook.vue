<template>
  <div class="book">
    <!-- School ring: one tap filters, counts show what each school holds. -->
    <div
      class="book__schools"
      role="tablist"
    >
      <button
        v-for="s in schoolChips"
        :key="s.id"
        type="button"
        role="tab"
        class="book__school"
        :class="{ 'book__school--active': school === s.id }"
        :style="{ '--chip-color': s.color }"
        :aria-selected="school === s.id"
        :aria-label="s.label"
        @click="school = s.id"
      >
        <base-icon
          :icon-path="s.icon"
          :size="18"
          :background-color="school === s.id ? s.color : 'var(--skyrim-text-dim)'"
        />
        <span class="book__school-count">{{ s.count }}</span>
      </button>
    </div>

    <div class="book__filters">
      <input
        v-model="query"
        class="input book__search"
        type="search"
        :placeholder="t('pages.spellbook.search')"
      >
      <button
        type="button"
        class="btn book__toggle"
        :class="{ 'is-on': onlyFavorites }"
        :aria-pressed="onlyFavorites"
        :aria-label="t('pages.spellbook.favorites')"
        @click="onlyFavorites = !onlyFavorites"
      >
        ★
      </button>
    </div>

    <!-- The ladder: Novice → Master. -->
    <div
      class="book__ladder"
      @scroll.passive="onScroll"
    >
      <section
        v-for="tier in tiers"
        :key="tier.level"
        class="book__tier"
      >
        <h3 class="book__tier-title">
          <span class="book__tier-rank">{{ tier.rank }}</span>
          {{ tier.label }}
          <span class="book__tier-count">{{ tier.spells.length }}</span>
        </h3>
        <div class="book__runes">
          <spell-rune
            v-for="spell in tier.spells"
            :key="spell.formId"
            :name="spell.name"
            :icon="getSpellIconPath(spell)"
            :color="getSchoolColor(spell.categoryType)"
            :hand="handOf(spell)"
            :is-favorite="spell.isFavorite"
            :hotkey="hotkeys.getSlotForFormId(spell.formId)"
            :active="activeSpell === spell.formId"
            @select="select(spell.formId)"
          />
        </div>
      </section>
      <p
        v-if="!tiers.length"
        class="book__empty"
      >
        {{ allSpells.length ? t('pages.spellbook.noMatches') : t('pages.spellbook.empty') }}
      </p>
    </div>

    <magic-sheet
      v-if="activeSpellData"
      v-model:open="sheetOpen"
      :title="activeSpellData.name"
      :subtitle="`${schoolLabel(activeSpellData.categoryType)} · ${levelLabel(activeSpellData.level)}`"
      :icon="getSpellIconPath(activeSpellData)"
      :color="getSchoolColor(activeSpellData.categoryType)"
      :stats="sheetStats"
      :effects="sheetEffects"
    >
      <template v-if="isMasterLevelSpell(activeSpellData)">
        <button
          type="button"
          class="btn"
          :class="{ 'is-on': activeSpellData.isEquipped }"
          @click="toggleHand('right')"
        >
          {{ activeSpellData.isEquipped ? t('pages.spellbook.unequip') : t('pages.spellbook.bothHands') }}
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          class="btn"
          :class="{ 'is-on': inHand(activeSpellData, 'left') }"
          @click="toggleHand('left')"
        >
          {{ t('pages.spellbook.left') }}
        </button>
        <button
          type="button"
          class="btn"
          :class="{ 'is-on': inHand(activeSpellData, 'right') }"
          @click="toggleHand('right')"
        >
          {{ t('pages.spellbook.right') }}
        </button>
      </template>
      <button
        type="button"
        class="btn"
        :class="{ 'is-on': activeSpellData.isFavorite }"
        :aria-label="t('shared.ui.itemMenu.favorite')"
        @click="toggleFavorite"
      >
        ★
      </button>
      <button
        type="button"
        class="btn"
        @click="openHotkeyPicker"
      >
        {{ t('shared.ui.itemMenu.hotkey') }}
      </button>
    </magic-sheet>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { BaseIcon } from '@/shared/ui';
import { MAGIC_SCHOOL_ICON_PATHS } from '@/shared/lib/constants/magicSchoolIcons';
import { getEffectText } from '@/shared/lib/utils/getEffectHtml';
import { getSchoolColor, getSpellIconPath } from '@/shared/lib/utils/spellIcons';
import { useHotkeysStore } from '@/stores/hotkeys/useHotkeysStore';
import { useMagicStore } from '@/stores/magic/useCharacterSpellStore';
import { getEffectiveEquippedHand, isMasterLevelSpell } from '@/stores/magic/helpers';
import type { SpellItem } from '@/stores/magic/lib/types';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import { useMagicSpellActions } from '../composables/useMagicSpellActions';
import SpellRune from '../ui/spell-rune/SpellRune.vue';
import MagicSheet from '../ui/magic-sheet/MagicSheet.vue';

const SCHOOLS = ['Destruction', 'Restoration', 'Alteration', 'Conjuration', 'Illusion', 'Enchanting'] as const;
const LEVELS = [0, 25, 50, 75, 100] as const;
const RANKS = ['I', 'II', 'III', 'IV', 'V'];
const LEVEL_KEYS = ['novice', 'apprentice', 'adept', 'expert', 'master'];

const { t } = useI18n();
const ws = useWebSocketStore();
const hotkeys = useHotkeysStore();
const { allSpells } = storeToRefs(useMagicStore());

const { activeSpell, activeSpellData, toggleFavorite, openHotkeyPicker } = useMagicSpellActions(() => allSpells.value);

const school = ref<string>('all');
const query = ref('');
const onlyFavorites = ref(false);
const sheetOpen = ref(false);

const schoolChips = computed(() => {
  const chips = [
    { id: 'all', label: t('pages.spellbook.all'), icon: 'lorc/book-aura.svg', color: '#d8cfbd', count: allSpells.value.length },
  ];
  for (const s of SCHOOLS) {
    const count = allSpells.value.filter((sp) => sp.categoryType === s).length;
    if (count === 0) continue;
    chips.push({
      id: s,
      label: schoolLabel(s),
      icon: MAGIC_SCHOOL_ICON_PATHS[s] ?? 'lorc/crystal-wand.svg',
      color: getSchoolColor(s),
      count,
    });
  }
  return chips;
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return allSpells.value.filter((sp) => {
    if (school.value !== 'all' && sp.categoryType !== school.value) return false;
    if (onlyFavorites.value && !sp.isFavorite) return false;
    if (!q) return true;
    return sp.name.toLowerCase().includes(q) || sp.effects.some((e) => e.name.toLowerCase().includes(q));
  });
});

/** Tier for a skill requirement (modded spells may use other numbers). */
function tierIndex(level: number): number {
  let index = 0;
  LEVELS.forEach((l, i) => {
    if (level >= l) index = i;
  });
  return index;
}

const tiers = computed(() =>
  LEVELS.map((level, i) => ({
    level,
    rank: RANKS[i],
    label: t(`entities.spell.levels.${LEVEL_KEYS[i]}`),
    spells: filtered.value
      .filter((sp) => tierIndex(sp.level) === i)
      .sort((a, b) => schoolOrder(a.categoryType) - schoolOrder(b.categoryType) || a.name.localeCompare(b.name)),
  })).filter((tier) => tier.spells.length > 0),
);

function schoolOrder(s: string): number {
  return SCHOOLS.findIndex((x) => x === s);
}

function schoolLabel(s: string): string {
  const key = s.toLowerCase();
  return t(`pages.magic.${key}.tab`);
}

function levelLabel(level: number): string {
  return t(`entities.spell.levels.${LEVEL_KEYS[tierIndex(level)]}`);
}

function handOf(spell: SpellItem): 'left' | 'right' | 'both' | null {
  if (!spell.isEquipped) return null;
  const hand = getEffectiveEquippedHand(spell);
  return hand === 'left' || hand === 'right' || hand === 'both' ? hand : null;
}

function inHand(spell: SpellItem, hand: 'left' | 'right'): boolean {
  const h = handOf(spell);
  return h === hand || h === 'both';
}

function select(formId: string): void {
  activeSpell.value = formId;
  sheetOpen.value = true;
}

function onScroll(): void {
  if (sheetOpen.value) sheetOpen.value = false;
}

/** Hand buttons toggle: equipped in that hand → unequip, else equip there. */
function toggleHand(hand: 'left' | 'right'): void {
  const spell = activeSpellData.value;
  if (!spell) return;
  const formId = spell.formId;
  if (inHand(spell, hand)) ws.sendCommand({ command: 'unequip_spell', formId, hand });
  else ws.sendCommand({ command: 'equip_spell', formId, hand });
}

const sheetStats = computed(() => {
  const s = activeSpellData.value;
  if (!s) return [];
  return [
    { label: t('entities.spell.cost'), value: String(Math.round(s.cost)) },
    { label: t('pages.spellbook.cast'), value: t(`pages.spellbook.casting.${s.castingType}`) },
    { label: t('pages.spellbook.delivery'), value: t(`pages.spellbook.deliveries.${s.delivery}`) },
  ];
});

const sheetEffects = computed(() => {
  const html = getEffectText(activeSpellData.value?.effects);
  return html ? [html] : [];
});
</script>

<style scoped lang="scss">
.book {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.book__schools {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 4px;
}

.book__school {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 34px;
  padding: 0;
  background: rgb(255 255 255 / 3%);
  border: 1px solid var(--skyrim-border-dark);
  border-radius: 999px;
  cursor: pointer;

  &--active {
    border-color: var(--chip-color);
    background: color-mix(in srgb, var(--chip-color) 10%, transparent);
  }
}

.book__school-count {
  font-family: var(--font-heading);
  font-size: 0.64rem;
  color: var(--skyrim-text-secondary);
}

.book__filters {
  display: flex;
  gap: 6px;
}

.book__search {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  font-size: var(--font-size-sm);
}

.book__toggle {
  width: 40px;
  min-height: 34px;
  padding: 0;

  &.is-on {
    border-color: var(--skyrim-accent-main);
    color: var(--skyrim-accent-main);
  }
}

.book__ladder {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.book__tier-title {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 4px 2px;
  background: color-mix(in srgb, var(--skyrim-bg-medium) 90%, transparent);
  font-family: var(--font-heading);
  font-size: 0.64rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--skyrim-text-secondary);

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--skyrim-border-medium), transparent);
  }
}

.book__tier-rank {
  color: var(--skyrim-accent-main);
}

.book__tier-count {
  color: var(--skyrim-text-dim);
}

.book__runes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 2px;
  padding-bottom: 6px;
}

.book__empty {
  margin: var(--spacing-lg) 0;
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-dim);
  text-align: center;
}
</style>
