<template>
  <g class="journey-layer">
    <template v-if="paths">
      <path
        v-if="paths.faded"
        class="journey-layer__trail journey-layer__trail--faded"
        :d="paths.faded"
      />
      <path
        v-if="paths.highlight"
        class="journey-layer__trail journey-layer__trail--casing"
        :d="paths.highlight"
      />
      <path
        v-if="paths.highlight"
        class="journey-layer__trail"
        :d="paths.highlight"
      />
    </template>

    <g
      v-for="pin in pins"
      :key="pin.id"
      class="journey-layer__pin"
      :class="{ 'journey-layer__pin--photo': pin.hasPhoto }"
      :transform="`translate(${pin.x} ${pin.y}) scale(${pinScale})`"
    >
      <path d="M0 0 L-6 -10 A7.5 7.5 0 1 1 6 -10 Z" />
      <circle
        cx="0"
        cy="-14"
        r="3"
      />
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import { storeToRefs } from 'pinia';
import { journeyLayers } from '@/shared/lib/settings/journeyLayers';
import { pickLod } from '@/stores/journey/lib/simplify';
import { useJourneyStore } from '@/stores/journey/useJourneyStore';
import { useJourneyPath } from '@/features/journey';
import type { MapProjectionFn } from '../../composables/useMapProjection';

const props = defineProps<{
  /** CSS px per image px. */
  scale: number;
  projectWorldToImage: MapProjectionFn;
  currentWorldspace: string;
}>();

/** Pin height on screen (CSS px). */
const PIN_SCREEN_PX = 22;
/** Tap target radius on screen (CSS px). */
const PIN_HIT_PX = 18;

const store = useJourneyStore();
const { notes, activeSessionId } = storeToRefs(store);

const worldspace = toRef(() => props.currentWorldspace);
const project = toRef(() => props.projectWorldToImage);
const journeyPath = useJourneyPath(worldspace, project);

const highlightSession = computed(() => journeyLayers.focusSessionId ?? activeSessionId.value);

/** Detail level follows the zoom; the strings are cached per level. */
const lod = computed(() => (props.scale > 0 ? pickLod(1 / props.scale) : 0));

const paths = computed(() => {
  if (!journeyLayers.path) return null;
  return journeyPath.pathData(lod.value, {
    highlightSession: highlightSession.value,
    onlyHighlight: journeyLayers.focusSessionId !== null || !journeyLayers.allSessions,
  });
});

const pinScale = computed(() => (props.scale > 0 ? PIN_SCREEN_PX / 22 / props.scale : 1));

const pins = computed(() => {
  if (!journeyLayers.notes) return [];
  const out: Array<{ id: number; x: number; y: number; hasPhoto: boolean }> = [];
  for (const note of notes.value) {
    if (note.worldspace !== props.currentWorldspace) continue;
    if (journeyLayers.focusSessionId !== null && note.sessionId !== journeyLayers.focusSessionId) continue;
    const p = props.projectWorldToImage({ x: note.x, y: note.y });
    if (p) out.push({ id: note.id, x: p.x, y: p.y, hasPhoto: note.hasPhoto });
  }
  return out;
});

/** Note under a tap at image coordinates (the pin's head), or null. */
function hitNote(imgX: number, imgY: number): number | null {
  if (props.scale <= 0) return null;
  const r = PIN_HIT_PX / props.scale;
  const headOffset = (14 * PIN_SCREEN_PX) / 22 / props.scale;
  let best: { id: number; d: number } | null = null;
  for (const pin of pins.value) {
    const d = Math.hypot(imgX - pin.x, imgY - (pin.y - headOffset));
    if (d <= r && (!best || d < best.d)) best = { id: pin.id, d };
  }
  return best?.id ?? null;
}

/** Image-space bounding box of one session's path on this map. */
function sessionBounds(sessionId: number): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let box: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  const lines = [...journeyPath.stored.value];
  if (journeyPath.live.value) lines.push(journeyPath.live.value);
  for (const l of lines) {
    if (l.sessionId !== sessionId) continue;
    box = box
      ? {
          minX: Math.min(box.minX, l.minX),
          minY: Math.min(box.minY, l.minY),
          maxX: Math.max(box.maxX, l.maxX),
          maxY: Math.max(box.maxY, l.maxY),
        }
      : { minX: l.minX, minY: l.minY, maxX: l.maxX, maxY: l.maxY };
  }
  return box;
}

defineExpose({ hitNote, sessionBounds });
</script>

<style scoped lang="scss">
.journey-layer__trail {
  fill: none;
  stroke: #f3c45e;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 6 5;
  vector-effect: non-scaling-stroke;

  &--casing {
    stroke: rgb(40 26 8 / 75%);
    stroke-width: 5;
    stroke-dasharray: none;
  }

  &--faded {
    stroke: #b88a3e;
    stroke-width: 2;
    stroke-dasharray: 4 5;
    opacity: 0.6;
  }
}

.journey-layer__pin {
  path {
    fill: #f2e6c4;
    stroke: #2a2112;
    stroke-width: 1.4;
  }

  circle {
    fill: #2a2112;
  }

  &--photo path {
    fill: #9fd0ff;
  }
}
</style>
