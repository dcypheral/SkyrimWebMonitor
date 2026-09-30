import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useInventoryStore } from '@/stores/inventory/useInventoryStore';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import type { AmmoItem, WeaponItem } from '@/stores/inventory/lib/types';

const LAST_BOW_KEY = 'skyrim-monitor-home-last-bow';

function readLastBow(): string | null {
  try {
    return localStorage.getItem(LAST_BOW_KEY);
  } catch {
    return null;
  }
}

function writeLastBow(formId: string): void {
  try {
    localStorage.setItem(LAST_BOW_KEY, formId);
  } catch {
    /* localStorage can be unavailable in restricted WebViews */
  }
}

export function isRangedWeapon(item: WeaponItem): boolean {
  return item.weaponType === 'Bow' || item.weaponType === 'Crossbow';
}

/** Sort for pickers: equipped first, then by damage, then name. */
function byUsefulness<T extends { isEquipped: boolean; damage: number; name: string }>(a: T, b: T): number {
  if (a.isEquipped !== b.isEquipped) return a.isEquipped ? -1 : 1;
  if (a.damage !== b.damage) return b.damage - a.damage;
  return a.name.localeCompare(b.name);
}

/** Pure helper: the ammo that follows `currentId` in the list (wraps around). */
export function nextAmmoId(ammo: ReadonlyArray<{ formId: string }>, currentId: string | null): string | null {
  if (ammo.length === 0) return null;
  const index = ammo.findIndex((a) => a.formId === currentId);
  return ammo[(index + 1) % ammo.length].formId;
}

/**
 * Bow and quiver quick slots for the home screen. The bow slot keeps showing
 * the last bow used after the player switches to a melee weapon, so one tap
 * brings it back.
 */
export function useArcheryLoadout() {
  const ws = useWebSocketStore();
  const { weapons } = storeToRefs(useInventoryStore());
  const lastBowId = ref<string | null>(readLastBow());

  const bows = computed<WeaponItem[]>(() =>
    (weapons.value.items ?? []).filter(isRangedWeapon).slice().sort(byUsefulness),
  );

  const ammo = computed<AmmoItem[]>(() => (weapons.value.ammo ?? []).slice().sort(byUsefulness));
  /** Stable order for cycling (does not jump as the equipped flag moves). */
  const ammoCycle = computed<AmmoItem[]>(() =>
    (weapons.value.ammo ?? []).slice().sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name)),
  );

  const equippedBow = computed(() => bows.value.find((b) => b.isEquipped) ?? null);
  const equippedAmmo = computed(() => ammo.value.find((a) => a.isEquipped) ?? null);

  watch(
    equippedBow,
    (bow) => {
      if (bow && bow.formId !== lastBowId.value) {
        lastBowId.value = bow.formId;
        writeLastBow(bow.formId);
      }
    },
    { immediate: true },
  );

  /** What the bow slot shows: the equipped bow, else the last one, else the best one. */
  const displayBow = computed<WeaponItem | null>(
    () =>
      equippedBow.value ??
      bows.value.find((b) => b.formId === lastBowId.value) ??
      bows.value[0] ??
      null,
  );

  const hasArchery = computed(() => bows.value.length > 0 || ammo.value.length > 0);

  function equip(formId: string): void {
    ws.sendCommand({ command: 'equip', formId });
  }

  function equipBow(formId: string): void {
    const bow = bows.value.find((b) => b.formId === formId);
    if (!bow || bow.isEquipped) return;
    lastBowId.value = formId;
    writeLastBow(formId);
    equip(formId);
  }

  function equipAmmo(formId: string): void {
    const item = ammo.value.find((a) => a.formId === formId);
    if (!item || item.isEquipped) return;
    equip(formId);
  }

  /** Long-press shortcut: draw the displayed bow. */
  function quickDrawBow(): void {
    if (displayBow.value) equipBow(displayBow.value.formId);
  }

  /** Long-press shortcut: next arrow type. */
  function cycleAmmo(): void {
    const next = nextAmmoId(ammoCycle.value, equippedAmmo.value?.formId ?? null);
    if (next) equipAmmo(next);
  }

  return {
    bows,
    ammo,
    equippedBow,
    equippedAmmo,
    displayBow,
    hasArchery,
    equipBow,
    equipAmmo,
    quickDrawBow,
    cycleAmmo,
  };
}
