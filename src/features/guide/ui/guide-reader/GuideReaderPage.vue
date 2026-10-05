<template>
  <div
    class="gpage"
    :class="{ 'gpage--draw': drawing }"
    :style="{ transform: `translate3d(${left}px, ${top}px, 0)`, width: `${width}px`, height: `${height}px` }"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="cancelDraft"
  >
    <div
      ref="host"
      class="gpage__canvas"
    />
    <span
      v-if="!rendered"
      class="gpage__placeholder"
    >{{ page + 1 }}</span>

    <button
      v-for="h in highlights"
      :key="h.id"
      type="button"
      class="gpage__hl"
      :class="[`gpage__hl--${h.color}`, { 'gpage__hl--selected': h.id === selectedId }]"
      :style="rectStyle(h.rect)"
      :aria-label="h.note || t('shared.ui.guide.highlight')"
      @pointerdown.stop
      @click.stop="emit('select', h)"
    />

    <div
      v-for="(r, i) in flashRects"
      :key="`f${i}`"
      class="gpage__flash"
      :style="rectStyle(r)"
    />

    <div
      v-if="draft"
      class="gpage__hl gpage__hl--draft"
      :class="`gpage__hl--${drawColor}`"
      :style="rectStyle(draftRect)"
    />

    <span
      v-if="bookmarked"
      class="gpage__ribbon"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { PDFDocumentProxy } from '@/shared/lib/guide/pdfDocument';
import type { GuideHighlight, HighlightColor } from '@/stores/guide/lib/types';
import { renderPageCanvas } from '../../lib/pageRenderer';

type Rect = [number, number, number, number];

const props = defineProps<{
  doc: PDFDocumentProxy | null;
  page: number;
  top: number;
  left: number;
  width: number;
  height: number;
  /** Canvas width in device pixels. */
  renderWidth: number;
  highlights: GuideHighlight[];
  /** Search or quest-name hits to outline, as page fractions. */
  flashRects: Rect[];
  bookmarked: boolean;
  drawing: boolean;
  drawColor: HighlightColor;
  selectedId: number | null;
}>();

const emit = defineEmits<{
  select: [highlight: GuideHighlight];
  create: [rect: Rect];
}>();

const { t } = useI18n();

/** Pages scrolled past quickly are not drawn at all. */
const RENDER_DELAY_MS = 90;
/** Smallest highlight, as a fraction of the page width. */
const MIN_HIGHLIGHT = 0.015;

const host = ref<HTMLElement | null>(null);
const rendered = ref(false);
let renderedWidth = 0;
let abort: AbortController | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleRender(): void {
  if (!props.doc) return;
  if (rendered.value && renderedWidth === props.renderWidth) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void draw();
  }, rendered.value ? 0 : RENDER_DELAY_MS);
}

async function draw(): Promise<void> {
  const doc = props.doc;
  if (!doc) return;
  abort?.abort();
  const controller = new AbortController();
  abort = controller;
  const width = props.renderWidth;
  try {
    const canvas = await renderPageCanvas(doc, props.page, width, controller.signal);
    if (controller.signal.aborted || !host.value) return;
    host.value.replaceChildren(canvas);
    rendered.value = true;
    renderedWidth = width;
  } catch (err) {
    if (!controller.signal.aborted && !(err instanceof Error && err.name === 'RenderingCancelledException')) {
      console.warn('[Guide] Page render failed', props.page, err);
    }
  }
}

watch(() => [props.doc, props.page, props.renderWidth], scheduleRender, { immediate: true });

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer);
  abort?.abort();
});

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

function rectStyle(r: Rect): Record<string, string> {
  return { left: pct(r[0]), top: pct(r[1]), width: pct(r[2]), height: pct(r[3]) };
}

// ─── Drawing highlights ─────────────────────────────────────────────────

const draft = ref<{ id: number; x0: number; y0: number; x1: number; y1: number } | null>(null);

const draftRect = computed<Rect>(() => {
  const d = draft.value;
  if (!d) return [0, 0, 0, 0];
  return [Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)];
});

function toPage(e: PointerEvent): { x: number; y: number } {
  const el = e.currentTarget;
  if (!(el instanceof HTMLElement)) return { x: 0, y: 0 };
  const box = el.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
    y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
  };
}

function onDown(e: PointerEvent): void {
  if (!props.drawing || !e.isPrimary || e.button > 0) {
    // A second finger means a pinch: drop the half-drawn highlight.
    cancelDraft();
    return;
  }
  const p = toPage(e);
  draft.value = { id: e.pointerId, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  if (e.currentTarget instanceof HTMLElement) e.currentTarget.setPointerCapture(e.pointerId);
}

function onMove(e: PointerEvent): void {
  const d = draft.value;
  if (!d || d.id !== e.pointerId) return;
  const p = toPage(e);
  d.x1 = p.x;
  d.y1 = p.y;
}

function onUp(e: PointerEvent): void {
  const d = draft.value;
  if (!d || d.id !== e.pointerId) return;
  const r = draftRect.value;
  draft.value = null;
  if (r[2] >= MIN_HIGHLIGHT && r[3] >= MIN_HIGHLIGHT / 2) emit('create', r);
}

function cancelDraft(): void {
  draft.value = null;
}
</script>

<style scoped lang="scss">
.gpage {
  position: absolute;
  top: 0;
  left: 0;
  background: #e9e1cf;
  box-shadow: 0 2px 10px rgb(0 0 0 / 55%);
  contain: strict;

  &--draw {
    touch-action: none;
    cursor: crosshair;
  }
}

.gpage__canvas {
  position: absolute;
  inset: 0;

  :deep(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
}

.gpage__placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgb(0 0 0 / 25%);
  font-family: var(--font-heading, serif);
  font-size: 2rem;
}

.gpage__hl {
  position: absolute;
  padding: 0;
  border: 0;
  border-radius: 2px;
  mix-blend-mode: multiply;
  cursor: pointer;

  &--amber { background: rgb(255 196 0 / 45%); }
  &--green { background: rgb(80 200 90 / 40%); }
  &--blue { background: rgb(70 150 255 / 38%); }
  &--rose { background: rgb(255 90 120 / 38%); }

  &--selected {
    outline: 2px solid rgb(0 0 0 / 55%);
    outline-offset: 1px;
  }

  &--draft {
    pointer-events: none;
    outline: 1px dashed rgb(0 0 0 / 50%);
  }
}

.gpage__flash {
  position: absolute;
  pointer-events: none;
  border-radius: 3px;
  outline: 2px solid rgb(214 60 30 / 85%);
  background: rgb(255 120 60 / 18%);
  animation: gpage-flash 2.6s ease-out forwards;
}

@keyframes gpage-flash {
  0%, 60% { opacity: 1; }
  100% { opacity: 0; }
}

.gpage__ribbon {
  position: absolute;
  top: 0;
  right: 8%;
  width: 14px;
  height: 26px;
  background: #9b1c1c;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%);
  box-shadow: 0 1px 3px rgb(0 0 0 / 40%);
  pointer-events: none;
}
</style>
