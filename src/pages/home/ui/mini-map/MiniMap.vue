<template>
  <div
    ref="root"
    class="minimap"
    :class="{ 'minimap--pinned': isPinned && !showLocal, 'minimap--empty': !hasView && !showLocal, 'minimap--local': showLocal }"
  >
    <button
      type="button"
      class="minimap__surface"
      :aria-label="t('pages.home.mapOpen')"
      @click="emit('open')"
    >
      <local-map-canvas
        v-if="showLocal && localGeometry && localCenter"
        :geometry="localGeometry"
        :center="localCenter"
        :units-per-px="LOCAL_ZOOM_STEPS[zoomIndex]"
        :width="viewWidth"
        :height="viewHeight"
      />
      <div
        v-else-if="hasView"
        class="minimap__tiles"
        :style="tilesStyle"
      >
        <img
          v-for="tile in tiles"
          :key="tile.key"
          :src="tile.url"
          class="minimap__tile"
          :style="{
            left: `${tile.left}px`,
            top: `${tile.top}px`,
            width: `${tile.width}px`,
            height: `${tile.height}px`,
          }"
          alt=""
          draggable="false"
        >
      </div>

      <svg
        v-if="hasView || showLocal"
        class="minimap__overlay"
        :viewBox="`0 0 ${viewWidth} ${viewHeight}`"
        aria-hidden="true"
      >
        <g
          v-if="pathLayer && !showLocal"
          class="minimap__journey"
          :transform="pathTransform"
        >
          <path
            v-if="pathLayer.faded"
            class="minimap__trail minimap__trail--faded"
            :d="pathLayer.faded"
          />
          <path
            v-if="pathLayer.highlight"
            class="minimap__trail"
            :d="pathLayer.highlight"
          />
        </g>
        <g
          v-for="pin in showLocal ? [] : notePins"
          :key="pin.id"
          class="minimap__note"
          :transform="`translate(${pin.x} ${pin.y})`"
        >
          <path d="M0 0 L-5 -8 A6 6 0 1 1 5 -8 Z" />
          <circle
            cx="0"
            cy="-11"
            r="2.2"
          />
        </g>
        <g
          v-for="marker in showLocal ? localQuestMarkers : questMarkers"
          :key="marker.key"
          :transform="`translate(${marker.x} ${marker.y})`"
        >
          <g
            v-if="marker.offscreen"
            :transform="`rotate(${marker.bearingDeg})`"
          >
            <path
              class="minimap__chevron"
              d="M0 -9 L6 1 L0 -2 L-6 1 Z"
            />
          </g>
          <rect
            v-else
            class="minimap__quest"
            x="-5"
            y="-5"
            width="10"
            height="10"
            transform="rotate(45)"
          />
        </g>

        <g :transform="`translate(${viewWidth / 2} ${viewHeight / 2}) rotate(${playerAngleDeg})`">
          <circle
            class="minimap__player-halo"
            r="14"
          />
          <path
            class="minimap__player"
            d="M0 -11 L7 8 L0 4 L-7 8 Z"
          />
        </g>
      </svg>

      <span
        v-if="!hasView && !showLocal"
        class="minimap__message"
      >{{ t('pages.home.mapNoArea') }}</span>
    </button>

    <span
      class="minimap__north"
      aria-hidden="true"
    >{{ t('pages.home.north') }}</span>

    <span
      v-if="showLocal && localGeometry?.name"
      class="minimap__place"
    >{{ localGeometry.name }}</span>
    <span
      v-else-if="isPinned && placeName"
      class="minimap__place"
    >{{ t('pages.home.mapInterior', { place: placeName }) }}</span>

    <button
      v-if="localApplies"
      type="button"
      class="minimap__mode"
      :aria-pressed="homeMapMode === 'auto'"
      :aria-label="showLocal ? t('pages.home.mapShowWorld') : t('pages.home.mapShowLocal')"
      @click="toggleMode"
    >
      {{ showLocal ? t('pages.home.mapLocal') : t('pages.home.mapWorld') }}
    </button>

    <button
      type="button"
      class="minimap__add-note"
      :aria-label="t('pages.journal.newNote')"
      @click="noteActions.openNewNote()"
    >
      <base-icon
        icon-path="lorc/quill-ink.svg"
        :size="17"
        background-color="var(--skyrim-text-primary)"
      />
    </button>

    <button
      v-if="hasView || showLocal"
      type="button"
      class="minimap__zoom"
      :aria-label="zoomIndex === 0 ? t('pages.home.mapZoomOut') : t('pages.home.mapZoomIn')"
      @click="toggleZoom"
    >
      {{ zoomIndex === 0 ? '−' : '+' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { i18n } from '@/i18n';
import {
  createMapProjection,
  getMapConfig,
  loadDziInfo,
  mapTileBlobUrls,
  type DziInfo,
} from '@/pages/map';
import { useMapPlayerStore } from '@/stores/map/useMapPlayerStore';
import { BaseIcon } from '@/shared/ui';
import { journeyLayers } from '@/shared/lib/settings/journeyLayers';
import { pickLod } from '@/stores/journey/lib/simplify';
import { useJourneyStore } from '@/stores/journey/useJourneyStore';
import { useJourneyPath, useNoteActions } from '@/features/journey';
import { useMapHotspotsStore } from '@/stores/map/useMapHotspotsStore';
import { levelGeometry, maxDziLevel, placeInView, visibleTiles } from '../../lib/minimapTiles';
import { homeMapMode, persistHomeMapMode } from '@/shared/lib/settings/homeMapPreference';
import { localAreaKey } from '@/stores/map/lib/localMap';
import { useLocalMapStore } from '@/stores/map/useLocalMapStore';
import LocalMapCanvas from '../local-map/LocalMapCanvas.vue';

const emit = defineEmits<{ open: [] }>();
const { t } = useI18n();

/** Full-resolution map pixels per CSS pixel for each zoom step (near, far). */
const ZOOM_STEPS = [2, 4.5];
const ZOOM_STORAGE_KEY = 'skyrim-monitor-minimap-zoom';
/** Local map: world units per CSS pixel for each zoom step (near, far). */
const LOCAL_ZOOM_STEPS = [5, 11];
const MARKER_MARGIN = 12;

const root = ref<HTMLElement | null>(null);
const viewWidth = ref(0);
const viewHeight = ref(0);
const dziInfo = shallowRef<DziInfo | null>(null);
const zoomIndex = ref(readZoom());

const playerStore = useMapPlayerStore();
const { position, displayPosition } = storeToRefs(playerStore);
const { questMarkers: rawQuestMarkers } = storeToRefs(useMapHotspotsStore());

const mapConfig = computed(() =>
  getMapConfig(position.value?.parentWorldspace ?? null, i18n.global.locale.value),
);
const projection = computed(() => createMapProjection(mapConfig.value));

// Keep the shared player store resolving interiors against this map.
watch(
  () => mapConfig.value.worldspace,
  (ws) => playerStore.setCurrentMapWorldspace(ws),
  { immediate: true },
);

watch(
  () => mapConfig.value.dziUrl,
  async (url) => {
    dziInfo.value = null;
    dziInfo.value = await loadDziInfo(url);
  },
  { immediate: true },
);

const center = computed(() => {
  const dp = displayPosition.value;
  if (!dp) return null;
  return projection.value.projectWorldToImage({ x: dp.x, y: dp.y });
});

const isPinned = computed(() => displayPosition.value?.pinned ?? false);
const placeName = computed(() => position.value?.cellName || position.value?.cell || null);
const playerAngleDeg = computed(() => ((displayPosition.value?.angle ?? 0) * 180) / Math.PI);

/**
 * Pick the pyramid level whose pixel density best matches the screen, then
 * scale the tile layer down to CSS pixels. Sharp on high-DPI handhelds.
 */
const level = computed(() => {
  const info = dziInfo.value;
  if (!info) return null;
  const imagePxPerCss = ZOOM_STEPS[zoomIndex.value];
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
  const maxLevel = maxDziLevel(info);
  const wanted = maxLevel + Math.ceil(Math.log2(dpr / imagePxPerCss));
  const geometry = levelGeometry(info, wanted);
  // Level pixels per CSS pixel after choosing the (integer) level.
  const levelPxPerCss = geometry.scale * imagePxPerCss;
  return { geometry, levelPxPerCss };
});

const hasView = computed(
  () => !!center.value && !!level.value && viewWidth.value > 0 && viewHeight.value > 0,
);

const tiles = computed(() => {
  const info = dziInfo.value;
  const c = center.value;
  const l = level.value;
  if (!info || !c || !l) return [];
  return visibleTiles(
    info,
    l.geometry,
    c.x,
    c.y,
    viewWidth.value * l.levelPxPerCss,
    viewHeight.value * l.levelPxPerCss,
    (url) => mapTileBlobUrls.get(url) ?? url,
  );
});

const tilesStyle = computed(() => {
  const l = level.value;
  if (!l) return {};
  return {
    width: `${viewWidth.value * l.levelPxPerCss}px`,
    height: `${viewHeight.value * l.levelPxPerCss}px`,
    transform: `scale(${1 / l.levelPxPerCss})`,
  };
});

const questMarkers = computed(() => {
  const c = center.value;
  if (!c) return [];
  const imagePxPerCss = ZOOM_STEPS[zoomIndex.value];
  const worldspace = mapConfig.value.worldspace;
  const seen = new Set<string>();
  const out: Array<{ key: string; x: number; y: number; offscreen: boolean; bearingDeg: number }> = [];
  for (const marker of rawQuestMarkers.value) {
    if (marker.parentWorldspace !== worldspace) continue;
    if (!Number.isFinite(marker.x) || !Number.isFinite(marker.y)) continue;
    const key = `${marker.questFormId}:${marker.refId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = projection.value.projectWorldToImage({ x: marker.x, y: marker.y });
    if (!p) continue;
    const placed = placeInView(
      p.x,
      p.y,
      c.x,
      c.y,
      1 / imagePxPerCss,
      viewWidth.value,
      viewHeight.value,
      MARKER_MARGIN,
    );
    out.push({
      key,
      x: placed.x,
      y: placed.y,
      offscreen: placed.offscreen,
      bearingDeg: (placed.bearing * 180) / Math.PI,
    });
  }
  return out;
});

// ─── Local map (interiors and cities) ───────────────────────────────────

const localMap = useLocalMapStore();
const { geometry: localGeometry, loadedKey: localLoadedKey } = storeToRefs(localMap);

/** Inside, or in a city worldspace (Whiterun, Solitude, …). */
const localApplies = computed(() => {
  const p = position.value;
  if (!p || !localMap.isAvailable()) return false;
  return p.isInterior || (!!p.worldspace && !!p.parentWorldspace && p.worldspace !== p.parentWorldspace);
});

const wantsLocal = computed(() => homeMapMode.value === 'auto' && localApplies.value);

watch(
  [wantsLocal, position],
  ([wanted, p]) => {
    if (wanted && p) localMap.update(p);
  },
  { immediate: true },
);

/** Show the floor plan only when it belongs to where the player is. */
const showLocal = computed(() => {
  const g = localGeometry.value;
  const p = position.value;
  if (!wantsLocal.value || !g || !p) return false;
  if (localLoadedKey.value === localAreaKey(p)) return true;
  // Outside, the neighbouring cells overlap: keep the old plan while the next loads.
  return !g.isInterior && !p.isInterior && (localLoadedKey.value ?? '').startsWith(`w:${p.worldspaceFormId ?? ''}:`);
});

const localCenter = computed(() => {
  const p = position.value;
  return p ? { x: p.x, y: p.y, z: p.z } : null;
});

const localQuestMarkers = computed(() => {
  const p = position.value;
  if (!showLocal.value || !p) return [];
  const k = LOCAL_ZOOM_STEPS[zoomIndex.value];
  const seen = new Set<string>();
  const out: Array<{ key: string; x: number; y: number; offscreen: boolean; bearingDeg: number }> = [];
  for (const m of rawQuestMarkers.value) {
    const lx = m.localX;
    const ly = m.localY;
    if (typeof lx !== 'number' || typeof ly !== 'number') continue;
    const same = p.isInterior
      ? m.localCellFormId === p.cellFormId
      : !m.localIsInterior && m.localWorldspaceFormId === p.worldspaceFormId;
    if (!same) continue;
    const key = `${m.questFormId}:${m.refId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Screen y grows downwards, world y northwards.
    const placed = placeInView(lx, -ly, p.x, -p.y, 1 / k, viewWidth.value, viewHeight.value, MARKER_MARGIN);
    out.push({ key, x: placed.x, y: placed.y, offscreen: placed.offscreen, bearingDeg: (placed.bearing * 180) / Math.PI });
  }
  return out;
});

function toggleMode(): void {
  persistHomeMapMode(homeMapMode.value === 'auto' ? 'world' : 'auto');
}

// ─── Hero's path and notes ──────────────────────────────────────────────

const journey = useJourneyStore();
const noteActions = useNoteActions();
const journeyWorldspace = computed<string | null>(() => mapConfig.value.worldspace);
const projectFn = computed(() => projection.value.projectWorldToImage);
const journeyPath = useJourneyPath(journeyWorldspace, projectFn);

/** Image → view transform; the path itself stays in image pixels. */
const pathTransform = computed(() => {
  const c = center.value;
  if (!c) return '';
  const k = ZOOM_STEPS[zoomIndex.value];
  return `translate(${viewWidth.value / 2} ${viewHeight.value / 2}) scale(${1 / k}) translate(${-c.x} ${-c.y})`;
});

/**
 * Culling rectangle snapped to a coarse grid, so the path data is rebuilt
 * only when the player moves a quarter screen, not on every position tick.
 */
const cullRect = computed(() => {
  const c = center.value;
  if (!c) return null;
  const k = ZOOM_STEPS[zoomIndex.value];
  const halfW = viewWidth.value * k;
  const halfH = viewHeight.value * k;
  const grid = Math.max(halfW, halfH) / 2 || 1;
  const gx = Math.round(c.x / grid) * grid;
  const gy = Math.round(c.y / grid) * grid;
  return { minX: gx - halfW, minY: gy - halfH, maxX: gx + halfW, maxY: gy + halfH };
});

const cullKey = computed(() => {
  const r = cullRect.value;
  return r ? `${r.minX}|${r.minY}|${zoomIndex.value}` : '';
});

const pathLayer = computed(() => {
  if (!journeyLayers.path || !cullKey.value) return null;
  const data = journeyPath.pathData(pickLod(ZOOM_STEPS[zoomIndex.value]), {
    highlightSession: journey.activeSessionId,
    onlyHighlight: !journeyLayers.allSessions,
    rect: cullRect.value,
  });
  return data.highlight || data.faded ? data : null;
});

const notePins = computed(() => {
  const c = center.value;
  if (!journeyLayers.notes || !c) return [];
  const k = ZOOM_STEPS[zoomIndex.value];
  const ws = mapConfig.value.worldspace;
  const out: Array<{ id: number; x: number; y: number }> = [];
  for (const note of journey.notes) {
    if (note.worldspace !== ws) continue;
    const p = projection.value.projectWorldToImage({ x: note.x, y: note.y });
    if (!p) continue;
    const x = (p.x - c.x) / k + viewWidth.value / 2;
    const y = (p.y - c.y) / k + viewHeight.value / 2;
    if (x < -8 || y < -8 || x > viewWidth.value + 8 || y > viewHeight.value + 20) continue;
    out.push({ id: note.id, x, y });
  }
  return out;
});

function toggleZoom(): void {
  zoomIndex.value = zoomIndex.value === 0 ? 1 : 0;
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomIndex.value));
  } catch {
    /* localStorage can be unavailable in restricted WebViews */
  }
}

