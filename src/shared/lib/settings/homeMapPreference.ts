import { ref } from 'vue';

const KEY = 'skyrim-monitor-home-map-mode';

/**
 * Home mini-map:
 *  - auto:  local floor plan inside interiors and cities, world map outside
 *  - world: always the world map
 */
export type HomeMapMode = 'auto' | 'world';

function read(): HomeMapMode {
  try {
    return localStorage.getItem(KEY) === 'world' ? 'world' : 'auto';
  } catch {
    return 'auto';
  }
}

export const homeMapMode = ref<HomeMapMode>(read());

export function persistHomeMapMode(mode: HomeMapMode): void {
  homeMapMode.value = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* localStorage can be unavailable in restricted WebViews */
  }
}
