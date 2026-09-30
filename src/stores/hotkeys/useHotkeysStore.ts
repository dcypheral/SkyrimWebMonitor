import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SendCommandOptions } from '@/api/websocket';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import {
  NATIVE_HOTKEY_COUNT,
  TOTAL_HOTKEY_COUNT,
  isNativeHotkeySlot,
  type HotkeyBinding,
  type HotkeyItemsState,
  type HotkeySlotEntry,
} from './lib/types';

const EXTRA_STORAGE_KEY = 'skyrim-monitor-extra-hotkeys';

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const EMPTY_SLOTS: HotkeySlotEntry[] = range(1, NATIVE_HOTKEY_COUNT).map((slot) => ({ slot, bound: false }));

function isBoundEntry(v: unknown): v is HotkeySlotEntry {
  if (typeof v !== 'object' || v === null) return false;
  const slot: unknown = Reflect.get(v, 'slot');
  const kind: unknown = Reflect.get(v, 'kind');
  return (
    typeof slot === 'number' &&
    slot > NATIVE_HOTKEY_COUNT &&
    slot <= TOTAL_HOTKEY_COUNT &&
    Reflect.get(v, 'bound') === true &&
    (kind === 'item' || kind === 'spell') &&
    typeof Reflect.get(v, 'formId') === 'string' &&
    typeof Reflect.get(v, 'name') === 'string'
  );
}

function loadExtra(): HotkeySlotEntry[] {
  let stored: HotkeySlotEntry[] = [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(EXTRA_STORAGE_KEY) ?? '[]');
    if (Array.isArray(parsed)) stored = parsed.filter(isBoundEntry);
  } catch {
    /* corrupt or unavailable storage: start empty */
  }
  return range(NATIVE_HOTKEY_COUNT + 1, TOTAL_HOTKEY_COUNT).map(
    (slot) => stored.find((e) => e.slot === slot) ?? { slot, bound: false },
  );
}

/**
 * The command a hotkey sends when used. Native slots ask the game to run
 * its own hotkey; app slots (9–16) equip or use the bound form directly.
 */
export function triggerCommand(entry: HotkeySlotEntry): SendCommandOptions | null {
  if (!entry.bound) return null;
  if (isNativeHotkeySlot(entry.slot)) return { command: 'hotkey_trigger', slot: entry.slot };
  const formId = entry.formId;
  if (entry.kind === 'spell') {
    switch (entry.spellType) {
      case 'Shout':
        return { command: 'equip_shout', formId };
      case 'Power':
      case 'LesserPower':
      case 'VoicePower':
        return { command: 'equip_power', formId };
      default:
        return { command: 'equip_spell', formId, hand: 'right' };
    }
  }
  switch (entry.categoryType) {
    case 'Weapon':
    case 'Apparel':
    case 'Ammo':
      return { command: 'equip', formId };
    case 'Book':
      return { command: 'read_book', formId };
    default:
      return { command: 'use', formId };
  }
}

export const useHotkeysStore = defineStore('hotkeys', () => {
  /** Game hotkeys 1–8. */
  const slots = ref<HotkeySlotEntry[]>(EMPTY_SLOTS);
  /** App hotkeys 9–16 (stored on this device). */
  const extraSlots = ref<HotkeySlotEntry[]>(loadExtra());

  const allSlots = computed<HotkeySlotEntry[]>(() => [...slots.value, ...extraSlots.value]);

  const slotsBySlotNumber = computed<Record<number, HotkeySlotEntry>>(() => {
    const map: Record<number, HotkeySlotEntry> = {};
    allSlots.value.forEach((entry) => {
      map[entry.slot] = entry;
    });
    return map;
  });

  const getSlotForFormId = (formId: string | null | undefined): number | null => {
    if (!formId) return null;
    const found = allSlots.value.find((entry) => entry.bound && entry.formId === formId);
    return found ? found.slot : null;
  };

  const setHotkeys = (data: HotkeyItemsState): void => {
    const incoming = data.items ?? null;
    if (!Array.isArray(incoming)) return;

    // Normalize to exactly 8 ordered slots
    slots.value = range(1, NATIVE_HOTKEY_COUNT).map((slot) => {
      const entry = incoming.find((e) => e.slot === slot);
      if (entry) return entry;
      const fallback: HotkeySlotEntry = { slot, bound: false };
      return fallback;
    });
  };

  function saveExtra(): void {
    try {
      localStorage.setItem(EXTRA_STORAGE_KEY, JSON.stringify(extraSlots.value.filter((e) => e.bound)));
    } catch {
      /* localStorage can be unavailable in restricted WebViews */
    }
  }

  function setExtra(slot: number, entry: HotkeySlotEntry): void {
    extraSlots.value = extraSlots.value.map((e) => (e.slot === slot ? entry : e));
    saveExtra();
  }

  /** Bind a form to a slot (1–16). A form lives in one slot at a time. */
  function bind(slot: number, binding: HotkeyBinding): void {
    const ws = useWebSocketStore();
    const previous = getSlotForFormId(binding.formId);
    if (previous !== null && previous !== slot) unbind(previous);
    if (isNativeHotkeySlot(slot)) {
      ws.sendCommand({ command: 'hotkey_set', formId: binding.formId, slot });
      return;
    }
    if (slot > NATIVE_HOTKEY_COUNT && slot <= TOTAL_HOTKEY_COUNT) {
      const entry: HotkeySlotEntry = { ...binding, slot, bound: true };
      setExtra(slot, entry);
    }
  }

  function unbind(slot: number): void {
    if (isNativeHotkeySlot(slot)) {
      useWebSocketStore().sendCommand({ command: 'hotkey_clear', slot });
      return;
    }
    setExtra(slot, { slot, bound: false });
  }

  /** Tap on a slot in the picker: same slot clears, another slot binds. */
  function toggle(slot: number, binding: HotkeyBinding): void {
    if (getSlotForFormId(binding.formId) === slot) unbind(slot);
    else bind(slot, binding);
  }

  function trigger(entry: HotkeySlotEntry): void {
    const command = triggerCommand(entry);
    if (command) useWebSocketStore().sendCommand(command);
  }

  return {
    slots,
    extraSlots,
    allSlots,
    slotsBySlotNumber,
    getSlotForFormId,
    setHotkeys,
    bind,
    unbind,
    toggle,
    trigger,
  };
});