function readZoom(): number {
  try {
    return localStorage.getItem(ZOOM_STORAGE_KEY) === '1' ? 1 : 0;
  } catch {
    return 0;
  }
}

let resizeObserver: ResizeObserver | null = null;

function measure(): void {
  if (!root.value) return;
  viewWidth.value = root.value.clientWidth;
  viewHeight.value = root.value.clientHeight;
}

onMounted(() => {
  measure();
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root.value);
  }
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<style scoped lang="scss">
.minimap {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #16140f;
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 60%), var(--shadow-soft);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / 55%) 100%);
    border-radius: inherit;
  }
}

.minimap__surface {
  position: absolute;
  inset: 0;
  display: block;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  touch-action: manipulation;
}

.minimap__tiles {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  filter: saturate(0.85) brightness(0.9);
  transition: filter var(--transition-normal);

  .minimap--pinned & {
    filter: saturate(0.4) brightness(0.55);
  }
}

.minimap__tile {
  position: absolute;
  max-width: none;
  user-select: none;
  pointer-events: none;
}

.minimap__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.minimap__player-halo {
  fill: rgb(0 0 0 / 35%);
}

.minimap__player {
  fill: var(--skyrim-text-accent);
  stroke: #111;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.minimap__quest {
  fill: var(--skyrim-accent-main);
  stroke: #111;
  stroke-width: 1.5;
}

