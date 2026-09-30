import type { InventoryItem } from '@/stores/inventory/lib/types';
import type { SpellItem } from '@/stores/magic/lib/types';
import type { HotkeyBinding } from './types';

/** Snapshot of an inventory item for a hotkey slot. */
export function itemBinding(item: InventoryItem | undefined, formId: string, name: string): HotkeyBinding {
  return {
    kind: 'item',
    formId,
    name,
    categoryType: item?.categoryType ?? 'Unknown',
    count: item?.count ?? 1,
    weight: item?.weight ?? 0,
    value: item?.value ?? 0,
    isFavorite: item?.isFavorite ?? false,
    ...(item && 'weaponType' in item ? { weaponType: item.weaponType } : {}),
    ...(item && 'bodySlots' in item ? { bodySlot: item.bodySlots?.[0] ?? null } : {}),
  };
}

/** Snapshot of a school spell for a hotkey slot. */
export function spellBinding(spell: SpellItem | undefined, formId: string, name: string): HotkeyBinding {
  return {
    kind: 'spell',
    formId,
    name,
    spellType: 'Spell',
    school: spell?.categoryType ?? 'None',
    cost: spell?.cost ?? 0,
    level: spell?.level ?? 0,
    chargeTime: spell?.chargeTime ?? 0,
  };
}
