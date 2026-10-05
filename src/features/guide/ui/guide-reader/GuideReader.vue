<template>
  <Teleport to="body">
    <Transition name="greader">
      <div
        v-if="reader.open"
        ref="root"
        class="greader"
        role="dialog"
        aria-modal="true"
        :aria-label="t('shared.ui.guide.title')"
        tabindex="-1"
        @keydown="onKey"
      >
        <header class="greader__bar greader__bar--top">
          <button
            type="button"
            class="greader__btn"
            :aria-label="t('shared.ui.guide.close')"
            @click="close"
          >
            <guide-icon name="close" />
          </button>

          <div class="greader__where">
            <span
              v-if="crumb.parent"
              class="greader__crumb"
            >{{ crumb.parent }}</span>
            <span class="greader__section">{{ crumb.title }}</span>
          </div>

          <form
            v-if="editingPage"
            class="greader__goto"
            @submit.prevent="submitGoto"
          >
            <input
              ref="gotoInput"
              v-model="gotoValue"
              inputmode="numeric"
              :aria-label="t('shared.ui.guide.goToPage')"
              @blur="editingPage = false"
            >
          </form>
          <button
            v-else
            type="button"
            class="greader__pageno"
            :aria-label="t('shared.ui.guide.goToPage')"
            @click="startGoto"
          >
            {{ currentPage + 1 }}<small>/{{ pageCount }}</small>
          </button>

          <button
            type="button"
            class="greader__btn"
            :class="{ 'greader__btn--on': bookmark }"
            :aria-label="bookmark ? t('shared.ui.guide.removeBookmark') : t('shared.ui.guide.addBookmark')"
            :aria-pressed="!!bookmark"
            @click="toggleBookmark"
          >
            <guide-icon
              name="ribbon"
              :filled="!!bookmark"
            />
          </button>
          <button
            type="button"
            class="greader__btn"
            :aria-label="t('shared.ui.guide.drawer')"
            @click="openDrawer('contents')"
          >
            <guide-icon name="contents" />
          </button>
        </header>

        <div
          ref="scroller"
          class="greader__scroller"
          @scroll.passive="onScroll"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
          @wheel="onWheel"
          @pointerdown="onTapDown"
          @pointerup="onTapUp"
        >
          <div
            ref="content"
            class="greader__content"
            :style="{ width: `${contentW}px`, height: `${contentH}px` }"
          >
            <guide-reader-page
              v-for="p in mountedPages"
              :key="p"
              :doc="doc"
              :page="p"
              :top="pageTop(p)"
              :left="PAD"
              :width="slotW"
              :height="slotH"
              :render-width="renderWidth"
              :highlights="highlightsByPage.get(p) ?? EMPTY"
              :flash-rects="flash && flash.page === p ? flash.rects : NO_RECTS"
              :bookmarked="bookmarkedPages.has(p)"
              :drawing="drawing"
              :draw-color="drawColor"
              :selected-id="selected?.id ?? null"
              @select="selectHighlight"
              @create="(r) => createHighlight(p, r)"
            />
          </div>
        </div>

        <div
          v-if="drawing && !selected"
          class="greader__palette"
        >
          <span class="greader__hint">{{ t('shared.ui.guide.drawHint') }}</span>
          <button
            v-for="c in HIGHLIGHT_COLORS"
            :key="c"
            type="button"
            class="greader__swatch"
            :class="[`greader__swatch--${c}`, { 'greader__swatch--on': drawColor === c }]"
            :aria-label="t(`shared.ui.guide.colors.${c}`)"
            :aria-pressed="drawColor === c"
            @click="drawColor = c"
          />
        </div>

        <div
          v-if="selected"
          class="greader__popover"
        >
          <div class="greader__popover-row">
            <button
              v-for="c in HIGHLIGHT_COLORS"
              :key="c"
              type="button"
              class="greader__swatch"
              :class="[`greader__swatch--${c}`, { 'greader__swatch--on': selected.color === c }]"
              :aria-label="t(`shared.ui.guide.colors.${c}`)"
              @click="recolor(c)"
            />
            <span class="greader__flex" />
            <button
              type="button"
              class="greader__btn"
              :aria-label="t('common.delete')"
              @click="deleteSelected"
            >
              <guide-icon name="trash" />
            </button>
            <button
              type="button"
              class="greader__btn"
              :aria-label="t('shared.ui.guide.done')"
              @click="closePopover"
            >
              <guide-icon name="check" />
            </button>
          </div>
          <input
            v-model="noteDraft"
            class="greader__note"
            :placeholder="t('shared.ui.guide.notePlaceholder')"
            maxlength="200"
            @keydown.enter="closePopover"
          >
        </div>

        <footer class="greader__bar greader__bar--bottom">
          <template v-if="reader.quest">
            <span
              class="greader__quest"
              :title="reader.quest.name"
            >{{ reader.quest.name }}</span>
            <button
              type="button"
              class="greader__link"
              :class="{ 'greader__link--on': linkedHere }"
              :disabled="linkedHere"
              @click="linkHere"
            >
              <guide-icon
                :name="linkedHere ? 'check' : 'link'"
                :size="16"
              />
              {{ linkedHere ? t('shared.ui.guide.linked') : t('shared.ui.guide.linkPage') }}
            </button>
          </template>
          <span class="greader__flex" />
          <button
            type="button"
            class="greader__btn"
            :class="{ 'greader__btn--on': drawing }"
            :aria-label="t('shared.ui.guide.highlighter')"
            :aria-pressed="drawing"
            @click="toggleDrawing"
          >
            <guide-icon name="marker" />
          </button>
          <button
            type="button"
            class="greader__btn"
            :aria-label="t('shared.ui.guide.tabs.search')"
            @click="openDrawer('search')"
          >
            <guide-icon name="search" />
          </button>
          <button
            type="button"
            class="greader__btn"
            :disabled="zoom <= MIN_ZOOM"
            :aria-label="t('shared.ui.guide.zoomOut')"
            @click="zoomStep(-1)"
          >
            <guide-icon name="zoom-out" />
          </button>
          <button
            type="button"
            class="greader__btn"
            :disabled="zoom >= MAX_ZOOM"
            :aria-label="t('shared.ui.guide.zoomIn')"
            @click="zoomStep(1)"
          >
            <guide-icon name="zoom-in" />
          </button>
        </footer>

        <Transition name="greader-fade">
          <div
            v-if="drawerOpen"
            class="greader__scrim"
            @click="drawerOpen = false"
          />
        </Transition>
        <Transition name="greader-drawer">
          <guide-drawer
            v-if="drawerOpen"
            v-model:tab="drawerTab"
            :current-page="currentPage"
            :initial-query="reader.search"
            @jump="onDrawerJump"
          />
        </Transition>

        <Transition name="greader-fade">
          <p
            v-if="toast"
            class="greader__toast"
            role="status"
          >
            {{ toast }}
          </p>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useGuideStore } from '@/stores/guide/useGuideStore';
