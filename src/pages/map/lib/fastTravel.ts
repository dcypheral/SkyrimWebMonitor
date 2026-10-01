/**
 * Fast travel from the app with feedback. The plugin answers right away
 * (checks passed, Papyrus call queued); whether the game then really moved
 * the player is seen from the position stream: a jump in place or cell.
 */
import { watch } from 'vue';
import { storeToRefs } from 'pinia';
import { i18n } from '@/i18n';
import { useToast } from '@/shared/lib/composables/useToast';
import { useGameStatusStore } from '@/stores/game/useGameStatusStore';
import { useMapPlayerStore } from '@/stores/map/useMapPlayerStore';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';

/** World units: further than a sprint can cover in the wait below. */
const JUMP_DISTANCE = 6000;
const ARRIVAL_TIMEOUT_MS = 20_000;

export interface TravelPoint {
  x: number;
  y: number;
  cellFormId: string | null;
  worldspace: string | null;
}

/** True when the player clearly moved by travel, not by walking. */
export function hasTravelled(from: TravelPoint, to: TravelPoint): boolean {
  if (from.cellFormId !== to.cellFormId && (from.worldspace !== to.worldspace || from.cellFormId === null || to.cellFormId === null)) {
    return true;
  }
  return Math.hypot(to.x - from.x, to.y - from.y) > JUMP_DISTANCE;
}

export function fastTravelTo(refId: string, name: string): void {
  const t = i18n.global.t;
  const toast = useToast();
  const ws = useWebSocketStore();
  const gameStatus = useGameStatusStore();

  if (!gameStatus.canAct) {
    toast.show(t('pages.map.fastTravel.notReady'), 'error');
    return;
  }

  const { position } = storeToRefs(useMapPlayerStore());
  const start = position.value;
  const from: TravelPoint | null = start
    ? { x: start.x, y: start.y, cellFormId: start.cellFormId, worldspace: start.worldspace }
    : null;

  ws.sendCommand({ command: 'fast_travel', formId: refId }, (result) => {
    if (!result.success) {
      toast.show(t('pages.map.fastTravel.failed', { reason: result.error ?? '' }), 'error', 5000);
      return;
    }
    toast.show(t('pages.map.fastTravel.travelling', { place: name }), 'info', ARRIVAL_TIMEOUT_MS);
    if (!from) return;

    let stop: (() => void) | null = null;
    const timer = setTimeout(() => {
      stop?.();
      toast.show(t('pages.map.fastTravel.noTravel'), 'error', 7000);
    }, ARRIVAL_TIMEOUT_MS);
    stop = watch(position, (p) => {
      if (!p) return;
      if (hasTravelled(from, { x: p.x, y: p.y, cellFormId: p.cellFormId, worldspace: p.worldspace })) {
        clearTimeout(timer);
        stop?.();
        toast.show(t('pages.map.fastTravel.arrived', { place: name }), 'success');
      }
    });
  });
}
