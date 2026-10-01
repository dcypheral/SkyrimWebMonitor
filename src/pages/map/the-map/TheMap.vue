<template>
  <div class="map-outer">
    <div class="map-page">
      <div
        ref="osdContainerRef"
        class="osd-host"
      />
      <map-markers
        v-if="imgNaturalW && imgNaturalH"
        ref="markersRef"
        class="map-overlay"
        :img-natural-w="imgNaturalW"
        :img-natural-h="imgNaturalH"
        :scale="markerScale"
        :cover-scale="coverScale"
        :overlay-style="OVERLAY_STYLE"
        :project-world-to-image="projectWorldToImage"
        :current-worldspace="currentMapWorldspace"
      />
      <!-- Torn paper edge, drawn once on top instead of masking the moving map. -->
      <div
        class="map-frame"
        aria-hidden="true"
      />
      <div class="map-layer-controls">
        <button
          type="button"
          class="map-ctrl"
          :class="{ 'is-active': journeyLayers.path }"
          :aria-pressed="journeyLayers.path"
          :aria-label="$t('pages.journal.layerPath')"
          @click="journeyLayers.path = !journeyLayers.path"
        >
          <base-icon
            icon-path="delapouite/trail.svg"
            :size="18"
            :background-color="journeyLayers.path ? '#f3c45e' : 'var(--skyrim-text-dim)'"
          />
        </button>
        <button
          type="button"
          class="map-ctrl"
          :class="{ 'is-active': journeyLayers.notes }"
          :aria-pressed="journeyLayers.notes"
          :aria-label="$t('pages.journal.layerNotes')"
          @click="journeyLayers.notes = !journeyLayers.notes"
        >
          <base-icon
            icon-path="lorc/quill-ink.svg"
            :size="18"
            :background-color="journeyLayers.notes ? '#f2e6c4' : 'var(--skyrim-text-dim)'"
          />
        </button>
      </div>
      <div
        v-if="focusSession"
        class="map-focus-chip"
      >
        <span>{{ focusSessionLabel }}</span>
        <button
          type="button"
          :aria-label="$t('pages.journal.clearFocus')"
          @click="journeyLayers.focusSessionId = null"
        >
          ×
        </button>
      </div>
      <div class="map-zoom-controls">
        <button
          type="button"
          class="map-ctrl"
          :aria-label="$t('pages.home.mapZoomIn')"
          @click="zoomBy(ZOOM_BUTTON_STEP)"
        >
          +
        </button>
        <button
          type="button"
          class="map-ctrl"
          :aria-label="$t('pages.home.mapZoomOut')"
          @click="zoomBy(1 / ZOOM_BUTTON_STEP)"
        >
          −
        </button>
      </div>
      <button
        type="button"
        class="map-follow-player-btn"
        :class="{ 'is-active': isFollowPlayerMode }"
        :aria-pressed="isFollowPlayerMode"
        @click="toggleFollowPlayerMode"
      >
        <base-icon
          icon-path="map/player.svg"
          :background-color="isFollowPlayerMode ? 'var(--skyrim-accent-main-light)' : 'var(--skyrim-text-dim)' "
        />
      </button>
      <Transition
        name="map-prefetch-backdrop"
        appear
      >
        <div
          v-if="isPrefetching"
          class="skyrim-backdrop skyrim-backdrop--absolute skyrim-backdrop--dim skyrim-backdrop--blocking map-prefetch-backdrop"
          style="--skyrim-backdrop-z: 5; --skyrim-backdrop-blur: 2px"
          role="status"
          aria-live="polite"
        >
          <div class="map-prefetch-backdrop__panel">
            <span class="map-prefetch-backdrop__label">
              {{ $t('pages.map.prefetch.label') }}
            </span>
            <div
              class="map-prefetch-backdrop__bar"
              :style="{ '--p': `${prefetchProgress}%` }"
            />
            <span class="map-prefetch-backdrop__pct">
              {{ $t('pages.map.prefetch.progress', { progress: prefetchProgress }) }}
            </span>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type StyleValue } from 'vue';
