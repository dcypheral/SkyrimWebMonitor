import { describe, it, expect } from 'vitest';
import { DEFAULT_ITEM_MATERIAL, getItemMaterial } from '../itemMaterials';

describe('getItemMaterial', () => {
  it.each([
    [['WeapMaterialDaedric', 'WeapTypeSword'], 'daedric'],
    [['ArmorMaterialElvenGilded', 'ArmorLight'], 'elvenGilded'],
    [['ArmorMaterialElven'], 'elven'],
    [['DLC1WeapMaterialDragonbone'], 'dragonbone'],
    [['DLC2ArmorMaterialStalhrimHeavy'], 'stalhrim'],
    [['DLC1ArmorMaterielFalmerHeavyOriginal'], 'falmer'],
    [['ArmorMaterialHide', 'VendorItemArmor'], 'leather'],
    [['ArmorJewelry', 'VendorItemJewelry'], 'jewelry'],
    [['WeapMaterialSteel'], 'steel'],
  ])('%j → %s', (keywords, expected) => {
    expect(getItemMaterial(keywords).id).toBe(expected);
  });

  it('ignores non-material keywords', () => {
    // "VendorItemWeapon" must not match "wood"/"iron" style substrings.
    expect(getItemMaterial(['VendorItemWeapon', 'WeapTypeSword'])).toBe(DEFAULT_ITEM_MATERIAL);
  });

  it('falls back for missing keywords (older plugin)', () => {
    expect(getItemMaterial(undefined)).toBe(DEFAULT_ITEM_MATERIAL);
    expect(getItemMaterial([])).toBe(DEFAULT_ITEM_MATERIAL);
  });

  it('exposes WebGL-ready RGB in 0..1', () => {
    const { rgb } = getItemMaterial(['WeapMaterialGlass']);
    expect(rgb.every((c) => c >= 0 && c <= 1)).toBe(true);
  });
});