.minimap__chevron {
  fill: var(--skyrim-accent-main);
  stroke: #111;
  stroke-width: 1;
}

.minimap__north {
  position: absolute;
  top: 4px;
  left: 50%;
  z-index: 1;
  font-family: var(--font-heading);
  font-size: 0.7rem;
  color: var(--skyrim-text-accent);
  text-shadow: 0 1px 2px #000;
  transform: translateX(-50%);
  pointer-events: none;
}

.minimap__place {
  position: absolute;
  top: 22px;
  left: 50%;
  z-index: 1;
  max-width: 90%;
  overflow: hidden;
  padding: 2px 8px;
  background: rgb(0 0 0 / 60%);
  border-radius: 999px;
  font-family: var(--font-heading);
  font-size: 0.68rem;
  color: var(--skyrim-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}

.minimap__message {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
  font-family: var(--font-heading);
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-dim);
  text-align: center;
}

.minimap__journey {
  pointer-events: none;
}

.minimap__trail {
  fill: none;
  stroke: #f0c060;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 5 4;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 0 1px rgb(0 0 0 / 90%));

  &--faded {
    stroke: #c9a15a;
    stroke-width: 1.6;
    opacity: 0.55;
  }
}

.minimap__note {
  path {
    fill: #f2e6c4;
    stroke: #2a2112;
    stroke-width: 1.2;
  }

  circle {
    fill: #2a2112;
  }
}

.minimap__add-note {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: rgb(0 0 0 / 55%);
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: 50%;
  cursor: pointer;
  touch-action: manipulation;
}

.minimap--local .minimap__player-halo {
  fill: rgb(0 0 0 / 55%);
}

.minimap__mode {
  position: absolute;
  top: 44px;
  right: 6px;
  z-index: 2;
  min-width: 44px;
  height: 26px;
  padding: 0 8px;
  background: rgb(0 0 0 / 60%);
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: 999px;
  color: var(--skyrim-text-secondary);
  font-family: var(--font-heading);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  touch-action: manipulation;

  .minimap--local & {
    border-color: var(--skyrim-accent-main);
    color: var(--skyrim-accent-main);
  }
}

.minimap__zoom {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 32px;
  height: 32px;
  background: rgb(0 0 0 / 55%);
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: 50%;
  color: var(--skyrim-text-primary);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
}
</style>
