<template>
  <div class="home">
    <home-vitals class="home__vitals" />

    <div class="home__slots home__slots--left">
      <hotkey-slot-button
        v-for="entry in leftSlots"
        :key="entry.slot"
        :entry="entry"
        @trigger="triggerSlot(entry)"
        @details="openSlotDetails(entry)"
      />
    </div>

    <div class="home__center">
      <mini-map
        class="home__map"
        @open="nav.setActiveTab('map')"
      />
      <div
        v-if="archeryPicker"
        class="home__picker-scrim"
        @click="archeryPicker = null"
      />
      <div class="home__combat">
        <quick-picker
          v-if="archeryPicker === 'bow'"
          class="home__picker"
          :title="t('pages.home.bowPickerTitle')"
          :items="archery.bows.value"
          fallback-icon="delapouite/bow-arrow.svg"
          :empty-text="t('pages.home.noBows')"
          @select="pickBow"
        />
        <quick-picker
          v-else-if="archeryPicker === 'ammo'"
          class="home__picker"
          :title="t('pages.home.ammoPickerTitle')"
          :items="archery.ammo.value"
          fallback-icon="lorc/arrow-cluster.svg"
          :empty-text="t('pages.home.noAmmo')"
          show-count
          @select="pickAmmo"
        />
        <div class="home__combat-row">
          <quick-slot
            v-if="archery.hasArchery.value"
            :item="archery.displayBow.value"
            :label="t('pages.home.bow')"
            fallback-icon="delapouite/bow-arrow.svg"
            :active="!!archery.equippedBow.value"
            :open="archeryPicker === 'bow'"
            @tap="togglePicker('bow')"
            @hold="archery.quickDrawBow"
          />
          <shout-slot
            class="home__shout"
            :shout="equippedShout"
            :compact="archery.hasArchery.value"
            @pick="openShoutPicker"
          />
          <quick-slot
            v-if="archery.hasArchery.value"
            :item="archery.equippedAmmo.value"
            :label="t('pages.home.quiver')"
            fallback-icon="delapouite/quiver.svg"
            :active="!!archery.equippedAmmo.value"
            :open="archeryPicker === 'ammo'"
            :count="archery.equippedAmmo.value?.count ?? null"
            @tap="togglePicker('ammo')"
            @hold="archery.cycleAmmo"
          />
        </div>
      </div>
    </div>

    <div class="home__slots home__slots--right">
      <hotkey-slot-button
        v-for="entry in rightSlots"
        :key="entry.slot"
        :entry="entry"
        @trigger="triggerSlot(entry)"
        @details="openSlotDetails(entry)"
      />
    </div>

    <quest-objective-card
      class="home__quest"
      :quest-name="tracked.quest.value?.name ?? null"
      :objective="tracked.objective.value?.text ?? null"
      :is-tracked="tracked.isTracked.value"
      :index="tracked.position.value.index"
      :total="tracked.position.value.total"
      @open="nav.setActiveTab('quests')"
      @cycle="tracked.cycle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useModal } from '@/shared/lib';
import { useHotkeysStore } from '@/stores/hotkeys/useHotkeysStore';
import { useMagicStore } from '@/stores/magic/useCharacterSpellStore';
import { useNavigationStore } from '@/stores/use-navigation-store/useNavigationStore';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import type { HotkeySlotEntry } from '@/stores/hotkeys/lib/types';
import HomeVitals from '../ui/home-vitals/HomeVitals.vue';
import HotkeySlotButton from '../ui/hotkey-slot-button/HotkeySlotButton.vue';
import HotkeySlotDetails from '../ui/hotkey-slot-details/HotkeySlotDetails.vue';
import MiniMap from '../ui/mini-map/MiniMap.vue';
import QuestObjectiveCard from '../ui/quest-objective-card/QuestObjectiveCard.vue';
import ShoutSlot from '../ui/shout-slot/ShoutSlot.vue';
import ShoutPicker from '../ui/shout-picker/ShoutPicker.vue';
import QuickSlot from '../ui/quick-slot/QuickSlot.vue';
import QuickPicker from '../ui/quick-picker/QuickPicker.vue';
import { useTrackedQuest } from '../composables/useTrackedQuest';
import { useArcheryLoadout } from '../composables/useArcheryLoadout';

