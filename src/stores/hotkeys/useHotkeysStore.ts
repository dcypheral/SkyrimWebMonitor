import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SendCommandOptions } from '@/api/websocket';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import {
  NATIVE_HOTKEY_COUNT,
  TOTAL_HOTKEY_COUNT,
  isNativeHotkeySlot,
  supportsHandChoice,
  type HotkeyBinding,
  type HotkeyHand,
  type HotkeyItemsState,
  type HotkeySlotEntry,
} from './lib/types';

const EXTRA_STORAGE_KEY = 'skyrim-monitor-extra-hotkeys';
const HANDS_STORAGE_KEY = 'skyrim-monitor-hotkey-hands';

/** Hand choice per slot, remembered with the form it was made for. */
type HandMap = Record<number, { formId: string; hand: HotkeyHand }>;

function isHand(v: unknown): v is HotkeyHand {
  return v === 'left' || v === 'right' || v === 'both';
}

function loadHands(): HandMap {
  const out: HandMap = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HANDS_STORAGE_KEY) ?? '{}');
    if (typeof parsed !== 'object' || parsed === null) return out;
    for (const [key, value] of Object.entries(parsed)) {
      const slot = Number(key);
      if (typeof value !== 'object' || value === null) continue;
      const formId: unknown = Reflect.get(value, 'formId');
      const hand: unknown = Reflect.get(value, 'hand');
      if (Number.isInteger(slot) && typeof formId === 'string' && isHand(hand)) out[slot] = { formId, hand };
    }
  } catch {
    /* corrupt or unavailable storage */
  }
  return out;
}

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

function isSlotEntry(v: unknown): v is HotkeySlotEntry {
  return typeof v === 'object' && v !== null && typeof Reflect.get(v, 'slot') === 'number' && typeof Reflect.get(v, 'bound') === 'boolean';
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
 * Commands for a hotkey used from the app with a hand choice. A native slot
 * then equips directly too, since the game's own hotkey has no hand option.
 * "both" sends one command per hand (a weapon needs two copies for that).
 */
export function triggerCommands(entry: HotkeySlotEntry, hand: HotkeyHand | null): SendCommandOptions[] {
  if (!entry.bound) return [];
  if (hand && supportsHandChoice(entry)) {
    const command = entry.kind === 'spell' ? 'equip_spell' : 'equip';
    const hands: Array<'left' | 'right'> = hand === 'both' ? ['left', 'right'] : [hand];
    return hands.map((h) => ({ command, formId: entry.formId, hand: h }));
  }
  const single = triggerCommand(entry);
  return single ? [single] : [];
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

  // ─── Hand choice (long-press menu on Home) ─────────────────────────────
  const hands = ref<HandMap>(loadHands());

  /** Hand chosen for this slot's current form, or null (game default). */
  function handFor(entry: HotkeySlotEntry): HotkeyHand | null {
    if (!entry.bound) return null;
    const saved = hands.value[entry.slot];
    return saved && saved.formId === entry.formId ? saved.hand : null;
  }

  /** Left/right toggles: both on = both hands, both off = default. */
  function setHands(entry: HotkeySlotEntry, left: boolean, right: boolean): void {
    if (!entry.bound) return;
    const next: HandMap = { ...hands.value };
    if (left && right) next[entry.slot] = { formId: entry.formId, hand: 'both' };
    else if (left) next[entry.slot] = { formId: entry.formId, hand: 'left' };
    else if (right) next[entry.slot] = { formId: entry.formId, hand: 'right' };
    else delete next[entry.slot];
    hands.value = next;
    try {
      localStorage.setItem(HANDS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }

  /**
   * Re-reads the game's hotkeys (slots 1–8). Uses its own query id so a live
   * 'hotkeys.items' subscription or a background query cannot take the reply.
   */
  function refreshFromGame(): void {
    useWebSocketStore().sendQuery('hotkeys.items.refresh', { items: 'Hotkey::Items' }, (fields) => {
      if (Array.isArray(fields.items)) setHotkeys({ items: fields.items.filter(isSlotEntry) });
    });
  }

  function trigger(entry: HotkeySlotEntry): void {
    const ws = useWebSocketStore();
    for (const command of triggerCommands(entry, handFor(entry))) ws.sendCommand(command);
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
    refreshFromGame,
    hands,
    handFor,
    setHands,
  };
});
