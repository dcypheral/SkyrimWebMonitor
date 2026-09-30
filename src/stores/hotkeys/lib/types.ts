import type { HotkeySlot } from '@/api/websocket';
import type { CategoryType, WeaponType, BodySlot } from '@/stores/inventory/lib/types';
import type { MagicSchool } from '@/stores/magic/lib/types';

export type HotkeyKind = 'spell' | 'item';

/** Slots 1–8 are the game's own hotkeys; 9–16 live in the app. */
export const NATIVE_HOTKEY_COUNT = 8;
export const TOTAL_HOTKEY_COUNT = 16;

export function isNativeHotkeySlot(slot: number): slot is HotkeySlot {
  return Number.isInteger(slot) && slot >= 1 && slot <= NATIVE_HOTKEY_COUNT;
}

export type SpellKind = 'Spell' | 'Power' | 'LesserPower' | 'VoicePower' | 'Shout';

export interface HotkeySlotUnbound {
  slot: number;
  bound: false;
}

export interface HotkeySlotSpell {
  slot: number;
  bound: true;
  kind: 'spell';
  name: string;
  formId: string;
  spellType: SpellKind;
  school: MagicSchool | 'None';
  cost: number;
  level: number;
  chargeTime: number;
}

export interface HotkeySlotItem {
  slot: number;
  bound: true;
  kind: 'item';
  name: string;
  formId: string;
  categoryType: CategoryType | 'Unknown';
  count: number;
  weight: number;
  value: number;
  isFavorite: boolean;
  // Optional type hints so the hotkey UI can show a more specific icon
  // (reusing the same mappings as WeaponIcon / ApparelIcon).
  weaponType?: WeaponType;
  bodySlot?: BodySlot | null;
}

export type HotkeySlotEntry = HotkeySlotUnbound | HotkeySlotSpell | HotkeySlotItem;

/** What a binding needs to remember (slot and bound flag are added on bind). */
export type HotkeyBinding = Omit<HotkeySlotSpell, 'slot' | 'bound'> | Omit<HotkeySlotItem, 'slot' | 'bound'>;

/** Hand choice for a hotkey used from the app. */
export type HotkeyHand = 'left' | 'right' | 'both';

const ONE_HANDED = new Set(['OneHandSword', 'OneHandDagger', 'OneHandAxe', 'OneHandMace', 'Staff']);

/** Spells and one-handed weapons can go in either hand. */
export function supportsHandChoice(entry: HotkeySlotEntry): boolean {
  if (!entry.bound) return false;
  if (entry.kind === 'spell') return entry.spellType === 'Spell';
  return entry.categoryType === 'Weapon' && !!entry.weaponType && ONE_HANDED.has(entry.weaponType);
}

export interface HotkeyItemsState {
  items?: HotkeySlotEntry[] | null;
}