import { HIGHLIGHT_COLORS, type GuideHighlight, type HighlightColor } from '@/stores/guide/lib/types';
import { rectsForQuery } from '@/shared/lib/guide/pageText';
import type { PDFDocumentProxy } from '@/shared/lib/guide/pdfDocument';
import { pushBackHandler } from '@/shared/lib/composables/useBackGuard';
import { MAX_RENDER_WIDTH } from '../../lib/pageRenderer';
import GuideIcon from '../guide-icon/GuideIcon.vue';
import GuideReaderPage from './GuideReaderPage.vue';
import GuideDrawer, { type DrawerTab } from './GuideDrawer.vue';

type Rect = [number, number, number, number];

const PAD = 6;
const GAP = 10;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.4;
const DOUBLE_TAP_ZOOM = 2.4;
const DOUBLE_TAP_MS = 320;
const TAP_SLOP_PX = 10;
const FLASH_MS = 3000;
const TOAST_MS = 1800;
const EMPTY: GuideHighlight[] = [];
const NO_RECTS: Rect[] = [];

const { t } = useI18n();
const guide = useGuideStore();
const { reader, pageCount, annotations, links } = storeToRefs(guide);

const root = ref<HTMLElement | null>(null);
const scroller = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
const doc = shallowRef<PDFDocumentProxy | null>(null);

