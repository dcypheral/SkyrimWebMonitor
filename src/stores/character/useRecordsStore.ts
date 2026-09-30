/**
 * Journal records: general stats (Player::MiscStats) and active magic
 * effects (Player::ActiveEffects). Needs plugin feature "player.records".
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const STAT_CATEGORIES = ['General', 'Quest', 'Combat', 'Magic', 'Crafting', 'Crime'] as const;
export type StatCategory = (typeof STAT_CATEGORIES)[number];

export interface StatEntry {
  name: string;
  value: number;
}

export interface ActiveEffectEntry {
  name: string;
  source: string;
  magnitude: number;
  /** Seconds; 0 = permanent. */
  duration: number;
  elapsed: number;
  remaining: number;
  detrimental: boolean;
}

function isStat(v: unknown): v is StatEntry {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof Reflect.get(v, 'name') === 'string' &&
    typeof Reflect.get(v, 'value') === 'number'
  );
}

function isEffect(v: unknown): v is ActiveEffectEntry {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof Reflect.get(v, 'name') === 'string' &&
    typeof Reflect.get(v, 'magnitude') === 'number'
  );
}

export const useRecordsStore = defineStore('records', () => {
  const stats = ref<Record<StatCategory, StatEntry[]>>({
    General: [],
    Quest: [],
    Combat: [],
    Magic: [],
    Crafting: [],
    Crime: [],
  });
  const effects = ref<ActiveEffectEntry[]>([]);
  const received = ref(false);

  function setRecords(data: unknown): void {
    if (typeof data !== 'object' || data === null) return;
    received.value = true;
    const misc: unknown = Reflect.get(data, 'miscStats');
    if (typeof misc === 'object' && misc !== null) {
      const next = { ...stats.value };
      for (const cat of STAT_CATEGORIES) {
        const list: unknown = Reflect.get(misc, cat);
        if (Array.isArray(list)) next[cat] = list.filter(isStat);
      }
      stats.value = next;
    }
    const fx: unknown = Reflect.get(data, 'effects');
    if (Array.isArray(fx)) effects.value = fx.filter(isEffect);
  }

  return { stats, effects, received, setRecords };
});
