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
      <div class="home__shout">
        <shout-slot
          :shout="equippedShout"
          @pick="openShoutPicker"
        />
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
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
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
import { useTrackedQuest } from '../composables/useTrackedQuest';

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
 *   │ 4 │   [ shout ]    │ 8 │
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

.home__shout {
  position: absolute;
  bottom: var(--spacing-sm);
  left: 50%;
  z-index: 3;
  width: min(100% - 2 * var(--spacing-sm), 320px);
  transform: translateX(-50%);
}

.home__quest {
  grid-area: quest;
}
</style>
