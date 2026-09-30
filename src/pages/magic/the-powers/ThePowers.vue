<template>
  <div class="powers">
    <div
      class="powers__list"
      @scroll.passive="sheetOpen = false"
    >
      <section
        v-for="group in groups"
        :key="group.id"
        class="powers__group"
      >
        <h3 class="powers__title">
          {{ group.label }}
          <span class="powers__hint">{{ group.hint }}</span>
        </h3>
        <div class="powers__runes">
          <spell-rune
            v-for="p in group.items"
            :key="p.formId"
            :name="p.name"
            :icon="getSpellIconPath(p)"
            :color="group.color"
            :hand="p.isEquipped ? 'voice' : null"
            :is-favorite="p.isFavorite"
            :hotkey="hotkeys.getSlotForFormId(p.formId)"
            :active="activeId === p.formId"
            @select="select(p.formId)"
          />
        </div>
      </section>
      <p
        v-if="!groups.length"
        class="powers__empty"
      >
        {{ t('pages.spellbook.noPowers') }}
      </p>
    </div>

    <magic-sheet
      v-if="active"
      v-model:open="sheetOpen"
      :title="active.name"
      :subtitle="active.spellType === 'Power' ? t('pages.spellbook.greater') : t('pages.spellbook.lesser')"
      :icon="getSpellIconPath(active)"
      :color="active.spellType === 'Power' ? GREATER_COLOR : LESSER_COLOR"
      :effects="effects"
    >
      <button
        type="button"
        class="btn"
        :class="{ 'is-on': active.isEquipped }"
        :disabled="active.isEquipped"
        @click="equip(active.formId)"
      >
        {{ active.isEquipped ? t('pages.spellbook.inVoiceSlot') : t('pages.spellbook.useAsPower') }}
      </button>
      <button
        type="button"
        class="btn"
        :class="{ 'is-on': active.isFavorite }"
        :aria-label="t('shared.ui.itemMenu.favorite')"
        @click="ws.sendCommand({ command: 'favorite_spell', formId: active.formId })"
      >
        ★
      </button>
      <button
        type="button"
        class="btn"
        @click="openHotkey(active)"
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
import { useModal } from '@/shared/lib';
import { HotkeyPickerModal } from '@/shared/ui';
import { getEffectText } from '@/shared/lib/utils/getEffectHtml';
import { getSpellIconPath } from '@/shared/lib/utils/spellIcons';
import { useHotkeysStore } from '@/stores/hotkeys/useHotkeysStore';
import { useMagicStore } from '@/stores/magic/useCharacterSpellStore';
import type { PowerItem } from '@/stores/magic/lib/types';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import SpellRune from '../ui/spell-rune/SpellRune.vue';
import MagicSheet from '../ui/magic-sheet/MagicSheet.vue';

const GREATER_COLOR = '#f0c75e';
const LESSER_COLOR = '#8fc7ff';

const { t } = useI18n();
const ws = useWebSocketStore();
const hotkeys = useHotkeysStore();
const { openModal, closeModal } = useModal();
const { powersList } = storeToRefs(useMagicStore());

const activeId = ref<string | null>(null);
const sheetOpen = ref(false);
const active = computed(() => powersList.value.find((p) => p.formId === activeId.value) ?? null);

const groups = computed(() =>
  [
    {
      id: 'greater',
      label: t('pages.spellbook.greater'),
      hint: t('pages.spellbook.greaterHint'),
      color: GREATER_COLOR,
      items: powersList.value.filter((p) => p.spellType === 'Power'),
    },
    {
      id: 'lesser',
      label: t('pages.spellbook.lesser'),
      hint: t('pages.spellbook.lesserHint'),
      color: LESSER_COLOR,
      items: powersList.value.filter((p) => p.spellType === 'LesserPower'),
    },
  ].filter((g) => g.items.length > 0),
);

const effects = computed(() => {
  const html = getEffectText(active.value?.effects);
  return html ? [html] : [];
});

function select(formId: string): void {
  activeId.value = formId;
  sheetOpen.value = true;
}

function equip(formId: string): void {
  ws.sendCommand({ command: 'equip_power', formId });
}

function openHotkey(power: PowerItem): void {
  openModal({
    component: HotkeyPickerModal,
    props: { currentSlot: hotkeys.getSlotForFormId(power.formId), itemName: power.name },
    on: {
      select: (slot: number) => {
        hotkeys.toggle(slot, {
          kind: 'spell',
          formId: power.formId,
          name: power.name,
          spellType: power.spellType,
          school: 'None',
          cost: power.cost,
          level: 0,
          chargeTime: 0,
        });
        closeModal();
      },
    },
  });
}
</script>

<style scoped lang="scss">
.powers {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.powers__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.powers__title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 4px 0;
  font-family: var(--font-heading);
  font-size: 0.66rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--skyrim-text-secondary);
}

.powers__hint {
  font-family: var(--font-body);
  font-size: 0.64rem;
  letter-spacing: 0;
  text-transform: none;
  color: var(--skyrim-text-dim);
}

.powers__runes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 2px;
  padding-bottom: 8px;
}

.powers__empty {
  margin: var(--spacing-lg) 0;
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-dim);
  text-align: center;
}
</style>