import { storeToRefs } from 'pinia';
import {
  loadDziInfo,
  prefetchMapTiles,
  mapTileBlobUrls,
  mapTilesPrefetchActive,
  mapTilesPrefetchProgress,
} from '../preloadMap';
import MapMarkers from '../map-markers/MapMarkers.vue';
import { BaseIcon } from '@/shared/ui';
import { useMapProjection, type MapProjectionFn } from '../composables/useMapProjection';
import { useMapPlayerStore } from '@/stores/map/useMapPlayerStore';
import { i18n } from '@/i18n';
import { getMapConfig } from '../config/mapRegistry';
import type { MapConfig } from '../config/lib/types';
import { logger } from '@/shared/lib/utils/logger';
import { journeyLayers } from '@/shared/lib/settings/journeyLayers';
import { mapFocusRequest } from '@/stores/journey/mapFocus';
import { useJourneyStore } from '@/stores/journey/useJourneyStore';
import { DziLeafletMap } from '../lib/dziLeafletMap';

// =============================================================
// Map view configuration
// =============================================================

/*
to generate tiles use command

vips dzsave public/maps/<name>.png public/map-dzi/<name> \
  --layout dz \
  --tile-size 512 \
  --overlap 1 \
  --suffix '.webp[Q=80]'
*/
/** Initial zoom factor relative to the "cover" zoom. */
const INITIAL_ZOOM_FACTOR = 2.5;
/**
 * Deepest zoom: screen pixels per map image pixel. Past 1 the tiles are
 * upscaled (softer), which is fine for reading paths and pins up close.
 */
const MAX_ZOOM_PIXEL_RATIO = 4;
/** Zoom step of the +/− buttons (factor). */
const ZOOM_BUTTON_STEP = 1.8;
/** Zoom used when jumping to a note ("Show on map"), relative to cover. */
const FOCUS_ZOOM_FACTOR = 8;
/** Background color around the map. */
const BACKGROUND_COLOR = 'var(--skyrim-bg-medium)';
/** Leaflet positions the marker SVG itself; Vue must not set its style. */
const OVERLAY_STYLE: StyleValue = {};
/** Wait this long after a zoom before re-laying out the markers. */
const MARKER_RELAYOUT_DELAY_MS = 120;

// =============================================================
// Torn-paper edge effect
// =============================================================

const TEAR_VIEWBOX = 400;
const TEAR_INSET = 5;
const TEAR_BASE_FREQUENCY = 0.045;
const TEAR_OCTAVES = 2;
const TEAR_DISPLACEMENT = 32;
const TEAR_SEED = 4;