// ─── Layout ─────────────────────────────────────────────────────────────

const viewW = ref(0);
const viewH = ref(0);
const zoom = ref(1);
const scrollTop = ref(0);
const dpr = Math.min(window.devicePixelRatio || 1, 3);

const aspect = computed(() => {
  const s = guide.pageSize(0);
  return s.height / s.width;
});
const slotW = computed(() => Math.max(120, viewW.value - 2 * PAD) * zoom.value);
const slotH = computed(() => slotW.value * aspect.value);
const stride = computed(() => slotH.value + GAP);
const contentW = computed(() => slotW.value + 2 * PAD);
const contentH = computed(() => pageCount.value * stride.value + GAP);
const renderWidth = computed(() => Math.min(MAX_RENDER_WIDTH, Math.ceil((slotW.value * dpr) / 100) * 100));

const clampPage = (p: number) => Math.max(0, Math.min(pageCount.value - 1, p));
const pageTop = (p: number) => GAP + p * stride.value;

const currentPage = computed(() => clampPage(Math.floor((scrollTop.value + viewH.value / 2 - GAP) / stride.value)));

const mountedPages = computed(() => {
  if (!viewH.value) return [];
  const first = clampPage(Math.floor((scrollTop.value - GAP) / stride.value) - 1);
  const last = clampPage(Math.floor((scrollTop.value + viewH.value) / stride.value) + 1);
  const pages: number[] = [];
  for (let p = first; p <= last; p++) pages.push(p);
  return pages;
});

let resizeObserver: ResizeObserver | null = null;

function measure(): void {
  const el = scroller.value;
  if (!el) return;
  viewW.value = el.clientWidth;
  viewH.value = el.clientHeight;
  scrollTop.value = el.scrollTop;
}

let scrollFrame = 0;
function onScroll(): void {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    if (scroller.value) scrollTop.value = scroller.value.scrollTop;
  });
}

watch(currentPage, (p) => {
  if (reader.value.open) guide.setLastPage(p);
});

function scrollToPage(page: number): void {
  const el = scroller.value;
  if (!el) return;
  el.scrollTop = pageTop(clampPage(page)) - GAP / 2;
  scrollTop.value = el.scrollTop;
}

// ─── Opening and jumps ──────────────────────────────────────────────────

const flash = ref<{ page: number; rects: Rect[] } | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;

function showFlash(page: number, rects: Rect[]): void {
  if (flashTimer) clearTimeout(flashTimer);
  flash.value = rects.length ? { page, rects } : null;
  flashTimer = setTimeout(() => {
    flash.value = null;
    flashTimer = null;
  }, FLASH_MS);
}

/** Outlines `text` on the page (or the next one) after a jump. */
function flashText(page: number, text: string): void {
  if (!text) return;
  for (const p of [page, page + 1]) {
    const pt = guide.pageText(p);
    const rects = pt ? rectsForQuery(pt, text) : [];
    if (rects.length) {
      showFlash(p, rects);
      return;
    }
  }
}

let removeBack: (() => void) | null = null;

watch(
  () => reader.value.open,
  async (open) => {
    if (!open) {
      removeBack?.();
      removeBack = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
      return;
    }
    removeBack = pushBackHandler(onBack);
    guide
      .getDocument()
      .then((d) => {
        doc.value = markRaw(d);
      })
      .catch((err: unknown) => {
        console.warn('[Guide] Could not open the guide', err);
        showToast(t('shared.ui.guide.openFailed'));
      });
    await nextTick();
    if (scroller.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => measure());
      resizeObserver.observe(scroller.value);
    }
    measure();
    await nextTick();
    scrollToPage(reader.value.page);
    flashText(reader.value.page, reader.value.flash);
    root.value?.focus({ preventScroll: true });
  },
  { immediate: true },
);

