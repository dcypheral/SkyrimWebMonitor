import { reactive, watch } from 'vue';

const KEY = 'skyrim-monitor-journey-layers';

export interface JourneyLayers {
  /** Hero's path line on the maps. */
  path: boolean;
  /** Note pins on the maps. */
  notes: boolean;
  /** Path of every session (true) or only the current/selected one (false). */
  allSessions: boolean;
  /** Session shown alone on the map (from the journal), or null. */
  focusSessionId: number | null;
}

function read(): JourneyLayers {
  const fallback: JourneyLayers = { path: true, notes: true, allSessions: true, focusSessionId: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    return {
      path: Reflect.get(parsed, 'path') !== false,
      notes: Reflect.get(parsed, 'notes') !== false,
      allSessions: Reflect.get(parsed, 'allSessions') !== false,
      focusSessionId: null,
    };
  } catch {
    return fallback;
  }
}

/** Map layer switches shared by the large map and the home minimap. */
export const journeyLayers = reactive<JourneyLayers>(read());

watch(
  () => ({ path: journeyLayers.path, notes: journeyLayers.notes, allSessions: journeyLayers.allSessions }),
  (value) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* localStorage can be unavailable in restricted WebViews */
    }
  },
);
