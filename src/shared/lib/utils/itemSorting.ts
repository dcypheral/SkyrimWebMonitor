/**
 * Sorting and grouping for inventory grids. Pure functions so they are easy
 * to test and reuse across categories.
 */
import type { InventoryItem } from '@/stores/inventory/lib/types';

export type ItemSortKey = 'name' | 'value' | 'weight' | 'ratio' | 'power' | 'count';

export const SORT_KEYS: ItemSortKey[] = ['name', 'value', 'weight', 'ratio', 'power', 'count'];

/** Damage for weapons/ammo, armor rating for apparel, else undefined. */
function power(item: InventoryItem): number | undefined {
  if ('damage' in item && typeof item.damage === 'number') return item.damage;
  if ('armorRating' in item && typeof item.armorRating === 'number') return item.armorRating;
  return undefined;
}

export function sortKeysFor(items: readonly InventoryItem[]): ItemSortKey[] {
  const hasPower = items.some((i) => power(i) !== undefined);
  return SORT_KEYS.filter((k) => k !== 'power' || hasPower);
}

export function sortItems(items: readonly InventoryItem[], key: ItemSortKey): InventoryItem[] {
  const byName = (a: InventoryItem, b: InventoryItem): number => a.name.localeCompare(b.name);
  const desc = (f: (i: InventoryItem) => number) => (a: InventoryItem, b: InventoryItem) =>
    f(b) - f(a) || byName(a, b);

  const list = [...items];
  switch (key) {
    case 'value':
      return list.sort(desc((i) => i.value ?? 0));
    case 'weight':
      return list.sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0) || byName(a, b));
    case 'ratio':
      // Value per unit of weight; weightless items first.
      return list.sort(desc((i) => ((i.weight ?? 0) > 0 ? (i.value ?? 0) / i.weight : Number.MAX_SAFE_INTEGER)));
    case 'power':
      return list.sort(desc((i) => power(i) ?? -1));
    case 'count':
      return list.sort(desc((i) => i.count ?? 0));
    case 'name':
    default:
      return list.sort(byName);
  }
}

export interface ItemGroup {
  id: string;
  /** i18n key under pages.inventory.groups */
  labelKey: string;
  items: InventoryItem[];
}

const WEAPON_GROUPS: Array<[string, (i: InventoryItem) => boolean]> = [
  ['swords', (i) => 'weaponType' in i && i.weaponType === 'OneHandSword'],
  ['daggers', (i) => 'weaponType' in i && i.weaponType === 'OneHandDagger'],
  ['axes', (i) => 'weaponType' in i && i.weaponType === 'OneHandAxe'],
  ['maces', (i) => 'weaponType' in i && i.weaponType === 'OneHandMace'],
  ['greatswords', (i) => 'weaponType' in i && i.weaponType === 'TwoHandSword'],
  ['battleaxes', (i) => 'weaponType' in i && i.weaponType === 'TwoHandAxe'],
  ['bows', (i) => 'weaponType' in i && (i.weaponType === 'Bow' || i.weaponType === 'Crossbow')],
  ['ammo', (i) => i.categoryType === 'Ammo'],
  ['staves', (i) => 'weaponType' in i && i.weaponType === 'Staff'],
];

const APPAREL_GROUPS: Array<[string, (slots: string[]) => boolean]> = [
  ['head', (s) => s.includes('Head') || s.includes('Hair') || s.includes('LongHair')],
  ['body', (s) => s.includes('Body')],
  ['hands', (s) => s.includes('Hands') || s.includes('Forearms')],
  ['feet', (s) => s.includes('Feet') || s.includes('Calves')],
  ['shields', (s) => s.includes('Shield')],
  ['jewelry', (s) => s.includes('Amulet') || s.includes('Ring') || s.includes('Circlet') || s.includes('Ears')],
];

/**
 * Split sorted items into categorical sections (weapons by type, apparel by
 * body slot). Returns a single untitled group for other categories.
 */
export function groupItems(items: readonly InventoryItem[]): ItemGroup[] {
  const isWeapons = items.some((i) => i.categoryType === 'Weapon' || i.categoryType === 'Ammo');
  const isApparel = items.some((i) => i.categoryType === 'Apparel');
  if (!isWeapons && !isApparel) return [{ id: 'all', labelKey: '', items: [...items] }];

  const groups = new Map<string, InventoryItem[]>();
  const push = (id: string, item: InventoryItem): void => {
    const list = groups.get(id);
    if (list) list.push(item);
    else groups.set(id, [item]);
  };

  for (const item of items) {
    if (isWeapons) {
      const match = WEAPON_GROUPS.find(([, test]) => test(item));
      push(match ? match[0] : 'other', item);
    } else {
      const slots = 'bodySlots' in item ? (item.bodySlots ?? []) : [];
      const match = APPAREL_GROUPS.find(([, test]) => test(slots));
      push(match ? match[0] : 'other', item);
    }
  }

  const order = [...(isWeapons ? WEAPON_GROUPS : APPAREL_GROUPS).map(([id]) => id), 'other'];
  return order
    .filter((id) => groups.has(id))
    .map((id) => ({ id, labelKey: `pages.inventory.groups.${id}`, items: groups.get(id) ?? [] }));
}