watch(
  () => reader.value.jump,
  async () => {
    if (!reader.value.open || !scroller.value) return;
    await nextTick();
    scrollToPage(reader.value.page);
    flashText(reader.value.page, reader.value.flash);
  },
);

function close(): void {
  drawerOpen.value = false;
  drawing.value = false;
  closePopover();
  guide.closeReader();
}

function onBack(): boolean {
  if (selected.value) closePopover();
  else if (editingPage.value) editingPage.value = false;
  else if (drawerOpen.value) drawerOpen.value = false;
  else close();
  return true;
}

// ─── Go to page ─────────────────────────────────────────────────────────

const editingPage = ref(false);
const gotoValue = ref('');
const gotoInput = ref<HTMLInputElement | null>(null);

function startGoto(): void {
  gotoValue.value = String(currentPage.value + 1);
  editingPage.value = true;
  void nextTick(() => {
    gotoInput.value?.focus();
    gotoInput.value?.select();
  });
}

function submitGoto(): void {
  const n = Number.parseInt(gotoValue.value, 10);
  editingPage.value = false;
  if (Number.isFinite(n)) scrollToPage(n - 1);
}

// ─── Zoom ───────────────────────────────────────────────────────────────

const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** Zooms so the content point (cx, cy) ends up at view point (vx, vy). */
async function zoomAround(target: number, cx: number, cy: number, vx: number, vy: number): Promise<void> {
  const el = scroller.value;
  const z = clampZoom(target);
  if (!el || Math.abs(z - zoom.value) < 0.001) return;
  const page = clampPage(Math.floor((cy - GAP) / stride.value));
  const fy = (cy - pageTop(page)) / slotH.value;
  const fx = (cx - PAD) / slotW.value;
  zoom.value = z;
  await nextTick();
  el.scrollLeft = PAD + fx * slotW.value - vx;
  el.scrollTop = pageTop(page) + fy * slotH.value - vy;
  scrollTop.value = el.scrollTop;
}

function zoomStep(direction: 1 | -1): void {
  const el = scroller.value;
  if (!el) return;
  const vx = el.clientWidth / 2;
  const vy = el.clientHeight / 2;
  void zoomAround(zoom.value * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP), el.scrollLeft + vx, el.scrollTop + vy, vx, vy);
}

function onWheel(e: WheelEvent): void {
  if (!e.ctrlKey || !scroller.value) return;
  e.preventDefault();
  const box = scroller.value.getBoundingClientRect();
  const vx = e.clientX - box.left;
  const vy = e.clientY - box.top;
  void zoomAround(zoom.value * Math.exp(-e.deltaY * 0.01), scroller.value.scrollLeft + vx, scroller.value.scrollTop + vy, vx, vy);
}

// Two-finger pinch: scale the content with a transform while the fingers
// move (no re-layout), then commit the zoom when they lift.
interface Pinch {
  d0: number;
  z0: number;
  mx0: number;
  my0: number;
  cx: number;
  cy: number;
  scale: number;
  dx: number;
  dy: number;
}
let pinch: Pinch | null = null;

function touchGeometry(e: TouchEvent): { d: number; mx: number; my: number } | null {
  const a = e.touches[0];
  const b = e.touches[1];
  const el = scroller.value;
  if (!a || !b || !el) return null;
  const box = el.getBoundingClientRect();
  return {
    d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    mx: (a.clientX + b.clientX) / 2 - box.left,
    my: (a.clientY + b.clientY) / 2 - box.top,
  };
}

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length !== 2 || !scroller.value || !content.value) return;
  const g = touchGeometry(e);
  if (!g || g.d < 10) return;
  const cx = scroller.value.scrollLeft + g.mx;
  const cy = scroller.value.scrollTop + g.my;
  pinch = { d0: g.d, z0: zoom.value, mx0: g.mx, my0: g.my, cx, cy, scale: 1, dx: 0, dy: 0 };
  content.value.style.transformOrigin = `${cx}px ${cy}px`;
}