const nav = useNavigationStore();
const ws = useWebSocketStore();
const { openModal, closeModal } = useModal();

const { slots } = storeToRefs(useHotkeysStore());
const leftSlots = computed(() => slots.value.slice(0, 4));
const rightSlots = computed(() => slots.value.slice(4, 8));

const magicStore = useMagicStore();
const { shoutsList } = storeToRefs(magicStore);
const equippedShout = computed(() => shoutsList.value.find((s) => s.isEquipped) ?? null);

const tracked = useTrackedQuest();
const { t } = useI18n();

// ─── Bow and quiver ─────────────────────────────────────────────────────
// Tap a slot: a strip of choices opens above it; tap a choice to equip.
// Hold the bow: draw the last bow. Hold the quiver: next arrow type.
const archery = useArcheryLoadout();
const archeryPicker = ref<'bow' | 'ammo' | null>(null);

function togglePicker(kind: 'bow' | 'ammo'): void {
  archeryPicker.value = archeryPicker.value === kind ? null : kind;
}

function pickBow(formId: string): void {
  archery.equipBow(formId);
  archeryPicker.value = null;
}

function pickAmmo(formId: string): void {
  archery.equipAmmo(formId);
  archeryPicker.value = null;
}

function triggerSlot(entry: HotkeySlotEntry): void {
  ws.sendCommand({ command: 'hotkey_trigger', slot: entry.slot });
}

function openSlotDetails(entry: HotkeySlotEntry): void {
  openModal({
    component: HotkeySlotDetails,
    props: { entry },
    on: {
      use: () => {
        triggerSlot(entry);
        closeModal();
      },
      clear: () => {
        ws.sendCommand({ command: 'hotkey_clear', slot: entry.slot });
        closeModal();
      },
    },
  });
}

function openShoutPicker(): void {
  openModal({
    component: ShoutPicker,
    props: { shouts: shoutsList.value },
    on: {
      select: (formId: string) => {
        const shout = shoutsList.value.find((s) => s.formId === formId);
        if (shout && !shout.isEquipped) ws.sendCommand({ command: 'equip_shout', formId });
        closeModal();
      },
    },
  });
}
</script>

<style scoped lang="scss">
/*
 * Layout for the handheld's lower screen (≈ 412 × 470 CSS px):
 *
 *   ┌──────── vitals ────────┐
 *   │ 1 │                │ 5 │
 *   │ 2 │    mini-map    │ 6 │
 *   │ 3 │                │ 7 │
 *   │ 4 │ (bow) shout (q)│ 8 │
 *   ├──── quest objective ───┤
 *
 * Hotkey columns flank the map, like a handheld console's touch screen.
 * Every target is ≥ 44 px tall.
 */
.home {
  --slot-width: clamp(58px, 18vw, 92px);
  --home-spell-color: #9cc4ff;

  display: grid;
  flex: 1;
  grid-template:
    'vitals vitals vitals' auto
    'left center right' minmax(0, 1fr)
    'quest quest quest' auto
    / var(--slot-width) minmax(0, 1fr) var(--slot-width);
  gap: var(--spacing-sm);
  min-height: 0;
  padding: var(--spacing-sm);
}

.home__vitals {
  grid-area: vitals;
  padding: 2px var(--spacing-xs) 0;
}

.home__slots {
  display: grid;
  grid-template-rows: repeat(4, minmax(44px, 1fr));
  gap: var(--spacing-sm);
  min-width: 0;
  min-height: 0;

  &--left {
    grid-area: left;
  }

  &--right {
    grid-area: right;
  }
}

.home__center {
  position: relative;
  display: flex;
  grid-area: center;
  min-width: 0;
  min-height: 0;
}

.home__map {
  flex: 1;
}

/* Bow · shout · quiver float over the bottom of the map. */
.home__combat {
  position: absolute;
  right: var(--spacing-xs);
  bottom: var(--spacing-xs);
  left: var(--spacing-xs);
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
}

.home__combat-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}

.home__shout {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 320px;
}

.home__picker-scrim {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgb(0 0 0 / 35%);
  border-radius: var(--radius-lg);
}

.home__quest {
  grid-area: quest;
}
</style>
