import { ref, watch, type Ref } from 'vue';
import { SORT_KEYS, type ItemSortKey } from '@/shared/lib/utils/itemSorting';

const STORAGE_KEY = 'skyrim-monitor-inventory-sort';

interface SortPrefs {
  sort: ItemSortKey;
  grouped: boolean;
}

function isSortKey(value: unknown): value is ItemSortKey {
  return typeof value === 'string' && SORT_KEYS.some((k) => k === value);
}

function readAll(): Record<string, SortPrefs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, SortPrefs> = {};
    const entries: Array<[string, unknown]> = Object.entries(parsed);
    for (const [category, value] of entries) {
      if (!value || typeof value !== 'object') continue;
      const sort: unknown = Reflect.get(value, 'sort');
      const grouped: unknown = Reflect.get(value, 'grouped');
      out[category] = { sort: isSortKey(sort) ? sort : 'name', grouped: grouped !== false };
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, SortPrefs>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* localStorage can be unavailable in restricted WebViews */
  }
}

/** Sort key + grouping per inventory category, remembered on this device. */
export function useInventorySort(category: Ref<string>) {
  const sortKey = ref<ItemSortKey>('name');
  const grouped = ref(true);

  watch(
    category,
    (cat) => {
      const prefs = readAll()[cat];
      sortKey.value = prefs?.sort ?? 'name';
      grouped.value = prefs?.grouped ?? true;
    },
    { immediate: true },
  );

  watch([sortKey, grouped], ([sort, group]) => {
    if (!category.value) return;
    const all = readAll();
    all[category.value] = { sort, grouped: group };
    writeAll(all);
  });

  return { sortKey, grouped };
}