function onTouchMove(e: TouchEvent): void {
  if (!pinch || e.touches.length < 2 || !content.value) return;
  if (e.cancelable) e.preventDefault();
  const g = touchGeometry(e);
  if (!g) return;
  pinch.scale = clampZoom(pinch.z0 * (g.d / pinch.d0)) / pinch.z0;
  pinch.dx = g.mx - pinch.mx0;
  pinch.dy = g.my - pinch.my0;
  content.value.style.transform = `translate(${pinch.dx}px, ${pinch.dy}px) scale(${pinch.scale})`;
}

function onTouchEnd(e: TouchEvent): void {
  if (!pinch || e.touches.length >= 2) return;
  const p = pinch;
  pinch = null;
  if (content.value) content.value.style.transform = '';
  lastTap = null;
  void zoomAround(p.z0 * p.scale, p.cx, p.cy, p.mx0 + p.dx, p.my0 + p.dy);
}

// Double tap: zoom in at the tapped point, or back to page width.
let tapDown: { x: number; y: number; id: number } | null = null;
let lastTap: { x: number; y: number; t: number } | null = null;

function onTapDown(e: PointerEvent): void {
  tapDown = e.isPrimary ? { x: e.clientX, y: e.clientY, id: e.pointerId } : null;
}

function onTapUp(e: PointerEvent): void {
  const down = tapDown;
  tapDown = null;
  if (!down || down.id !== e.pointerId || drawing.value || pinch || !scroller.value) return;
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_SLOP_PX) return;
  const now = performance.now();
  if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
    lastTap = null;
    const box = scroller.value.getBoundingClientRect();
    const vx = e.clientX - box.left;
    const vy = e.clientY - box.top;
    const target = zoom.value > 1.05 ? 1 : DOUBLE_TAP_ZOOM;
    void zoomAround(target, scroller.value.scrollLeft + vx, scroller.value.scrollTop + vy, vx, vy);
    return;
  }
  lastTap = { x: e.clientX, y: e.clientY, t: now };
}

// ─── Keys ───────────────────────────────────────────────────────────────

function onKey(e: KeyboardEvent): void {
  if (e.target instanceof HTMLInputElement) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  switch (e.key) {
    case 'Escape':
      onBack();
      break;
    case 'ArrowRight':
    case 'PageDown':
      scrollToPage(currentPage.value + 1);
      break;
    case 'ArrowLeft':
    case 'PageUp':
      scrollToPage(currentPage.value - 1);
      break;
    case '+':
    case '=':
      zoomStep(1);
      break;
    case '-':
      zoomStep(-1);
      break;
    default:
      return;
  }
  e.preventDefault();
}

// ─── Bookmarks ──────────────────────────────────────────────────────────

const bookmarkedPages = computed(() => new Set(annotations.value.filter((a) => a.kind === 'bookmark').map((a) => a.page)));
const bookmark = computed(() => annotations.value.find((a) => a.kind === 'bookmark' && a.page === currentPage.value) ?? null);

async function toggleBookmark(): Promise<void> {
  const existing = bookmark.value;
  if (existing?.id !== undefined) {
    await guide.removeAnnotation(existing.id);
    showToast(t('shared.ui.guide.bookmarkRemoved'));
    return;
  }
  const page = currentPage.value;
  await guide.addBookmark(page, guide.sectionTitle(page));
  showToast(t('shared.ui.guide.bookmarkAdded', { page: page + 1 }));
}

// ─── Highlights ─────────────────────────────────────────────────────────

const drawing = ref(false);
const drawColor = ref<HighlightColor>('amber');
const selected = ref<GuideHighlight | null>(null);
const noteDraft = ref('');

