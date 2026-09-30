/**
 * Finds completed objectives, completed quests and level-ups by comparing
 * snapshots. The first snapshot (and any snapshot after a save is loaded)
 * is only a baseline, so loading a save never floods the log.
 */
import type { SessionEvent } from './types';

export interface QuestSnapshotStep {
  index: number;
  text: string;
  completed: boolean;
}

export interface QuestSnapshotEntry {
  questFormId: string;
  name: string;
  isCompleted: boolean;
  steps: readonly QuestSnapshotStep[];
}

function isStep(v: unknown): v is QuestSnapshotStep {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof Reflect.get(v, 'index') === 'number' &&
    typeof Reflect.get(v, 'text') === 'string' &&
    typeof Reflect.get(v, 'completed') === 'boolean'
  );
}

function isQuestEntry(v: unknown): v is QuestSnapshotEntry {
  if (typeof v !== 'object' || v === null) return false;
  const steps: unknown = Reflect.get(v, 'steps');
  return (
    typeof Reflect.get(v, 'questFormId') === 'string' &&
    typeof Reflect.get(v, 'name') === 'string' &&
    Array.isArray(steps) &&
    steps.every(isStep)
  );
}

/** More changes than this at once = a different save was loaded. */
export const MAX_CHANGES_PER_UPDATE = 4;

interface QuestState {
  completed: boolean;
  steps: Set<number>;
}

interface DiscoveryEntry {
  seq: number;
  name: string;
  type: string;
  worldspace: string;
  x: number;
  y: number;
}

function isDiscoveryEntry(v: unknown): v is DiscoveryEntry {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof Reflect.get(v, 'seq') === 'number' &&
    typeof Reflect.get(v, 'name') === 'string'
  );
}

export class ProgressTracker {
  private quests: Map<string, QuestState> | null = null;
  private level: number | null = null;
  private discoverySeq: number | null = null;

  reset(): void {
    this.quests = null;
    this.level = null;
    this.discoverySeq = null;
  }

  /**
   * Player::Discoveries → new "Discovered: X" events. The first snapshot is
   * a baseline. A sequence number lower than the last one means the game
   * restarted (the plugin counter starts again), so it is a new baseline too.
   */
  updateDiscoveries(raw: unknown, t: number): SessionEvent[] {
    if (typeof raw !== 'object' || raw === null) return [];
    const seq: unknown = Reflect.get(raw, 'seq');
    const recent: unknown = Reflect.get(raw, 'recent');
    if (typeof seq !== 'number' || !Array.isArray(recent)) return [];
    const prev = this.discoverySeq;
    this.discoverySeq = seq;
    if (prev === null || seq < prev) return [];
    return recent
      .filter(isDiscoveryEntry)
      .filter((d) => d.seq > prev && d.name.trim())
      .map((d) => ({
        t,
        kind: 'discovery' as const,
        text: d.name.trim(),
        detail: typeof d.type === 'string' ? d.type : undefined,
        worldspace: typeof d.worldspace === 'string' && d.worldspace ? d.worldspace : undefined,
        x: typeof d.x === 'number' ? Math.round(d.x) : undefined,
        y: typeof d.y === 'number' ? Math.round(d.y) : undefined,
      }));
  }

  updateLevel(level: number | null | undefined, t: number): SessionEvent[] {
    if (typeof level !== 'number' || !Number.isFinite(level)) return [];
    const prev = this.level;
    this.level = level;
    if (prev === null || level <= prev) return [];
    // A jump of several levels at once is a save load, not play.
    if (level - prev > 2) return [];
    const events: SessionEvent[] = [];
    for (let l = prev + 1; l <= level; l++) events.push({ t, kind: 'level', text: String(l) });
    return events;
  }

  updateQuests(raw: unknown, t: number): SessionEvent[] {
    if (!Array.isArray(raw)) return [];
    const list: QuestSnapshotEntry[] = raw.filter(isQuestEntry);
    const next = new Map<string, QuestState>();
    for (const q of list) {
      const steps = new Set<number>();
      for (const s of q.steps) if (s.completed && s.text.trim()) steps.add(s.index);
      next.set(q.questFormId, { completed: !!q.isCompleted, steps });
    }

    const prev = this.quests;
    this.quests = next;
    if (!prev) return [];

    const events: SessionEvent[] = [];
    for (const q of list) {
      const before = prev.get(q.questFormId);
      const now = next.get(q.questFormId);
      if (!now) continue;
      for (const s of q.steps) {
        if (!now.steps.has(s.index)) continue;
        if (before?.steps.has(s.index)) continue;
        events.push({ t, kind: 'objective', text: s.text.trim(), detail: q.name });
      }
      if (now.completed && before && !before.completed) {
        events.push({ t, kind: 'quest', text: q.name });
      }
    }

    if (events.length > MAX_CHANGES_PER_UPDATE) return [];
    return events;
  }
}
