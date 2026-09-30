/**
 * Hero's path for one map: loads the stored chunks for the map's
 * worldspace, projects them to image pixels once, and serves SVG path data
 * at the detail level that fits the current zoom.
 *
 * Cost model: loading/projection happens only when the worldspace changes
 * or new chunks are saved (about every 256 points). Simplified levels are
 * built lazily and cached; zooming only switches between cached strings.
 */
import { computed, ref, shallowRef, watch, type Ref } from 'vue';
import { storeToRefs } from 'pinia';
import { journeyDb } from '@/stores/journey/lib/journeyDb';
import { chunkKey } from '@/stores/journey/lib/pathRecorder';
import { LOD_TOLERANCES, simplifyFlat, toPathData } from '@/stores/journey/lib/simplify';
import type { PathChunk } from '@/stores/journey/lib/types';
import { useJourneyStore } from '@/stores/journey/useJourneyStore';

type Project = (p: { x: number; y: number }) => { x: number; y: number } | null;

interface ProjectedLine {
  sessionId: number;
  points: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ImageRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function joinChunks(chunks: PathChunk[]): Array<{ sessionId: number; points: number[] }> {
  chunks.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const lines: Array<{ sessionId: number; segment: number; points: number[] }> = [];
  for (const c of chunks) {
    const last = lines[lines.length - 1];
    const pts = Array.from(c.points);
    if (last && last.sessionId === c.sessionId && last.segment === c.segment) {
      last.points.push(...pts.slice(2)); // first point repeats the previous chunk's last
    } else {
      lines.push({ sessionId: c.sessionId, segment: c.segment, points: pts });
    }
  }
  return lines;
}

function project(line: { sessionId: number; points: ArrayLike<number> }, fn: Project): ProjectedLine | null {
  const out: number[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < line.points.length; i += 2) {
    const p = fn({ x: line.points[i], y: line.points[i + 1] });
    if (!p) continue;
    out.push(p.x, p.y);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return out.length >= 4 ? { sessionId: line.sessionId, points: out, minX, minY, maxX, maxY } : null;
}

function intersects(line: ProjectedLine, rect: ImageRect | null): boolean {
  if (!rect) return true;
  return line.maxX >= rect.minX && line.minX <= rect.maxX && line.maxY >= rect.minY && line.minY <= rect.maxY;
}

export function useJourneyPath(worldspace: Ref<string | null>, projectFn: Ref<Project>) {
  const store = useJourneyStore();
  const { pathVersion, liveSegment } = storeToRefs(store);

  const stored = shallowRef<ProjectedLine[]>([]);
  const lodCache = new Map<number, ProjectedLine[]>();
  const loading = ref(false);
  let loadToken = 0;

  async function reload(): Promise<void> {
    const ws = worldspace.value;
    const token = ++loadToken;
    lodCache.clear();
    if (!ws) {
      stored.value = [];
      return;
    }
    loading.value = true;
    const chunks = await journeyDb.chunksForWorldspace(ws);
    if (token !== loadToken) return;
    const fn = projectFn.value;
    // The chunk being recorded is drawn from memory (it is newer than its
    // periodic save), so leave its stored copy out.
    const seg = liveSegment.value;
    const liveKey = seg ? chunkKey(seg.sessionId, seg.segment, seg.seq) : null;
    stored.value = joinChunks(chunks.filter((c) => c.key !== liveKey))
      .map((l) => project(l, fn))
      .filter((l): l is ProjectedLine => l !== null);
    lodCache.clear();
    loading.value = false;
  }

  watch([worldspace, projectFn, pathVersion], () => void reload(), { immediate: true });

  const live = computed<ProjectedLine | null>(() => {
    const seg = liveSegment.value;
    if (!seg || seg.worldspace !== worldspace.value) return null;
    return project({ sessionId: seg.sessionId, points: seg.points }, projectFn.value);
  });

  function linesAt(lod: number): ProjectedLine[] {
    // Touch the reactive source so callers re-run when data reloads.
    const base = stored.value;
    const cached = lodCache.get(lod);
    if (cached) return cached;
    const tol = LOD_TOLERANCES[lod] ?? LOD_TOLERANCES[0];
    const simplified = base.map((l) => ({ ...l, points: simplifyFlat(l.points, tol) }));
    lodCache.set(lod, simplified);
    return simplified;
  }

  /**
   * SVG path data split in two layers: `highlight` (the focus session, or
   * the running session) and `faded` (everything else). `rect` culls lines
   * outside the visible area (image px).
   */
  function pathData(
    lod: number,
    options: { highlightSession: number | null; onlyHighlight: boolean; rect?: ImageRect | null },
  ): { highlight: string; faded: string } {
    const hi: number[][] = [];
    const lo: number[][] = [];
    const tol = LOD_TOLERANCES[lod] ?? LOD_TOLERANCES[0];
    const all = [...linesAt(lod)];
    const l = live.value;
    if (l) all.push({ ...l, points: simplifyFlat(l.points, tol) });
    for (const line of all) {
      if (!intersects(line, options.rect ?? null)) continue;
      if (line.sessionId === options.highlightSession) hi.push(line.points);
      else if (!options.onlyHighlight) lo.push(line.points);
    }
    return { highlight: toPathData(hi), faded: toPathData(lo) };
  }

  return { pathData, stored, live, loading };
}
