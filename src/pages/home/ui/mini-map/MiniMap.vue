<template>
  <div
    ref="root"
    class="minimap"
    :class="{ 'minimap--pinned': isPinned, 'minimap--empty': !hasView }"
  >
    <button
      type="button"
      class="minimap__surface"
      :aria-label="t('pages.home.mapOpen')"
      @click="emit('open')"
    >
      <div
        v-if="hasView"
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
        v-if="hasView"
        class="minimap__overlay"
        :viewBox="`0 0 ${viewWidth} ${viewHeight}`"
        aria-hidden="true"
      >
        <g
          v-for="marker in questMarkers"
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
        v-if="!hasView"
        class="minimap__message"
      >{{ t('pages.home.mapNoArea') }}</span>
    </button>

    <span
      class="minimap__north"
      aria-hidden="true"
    >{{ t('pages.home.north') }}</span>

    <span
      v-if="isPinned && placeName"
      class="minimap__place"
    >{{ t('pages.home.mapInterior', { place: placeName }) }}</span>

    <button
      v-if="hasView"
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
import { useMapHotspotsStore } from '@/stores/map/useMapHotspotsStore';
import { levelGeometry, maxDziLevel, placeInView, visibleTiles } from '../../lib/minimapTiles';

const emit = defineEmits<{ open: [] }>();
const { t } = useI18n();

/** Full-resolution map pixels per CSS pixel for each zoom step (near, far). */
const ZOOM_STEPS = [2, 4.5];
const ZOOM_STORAGE_KEY = 'skyrim-monitor-minimap-zoom';
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
const placeName = computed(() => position.value?.cell ?? null);
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
