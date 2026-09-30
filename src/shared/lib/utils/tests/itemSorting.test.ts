import { describe, it, expect } from 'vitest';
import { groupItems, sortItems, sortKeysFor } from '../itemSorting';
import type { InventoryItem } from '@/stores/inventory/lib/types';

function weapon(name: string, weaponType: string, value: number, weight: number, damage: number): InventoryItem {
  return {
    name, formId: name, count: 1, categoryType: 'Weapon', isFavorite: false, isStolen: false,
    value, weight, damage, baseDamage: damage, enchantment: null, enchantmentCharge: null,
    equipSlots: [], equippedHand: null, isEquipped: false, isTwoHanded: false,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- test fixture
    weaponType: weaponType as 'Bow',
  };
}

const ITEMS = [
  weapon('Iron Dagger', 'OneHandDagger', 10, 2, 4),
  weapon('Glass Bow', 'Bow', 820, 14, 15),
  weapon('Steel Sword', 'OneHandSword', 45, 10, 8),
  weapon('Ebony Dagger', 'OneHandDagger', 290, 5, 10),
];

describe('sortItems', () => {
  it('sorts by name, value (desc) and weight (asc)', () => {
    expect(sortItems(ITEMS, 'name').map((i) => i.name)).toEqual(['Ebony Dagger', 'Glass Bow', 'Iron Dagger', 'Steel Sword']);
    expect(sortItems(ITEMS, 'value')[0].name).toBe('Glass Bow');
    expect(sortItems(ITEMS, 'weight')[0].name).toBe('Iron Dagger');
  });

  it('sorts by value per weight and by damage', () => {
    expect(sortItems(ITEMS, 'ratio')[0].name).toBe('Glass Bow'); // 58.6 per unit
    expect(sortItems(ITEMS, 'power')[0].name).toBe('Glass Bow');
  });

  it('offers the power key only when items have damage or armor', () => {
    expect(sortKeysFor(ITEMS)).toContain('power');
  });
});

describe('groupItems', () => {
  it('groups weapons by type in a fixed order, keeping the sort inside each group', () => {
    const groups = groupItems(sortItems(ITEMS, 'value'));
    expect(groups.map((g) => g.id)).toEqual(['swords', 'daggers', 'bows']);
    expect(groups[1].items.map((i) => i.name)).toEqual(['Ebony Dagger', 'Iron Dagger']);
  });
});
