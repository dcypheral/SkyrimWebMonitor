<template>
  <canvas
    ref="canvas"
    class="local-map"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { bandAnchor, bandOf, type Band, type LocalMapGeometry } from '@/stores/map/lib/localMap';

/**
 * Draws the navmesh floor plan centred on the player, north up.
 * Paths are built once per area and height band (world units); each frame
 * only sets a transform and fills them, so redraws stay cheap.
 */
const props = defineProps<{
  geometry: LocalMapGeometry;
  /** Player position in the geometry's coordinates. */
  center: { x: number; y: number; z: number };
  /** World units per CSS pixel. */
  unitsPerPx: number;
  width: number;
  height: number;
}>();

interface BandPaths {
  fill: Path2D;
  walls: Path2D;
}

// Opaque fills (pre-mixed over the mini-map background): the seam strokes
// then hide the anti-aliasing gaps between triangles without darkening.
const STYLE: Record<Band, { fill: string; wall: string }> = {
  below: { fill: 'rgb(37 34 27)', wall: 'rgb(78 72 58)' },
  above: { fill: 'rgb(31 28 22)', wall: 'rgb(62 57 46)' },
  floor: { fill: 'rgb(80 73 58)', wall: 'rgb(236 222 184)' },
};
const ORDER: Band[] = ['below', 'above', 'floor'];

const canvas = ref<HTMLCanvasElement | null>(null);
let paths: Record<Band, BandPaths> | null = null;
let pathsKey = '';
let frame = 0;

function buildPaths(g: LocalMapGeometry, anchor: number): Record<Band, BandPaths> {
  const out: Record<Band, BandPaths> = {
    below: { fill: new Path2D(), walls: new Path2D() },
    above: { fill: new Path2D(), walls: new Path2D() },
    floor: { fill: new Path2D(), walls: new Path2D() },
  };
  const v = g.vertices;
  const count = g.triangles.length / 3;
  for (let t = 0; t < count; t++) {
    const band = out[bandOf(g, t, anchor)];
    const i0 = g.triangles[t * 3] * 3;
    const i1 = g.triangles[t * 3 + 1] * 3;
    const i2 = g.triangles[t * 3 + 2] * 3;
    band.fill.moveTo(v[i0], v[i0 + 1]);
    band.fill.lineTo(v[i1], v[i1 + 1]);
    band.fill.lineTo(v[i2], v[i2 + 1]);
    band.fill.closePath();
    const open = g.edges[t];
    if (!open) continue;
    const corners = [i0, i1, i2];
    for (let e = 0; e < 3; e++) {
      if (!(open & (1 << e))) continue;
      const a = corners[e];
      const b = corners[(e + 1) % 3];
      band.walls.moveTo(v[a], v[a + 1]);
      band.walls.lineTo(v[b], v[b + 1]);
    }
  }
  return out;
}

function draw(): void {
  frame = 0;
  const el = canvas.value;
  const ctx = el?.getContext('2d');
  if (!el || !ctx || props.width <= 0 || props.height <= 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(props.width * dpr);
  const h = Math.round(props.height * dpr);
  if (el.width !== w || el.height !== h) {
    el.width = w;
    el.height = h;
  }

  const g = props.geometry;
  const anchor = bandAnchor(props.center.z);
  const key = `${g.key}|${g.triangles.length}|${g.isInterior ? anchor : 0}`;
  if (!paths || key !== pathsKey) {
    paths = buildPaths(g, anchor);
    pathsKey = key;
  }

  const k = props.unitsPerPx;
  const { x: cx, y: cy } = props.center;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // World → device pixels: x right, y up (north), player at the centre.
  ctx.setTransform(dpr / k, 0, 0, -dpr / k, dpr * (props.width / 2 - cx / k), dpr * (props.height / 2 + cy / k));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const band of ORDER) {
    const p = paths[band];
    ctx.fillStyle = STYLE[band].fill;
    ctx.fill(p.fill);
    // Hairline seams between triangles of the same band.
    ctx.strokeStyle = STYLE[band].fill;
    ctx.lineWidth = 0.6 * k;
    ctx.stroke(p.fill);
    ctx.strokeStyle = STYLE[band].wall;
    ctx.lineWidth = (band === 'floor' ? 1.4 : 1) * k;
    ctx.stroke(p.walls);
  }

  // Load doors: small gold squares.
  ctx.fillStyle = '#e8c56a';
  ctx.strokeStyle = '#1a150c';
  ctx.lineWidth = 1 * k;
  const size = 4 * k;
  for (const d of g.doors) {
    if (g.isInterior && Math.abs(d.z - props.center.z) > 400) continue;
    ctx.beginPath();
    ctx.rect(d.x - size / 2, d.y - size / 2, size, size);
    ctx.fill();
    ctx.stroke();
  }
}

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(draw);
}

watch(
  () => [props.geometry, props.center.x, props.center.y, props.center.z, props.unitsPerPx, props.width, props.height],
  schedule,
);

onMounted(schedule);
onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame);
  paths = null;
});
</script>

<style scoped lang="scss">
.local-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