const highlightsByPage = computed(() => {
  const map = new Map<number, GuideHighlight[]>();
  for (const a of annotations.value) {
    if (a.kind !== 'highlight') continue;
    const list = map.get(a.page);
    if (list) list.push(a);
    else map.set(a.page, [a]);
  }
  return map;
});

function toggleDrawing(): void {
  drawing.value = !drawing.value;
  closePopover();
}

async function createHighlight(page: number, rect: Rect): Promise<void> {
  const saved = await guide.addHighlight(page, rect, drawColor.value);
  if (saved?.kind === 'highlight') selectHighlight(saved);
}

function selectHighlight(h: GuideHighlight): void {
  saveNote();
  selected.value = h;
  noteDraft.value = h.note;
}

function saveNote(): void {
  const h = selected.value;
  if (!h || noteDraft.value === h.note) return;
  void guide.updateAnnotation({ ...h, note: noteDraft.value.trim() });
}

function closePopover(): void {
  saveNote();
  selected.value = null;
}

async function recolor(color: HighlightColor): Promise<void> {
  const h = selected.value;
  if (!h) return;
  drawColor.value = color;
  const saved = await guide.updateAnnotation({ ...h, color, note: noteDraft.value.trim() });
  if (saved.kind === 'highlight') selected.value = saved;
}

async function deleteSelected(): Promise<void> {
  const h = selected.value;
  selected.value = null;
  if (h?.id !== undefined) await guide.removeAnnotation(h.id);
}

// ─── Drawer ─────────────────────────────────────────────────────────────

const drawerOpen = ref(false);
const drawerTab = ref<DrawerTab>('contents');

function openDrawer(tab: DrawerTab): void {
  closePopover();
  drawerTab.value = tab;
  drawerOpen.value = true;
}

watch(
  () => reader.value.search,
  (q) => {
    if (reader.value.open && q) openDrawer('search');
  },
);

function onDrawerJump(page: number, rects: Rect[]): void {
  drawerOpen.value = false;
  scrollToPage(page);
  if (rects.length) showFlash(page, rects);
}

// ─── Quest link ─────────────────────────────────────────────────────────

const linkedHere = computed(() => {
  const quest = reader.value.quest;
  return !!quest && links.value[quest.key] === currentPage.value;
});

async function linkHere(): Promise<void> {
  const quest = reader.value.quest;
  if (!quest) return;
  await guide.linkKey(quest.key, currentPage.value);
  showToast(t('shared.ui.guide.linkedToast', { quest: quest.name, page: currentPage.value + 1 }));
}

// ─── Header ─────────────────────────────────────────────────────────────

const crumb = computed(() => {
  const path = guide.sectionPath(currentPage.value);
  return {
    title: path[path.length - 1] ?? t('shared.ui.guide.title'),
    parent: path.length > 1 ? path[path.length - 2] : '',
  };
});

// ─── Toast ──────────────────────────────────────────────────────────────

const toast = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(text: string): void {
  toast.value = text;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = '';
    toastTimer = null;
  }, TOAST_MS);
}

onBeforeUnmount(() => {
  removeBack?.();
  resizeObserver?.disconnect();
  if (scrollFrame) cancelAnimationFrame(scrollFrame);
  if (flashTimer) clearTimeout(flashTimer);
  if (toastTimer) clearTimeout(toastTimer);
});
</script>

<style scoped lang="scss">
.greader {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse at 50% 0%, rgb(60 48 30 / 35%), transparent 60%),
    #120f0b;
  outline: none;
}

.greader__bar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 42px;
  padding: 0 4px;
  background: rgb(14 12 9 / 96%);
  color: var(--skyrim-text-primary);

  &--top {
    border-bottom: 1px solid var(--skyrim-border-dark);
  }

  &--bottom {
    border-top: 1px solid var(--skyrim-border-dark);
    padding-bottom: env(safe-area-inset-bottom);
  }
}

.greader__btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--skyrim-text-secondary);

  &:disabled {
    opacity: 0.35;
  }

  &--on {
    color: var(--skyrim-accent-main-light, #e5c44d);
    background: rgb(201 162 39 / 14%);
  }
}

