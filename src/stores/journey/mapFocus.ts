import { shallowRef } from 'vue';

export interface MapFocusRequest {
  worldspace: string;
  /** World coordinates. */
  x: number;
  y: number;
  /** Changes on every request so the same spot can be requested twice. */
  at: number;
}

/** Set to ask the large map to center on a spot (e.g. "Show on map"). */
export const mapFocusRequest = shallowRef<MapFocusRequest | null>(null);

export function requestMapFocus(worldspace: string, x: number, y: number): void {
  mapFocusRequest.value = { worldspace, x, y, at: Date.now() };
}
