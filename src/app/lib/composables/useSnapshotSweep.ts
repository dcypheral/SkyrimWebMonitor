/**
 * Fills the offline snapshot with the pages the player did not open this
 * session: one query per list, spaced out, a while after connecting and then
 * every few minutes. Steps wait while the game is not playable.
 */
import { onBeforeUnmount, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { getPageSubscriptions, pagesRegistry } from '@/app/config/pageRegistry';
import type { PageSubscriptionConfig } from '@/app/config/types';
import { DataRouter } from '@/stores/adapters/dataRouter';
import { useGameStatusStore } from '@/stores/game/useGameStatusStore';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';

const FIRST_SWEEP_MS = 30_000;
const SWEEP_EVERY_MS = 10 * 60_000;
/** Gap between two queries: one list per step keeps each frame cheap. */
const STEP_MS = 1500;
const PAUSED_RETRY_MS = 3000;
const TABS = ['inventory', 'magic', 'character', 'quests'];

/** Unique subscriptions of the browsable pages. */
export function sweepTargets(): PageSubscriptionConfig[] {
  const seen = new Set<string>();
  const out: PageSubscriptionConfig[] = [];
  for (const tab of TABS) {
    for (const subTab of Object.keys(pagesRegistry[tab] ?? {})) {
      for (const sub of getPageSubscriptions(tab, subTab)) {
        if (seen.has(sub.id)) continue;
        seen.add(sub.id);
        out.push(sub);
      }
    }
  }
  return out;
}

export function useSnapshotSweep(): void {
  const ws = useWebSocketStore();
  const { isConnected } = storeToRefs(ws);
  const { canAct } = storeToRefs(useGameStatusStore());

  let startTimer: ReturnType<typeof setTimeout> | null = null;
  let repeatTimer: ReturnType<typeof setInterval> | null = null;
  let stepTimer: ReturnType<typeof setTimeout> | null = null;
  let sweeping = false;

  function stop(): void {
    if (startTimer) clearTimeout(startTimer);
    if (repeatTimer) clearInterval(repeatTimer);
    if (stepTimer) clearTimeout(stepTimer);
    sweeping = false;
    startTimer = repeatTimer = stepTimer = null;
  }

  function sweep(): void {
    if (sweeping) return;
    sweeping = true;
    const targets = sweepTargets();
    let i = 0;
    const next = (): void => {
      stepTimer = null;
      if (i >= targets.length || !isConnected.value) {
        sweeping = false;
        return;
      }
      // In a menu, loading or paused: wait, do not skip.
      if (!canAct.value) {
        stepTimer = setTimeout(next, PAUSED_RETRY_MS);
        return;
      }
      const target = targets[i++];
      // Pages that are open have a live subscription with the same id.
      if (!ws.activeSubscriptions.has(target.id)) {
        ws.sendQuery(target.id, target.fields, (fields) => {
          DataRouter.routeDataById(target.id, fields);
        });
      }
      stepTimer = setTimeout(next, STEP_MS);
    };
    next();
  }

  watch(
    isConnected,
    (connected) => {
      stop();
      if (!connected) return;
      startTimer = setTimeout(sweep, FIRST_SWEEP_MS);
      repeatTimer = setInterval(sweep, SWEEP_EVERY_MS);
    },
    { immediate: true },
  );

  onBeforeUnmount(stop);
}