.greader__where {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  padding: 0 4px;
}

.greader__crumb {
  overflow: hidden;
  color: var(--skyrim-text-dim);
  font-size: 11px;
  letter-spacing: 0.05em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.greader__section {
  overflow: hidden;
  color: var(--skyrim-text-accent);
  font-family: var(--font-heading, serif);
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.greader__pageno {
  flex-shrink: 0;
  padding: 4px 8px;
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 12px;
  background: none;
  color: var(--skyrim-text-accent);
  font-size: 13px;
  font-variant-numeric: tabular-nums;

  small {
    color: var(--skyrim-text-dim);
  }
}

.greader__goto input {
  width: 72px;
  padding: 5px 8px;
  border: 1px solid var(--skyrim-accent-main);
  border-radius: 12px;
  background: var(--skyrim-bg-dark);
  color: var(--skyrim-text-accent);
  font-size: 16px;
  text-align: center;
}

.greader__scroller {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
}

.greader__content {
  position: relative;
  margin: 0 auto;
  will-change: transform;
}

.greader__palette,
.greader__popover {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 50px;
  z-index: 2;
  padding: 6px 8px;
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 6px;
  background: rgb(20 17 12 / 96%);
  box-shadow: 0 4px 16px rgb(0 0 0 / 60%);
}

.greader__palette {
  display: flex;
  align-items: center;
  gap: 8px;
}

.greader__hint {
  flex: 1;
  color: var(--skyrim-text-secondary);
  font-size: 12px;
}

.greader__popover-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.greader__swatch {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;

  &--amber { background: #f2c230; }
  &--green { background: #5cc46a; }
  &--blue { background: #4f96f0; }
  &--rose { background: #f0607e; }

  &--on {
    border-color: var(--skyrim-text-accent);
    box-shadow: 0 0 0 2px rgb(0 0 0 / 60%) inset;
  }
}

.greader__note {
  width: 100%;
  margin-top: 6px;
  padding: 7px 9px;
  border: 1px solid var(--skyrim-border-medium);
  border-radius: 4px;
  background: var(--skyrim-bg-dark);
  color: var(--skyrim-text-accent);
  font-size: 16px;
}

.greader__flex {
  flex: 1;
}

.greader__quest {
  max-width: 34%;
  overflow: hidden;
  padding-left: 6px;
  color: var(--skyrim-text-accent);
  font-family: var(--font-heading, serif);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.greader__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  padding: 5px 9px;
  border: 1px solid var(--skyrim-accent-main-dim);
  border-radius: 14px;
  background: rgb(201 162 39 / 10%);
  color: var(--skyrim-accent-main-light, #e5c44d);
  font-size: 12px;
  white-space: nowrap;

  &--on {
    border-color: transparent;
    background: none;
    color: var(--skyrim-text-secondary);
  }
}

.greader__scrim {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: rgb(0 0 0 / 45%);
}

.greader__toast {
  position: absolute;
  left: 50%;
  top: 52px;
  z-index: 4;
  max-width: 86%;
  margin: 0;
  padding: 7px 14px;
  transform: translateX(-50%);
  border-radius: 16px;
  background: rgb(30 26 18 / 95%);
  color: var(--skyrim-text-accent);
  font-size: 13px;
  box-shadow: 0 2px 10px rgb(0 0 0 / 50%);
  pointer-events: none;
}

.greader-enter-active,
.greader-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.greader-enter-from,
.greader-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.greader-fade-enter-active,
.greader-fade-leave-active {
  transition: opacity 0.18s ease;
}

.greader-fade-enter-from,
.greader-fade-leave-to {
  opacity: 0;
}

.greader-drawer-enter-active,
.greader-drawer-leave-active {
  transition: transform 0.2s ease;
}

.greader-drawer-enter-from,
.greader-drawer-leave-to {
  transform: translateX(100%);
}
</style>
