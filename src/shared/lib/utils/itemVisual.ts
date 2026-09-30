/**
 * Presentation helpers shared by every inventory tile: which category icon to
 * fall back to, how a 3D thumbnail should be framed, and item state flags.
 */
import { getWeaponIconPath } from '@/shared/lib/constants/weaponIcons';
import { getApparelIconPath } from '@/shared/lib/constants/apparelIcons';
import type { ThumbnailFraming } from '@/shared/lib/nif';
import type { InventoryItem } from '@/stores/inventory/lib/types';

const CATEGORY_FALLBACK_ICONS: Record<string, string> = {
  Ammo: 'lorc/arrow-cluster.svg',
  Book: 'lorc/open-book.svg',
  Potion: 'lorc/potion-ball.svg',
  Food: 'lorc/shiny-apple.svg',
  Ingredient: 'skoll/pestle-mortar.svg',
  Key: 'lorc/key.svg',
  SoulGem: 'lorc/crystal-shine.svg',
  Scroll: 'lorc/tied-scroll.svg',
  Misc: 'lorc/swap-bag.svg',
};

export function getItemFallbackIcon(item: InventoryItem): string {
  if ('weaponType' in item && item.categoryType === 'Weapon') return getWeaponIconPath(item.weaponType);
  if ('bodySlots' in item && item.categoryType === 'Apparel') {
    return getApparelIconPath(item.bodySlots?.[0] ?? null);
  }
  return CATEGORY_FALLBACK_ICONS[item.categoryType] ?? 'lorc/swap-bag.svg';
}

export function getItemFraming(item: Pick<InventoryItem, 'categoryType'>): ThumbnailFraming {
  return item.categoryType === 'Weapon' || item.categoryType === 'Ammo' ? 'diagonal' : 'upright';
}

export function isItemEquipped(item: InventoryItem): boolean {
  return 'isEquipped' in item && !!item.isEquipped;
}

export function isItemEnchanted(item: InventoryItem): boolean {
  return 'enchantment' in item && !!item.enchantment;
}