const TEAR_MASK_URL = (() => {
  const inner = TEAR_VIEWBOX - 2 * TEAR_INSET;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${TEAR_VIEWBOX} ${TEAR_VIEWBOX}' preserveAspectRatio='none'>` +
    `<filter id='t' x='-20%' y='-20%' width='140%' height='140%'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='${TEAR_BASE_FREQUENCY}' numOctaves='${TEAR_OCTAVES}' seed='${TEAR_SEED}' result='n'/>` +
    `<feDisplacementMap in='SourceGraphic' in2='n' scale='${TEAR_DISPLACEMENT}'/>` +
    `</filter>` +
    `<rect x='${TEAR_INSET}' y='${TEAR_INSET}' width='${inner}' height='${inner}' fill='white' filter='url(#t)'/>` +
    `</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
})();

// =============================================================
// State
// =============================================================

const osdContainerRef = ref<HTMLElement | null>(null);
const markersRef = ref<InstanceType<typeof MapMarkers> | null>(null);

const imgNaturalW = ref(0);
const imgNaturalH = ref(0);

/**
 * CSS px per image px the markers are sized for. Updated when a zoom or
 * move settles; during a pinch the whole marker layer scales with the map.
 */
const markerScale = ref(0);
const coverScale = ref(1);
const isFollowPlayerMode = ref(false);

const playerStore = useMapPlayerStore();
const { displayPosition, position } = storeToRefs(playerStore);

/**
 * Resolve the active map config from the player's current worldspace.
 * Falls back to Tamriel when the worldspace is unknown or null.
 */
const currentWorldspace = computed(() => position.value?.parentWorldspace ?? null);
const mapConfig = computed<MapConfig>(() =>
  getMapConfig(currentWorldspace.value, i18n.global.locale.value),
);

/** The effective worldspace of the displayed map (never null). */
const currentMapWorldspace = computed<string>(() => mapConfig.value.worldspace);

/** Per-map projection engine, re-created when the map config changes. */
const projection = computed(() => useMapProjection(mapConfig.value));
const projectWorldToImage = computed<MapProjectionFn>(() => projection.value.projectWorldToImage);

/** Whether tile prefetch is still in progress (used to show a backdrop). */
const isPrefetching = mapTilesPrefetchActive;
/** 0..100 — how many tiles have been cached so far. */
const prefetchProgress = mapTilesPrefetchProgress;

// =============================================================
// Map engine
// =============================================================

let view: DziLeafletMap | null = null;
let setupToken = 0;

let relayoutTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Re-lays out the markers for the new zoom. Debounced: during repeated
 * zooms (button taps, a long pinch) the marker layer simply scales with the
 * map and is laid out once at the end — that re-layout is the only costly
 * step of a zoom.
 */
function onViewChange(scale: number): void {
  if (!view) return;
  const cover = view.coverScale();
  if (Math.abs(coverScale.value - cover) > 1e-9) coverScale.value = cover;
  if (Math.abs(markerScale.value - scale) <= 1e-9) return;
  if (markerScale.value === 0) {
    markerScale.value = scale;
    return;
  }
  if (relayoutTimer) clearTimeout(relayoutTimer);
  relayoutTimer = setTimeout(() => {
    relayoutTimer = null;
    if (view) markerScale.value = view.scale();
  }, MARKER_RELAYOUT_DELAY_MS);
}

function playerImagePoint(): { x: number; y: number } | null {
  const dp = displayPosition.value;
  return dp ? projectWorldToImage.value(dp) : null;
}

function centerOnPlayer(animate = true): void {
  if (!view || !isFollowPlayerMode.value) return;
  const p = playerImagePoint();
  if (p) view.panTo(p.x, p.y, animate);
}

function stopFollowPlayerByUser(): void {
  if (!isFollowPlayerMode.value) return;
  isFollowPlayerMode.value = false;
}

function toggleFollowPlayerMode(): void {
  isFollowPlayerMode.value = !isFollowPlayerMode.value;
  if (isFollowPlayerMode.value) centerOnPlayer(true);
}

function zoomBy(factor: number): void {
  if (!view) return;
  stopFollowPlayerByUser();
  view.zoomBy(Math.log2(factor));
}

/** Center on world coordinates and zoom in (note "Show on map"). */
function focusWorldPoint(x: number, y: number): boolean {
  if (!view) return false;
  const p = projectWorldToImage.value({ x, y });
  if (!p) return false;
  isFollowPlayerMode.value = false;
  view.setView(p.x, p.y, view.coverScale() * FOCUS_ZOOM_FACTOR);
  return true;
}

/** Zoom to show a whole session's path. */
function fitSession(sessionId: number): boolean {
  if (!view) return false;
  const box = markersRef.value?.sessionBounds(sessionId);
  if (!box) return false;
  isFollowPlayerMode.value = false;
  const pad = Math.max(box.maxX - box.minX, box.maxY - box.minY) * 0.15 + 40;
  view.fitImageRect(box.minX - pad, box.minY - pad, box.maxX + pad, box.maxY + pad);
  return true;
}

function applyPendingFocus(): void {
  const req = mapFocusRequest.value;
  if (req && req.worldspace === currentMapWorldspace.value && focusWorldPoint(req.x, req.y)) {
    mapFocusRequest.value = null;
    return;
  }
  const sessionId = journeyLayers.focusSessionId;
  if (sessionId !== null && pendingSessionFit) {
    // The path loads asynchronously; retry briefly until it is there.
    if (fitSession(sessionId)) pendingSessionFit = false;
    else setTimeout(applyPendingFocus, 250);
  }
}

let pendingSessionFit = journeyLayers.focusSessionId !== null;

const journeyStore = useJourneyStore();
const focusSession = computed(() =>
  journeyLayers.focusSessionId === null
    ? null
    : (journeyStore.sessions.find((s) => s.id === journeyLayers.focusSessionId) ?? null),
);
const focusSessionLabel = computed(() => {
  const s = focusSession.value;
  if (!s) return '';
  return s.title || new Date(s.startedAt).toLocaleDateString(i18n.global.locale.value, { month: 'short', day: 'numeric' });
});

async function setupViewer(): Promise<void> {
  const token = ++setupToken;
  const host = osdContainerRef.value;
  if (!host) return;
  const config = mapConfig.value;
  const info = await loadDziInfo(config.dziUrl);
  if (!info || token !== setupToken || !osdContainerRef.value) return;

  void prefetchMapTiles(config.dziUrl);

  view = new DziLeafletMap(host, {
    info,
    crop: { cropX: config.cropX, cropYTop: config.cropYTop, cropYBottom: config.cropYBottom },
    resolveTileUrl: (url) => mapTileBlobUrls.get(url) ?? url,
    maxPixelRatio: MAX_ZOOM_PIXEL_RATIO,
    onClick: (x, y) => {
      // First let the marker overlay try to handle the tap (selection /
      // fast-travel). Only deselect when the tap landed on empty map area.
      const hit = markersRef.value?.handleClickAt(x, y) ?? false;
      if (!hit) markersRef.value?.clearSelection();
      logger.log(`[map] image px: { x: ${x.toFixed(2)}, y: ${y.toFixed(2)} }`);
    },
    onViewChange,
    onUserGesture: stopFollowPlayerByUser,
  });

  // Initial view: centred on the player (or the map), zoomed past "cover".
  const cover = view.coverScale();
  const p = playerImagePoint();
  const cx = p?.x ?? info.width / 2;
  const cy = p?.y ?? (config.cropYTop + (info.height - config.cropYBottom)) / 2;
  view.setView(cx, cy, cover * INITIAL_ZOOM_FACTOR);

  imgNaturalW.value = info.width;
  imgNaturalH.value = info.height;
  onViewChange(view.scale());

  // The marker SVG renders once the image size is known; hand it to Leaflet.
  await nextTick();
  const svg: unknown = markersRef.value?.$el;
  if (view && svg instanceof SVGSVGElement) view.attachOverlay(svg);
  applyPendingFocus();
}

function destroyViewer(): void {
  setupToken++;
  if (relayoutTimer) clearTimeout(relayoutTimer);
  relayoutTimer = null;
  view?.destroy();
  view = null;
  imgNaturalW.value = 0;
  imgNaturalH.value = 0;
  markerScale.value = 0;
}

// =============================================================
// Lifecycle
// =============================================================

onMounted(() => {
  void setupViewer();
});

watch(displayPosition, () => {
  centerOnPlayer(true);
});

watch(mapFocusRequest, () => applyPendingFocus());
watch(
  () => journeyLayers.focusSessionId,
  (id) => {
    pendingSessionFit = id !== null;
    applyPendingFocus();
  },
);

/**
 * When the player crosses a worldspace boundary, rebuild the map for the
 * new world.
 */
watch(currentWorldspace, (next, prev) => {
  if (next !== prev) {
    destroyViewer();
    void setupViewer();
  }
});

/**
 * Keep the player store's currentMapWorldspace in sync with the active map
 * config, so position-renderability checks use the right worldspace.
 */
watch(mapConfig, (config) => {
  playerStore.setCurrentMapWorldspace(config.worldspace);
}, { immediate: true });

onBeforeUnmount(() => {
  destroyViewer();
  // Note: blob URLs in the shared `mapTileBlobUrls` cache are intentionally
  // NOT revoked here. They live for the lifetime of the page so that
  // re-entering the Map tab is instant.
});
</script>

<style scoped lang="scss">
.map-outer {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  background-color: v-bind(BACKGROUND_COLOR);
}

.map-page {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background-color: v-bind(BACKGROUND_COLOR);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.osd-host {
  position: absolute;
  inset: 0;

  /* Own stacking context: Leaflet's panes use z-index 200–700 and would
     otherwise cover the frame and the controls. */
  z-index: 0;
  isolation: isolate;
}

/*
 * The torn edge used to be a mask on .map-page, which made the browser
 * re-composite the mask with the moving map on every frame. This static
 * frame covers the same edge area (inverse of the paper shape) and never
 * changes, so it is drawn once.
 */
.map-frame {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background-color: v-bind(BACKGROUND_COLOR);
  -webkit-mask-image: linear-gradient(#000, #000), v-bind(TEAR_MASK_URL);
  mask-image: linear-gradient(#000, #000), v-bind(TEAR_MASK_URL);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  filter: drop-shadow(0 0 5px rgb(0 0 0 / 60%));
}

/* Leaflet container: no default grey, no tap highlight. */
.osd-host :deep(.leaflet-container),
.osd-host.leaflet-container {
  background: transparent;
  -webkit-tap-highlight-color: transparent;
}

.osd-host :deep(.map-svg-overlay) {
  pointer-events: none;
}

.map-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.map-follow-player-btn {
  position: absolute;
  right: calc(var(--spacing-md) + env(safe-area-inset-right));
  bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: 999px;
  background-color: var(--skyrim-bg-medium);
  box-shadow: var(--shadow-medium);
  color: var(--skyrim-text-secondary);
  cursor: pointer;
  transform: rotate(45deg);
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);

  &:active {
    transform: scale(0.96);
  }
}

.map-layer-controls,
.map-zoom-controls {
  position: absolute;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.map-layer-controls {
  top: calc(var(--spacing-md) + env(safe-area-inset-top));
  right: calc(var(--spacing-md) + env(safe-area-inset-right));
}

.map-zoom-controls {
  bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
  left: calc(var(--spacing-md) + env(safe-area-inset-left));
}

.map-ctrl {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  background-color: rgb(16 16 16 / 82%);
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: 999px;
  box-shadow: var(--shadow-medium);
  color: var(--skyrim-text-primary);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;

  &.is-active {
    border-color: var(--skyrim-border-accent);
  }

  &:active {
    transform: scale(0.95);
  }
}

.map-focus-chip {
  position: absolute;
  top: calc(var(--spacing-md) + env(safe-area-inset-top));
  left: 50%;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 60%;
  padding: 4px 4px 4px 12px;
  background: rgb(16 16 16 / 85%);
  border: var(--border-thin) solid #f3c45e;
  border-radius: 999px;
  font-family: var(--font-heading);
  font-size: var(--font-size-xs);
  color: #f3c45e;
  transform: translateX(-50%);

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    width: 26px;
    height: 26px;
    padding: 0;
    background: none;
    border: none;
    color: var(--skyrim-text-primary);
    font-size: 1rem;
    cursor: pointer;
  }
}

.map-prefetch-backdrop {
  cursor: progress;
}

.map-prefetch-backdrop-enter-active,
.map-prefetch-backdrop-leave-active {
  transition: opacity var(--transition-normal);
}

.map-prefetch-backdrop-enter-from,
.map-prefetch-backdrop-leave-to {
  opacity: 0;
}

.map-prefetch-backdrop__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 14rem;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--skyrim-bg-medium);
  border: var(--border-thin) solid var(--skyrim-border-medium);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-medium);
  color: var(--skyrim-text-accent);
  font-family: var(--font-heading);
  font-size: var(--font-size-sm);
  letter-spacing: 0.04em;
}

.map-prefetch-backdrop__label {
  color: var(--skyrim-text-accent);
}

.map-prefetch-backdrop__bar {
  position: relative;
  width: 100%;
  height: 6px;
  overflow: hidden;
  background-color: var(--skyrim-bg-dark);
  border: var(--border-thin) solid var(--skyrim-border-dark);
  border-radius: var(--radius-sm);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    width: var(--p, 0%);
    background: linear-gradient(
      90deg,
      var(--skyrim-accent-main-dim),
      var(--skyrim-accent-main-light)
    );
    transition: width var(--transition-fast);
  }
}

.map-prefetch-backdrop__pct {
  color: var(--skyrim-text-secondary);
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}
</style>
