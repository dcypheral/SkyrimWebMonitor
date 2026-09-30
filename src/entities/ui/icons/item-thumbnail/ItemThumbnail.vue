<template>
  <div
    ref="root"
    class="item-thumbnail"
    :class="{
      'item-thumbnail--enchanted': enchanted,
      'item-thumbnail--rendered': !!url,
      'item-thumbnail--expandable': canExpand,
    }"
    :style="{ '--thumb-size': `${size}px`, '--thumb-glow': ENCHANTED_GLOW_COLOR }"
    :role="canExpand ? 'button' : undefined"
    :tabindex="canExpand ? 0 : undefined"
    :aria-label="canExpand ? t('shared.ui.viewer.open', { name }) : undefined"
    @click="expand"
  >
    <img
      v-if="url"
      :src="url"
      :width="size"
      :height="size"
      alt=""
      decoding="async"
      class="item-thumbnail__image"
    >
    <base-icon
      v-else
      :icon-path="fallbackIconPath"
      :size="iconSize"
      :background-color="material.color"
    />
    <span
      v-if="canExpand"
      class="item-thumbnail__badge"
      aria-hidden="true"
    >3D</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { BaseIcon } from '@/shared/ui';
import { ENCHANTED_GLOW_COLOR, getItemMaterial } from '@/shared/lib/constants/itemMaterials';
import type { ThumbnailFraming } from '@/shared/lib/nif';
import { useItemThumbnailsStore } from '@/stores/item-thumbnails/useItemThumbnailsStore';
import { useI18n } from 'vue-i18n';
import { useModelViewer } from '../model-viewer/useModelViewer';

interface Props {
  /** Category icon shown until (or instead of) the 3D render. */
  fallbackIconPath: string;
  modelPath?: string | null;
  keywords?: readonly string[] | null;
  enchanted?: boolean;
  /** Box size in px; the 3D render fills it, the fallback icon uses ~75%. */
  size?: number;
  framing?: ThumbnailFraming;
  /** Tap opens the fullscreen 3D viewer (large previews). */
  expandable?: boolean;
  /** Item name for the viewer title. */
  name?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelPath: null,
  keywords: null,
  enchanted: false,
  size: 32,
  framing: 'diagonal',
  expandable: false,
  name: '',
});

const { t } = useI18n();
const modelViewer = useModelViewer();

const store = useItemThumbnailsStore();
const root = ref<HTMLElement | null>(null);
const isVisible = ref(false);
let observer: IntersectionObserver | null = null;

const material = computed(() => getItemMaterial(props.keywords));
const iconSize = computed(() => Math.round(props.size * 0.75));
const source = computed(() => ({
  modelPath: props.modelPath,
  keywords: props.keywords,
  framing: props.framing,
}));
const url = computed(() => store.urlFor(source.value));

/** Only offered once a render worked, so the viewer will too. */
const canExpand = computed(() => props.expandable && !!props.modelPath && !!url.value);

function expand(): void {
  if (!canExpand.value || !props.modelPath) return;
  modelViewer.open({ modelPath: props.modelPath, name: props.name, keywords: props.keywords, framing: props.framing });
}

function requestIfVisible(): void {
  if (isVisible.value && props.modelPath) store.request(source.value);
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !root.value) {
    isVisible.value = true;
    requestIfVisible();
    return;
  }
  // Only render what the user can see; long lists stay cheap.
  observer = new IntersectionObserver(
    (entries) => {
      isVisible.value = entries.some((entry) => entry.isIntersecting);
      requestIfVisible();
    },
    { rootMargin: '120px' },
  );
  observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());

watch(source, requestIfVisible);
</script>

<style scoped lang="scss">
.item-thumbnail {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--thumb-size);
  height: var(--thumb-size);

  // Fallback icon scales with the box (the box can be resized by the parent).
  :deep(.base-icon) {
    width: 75%;
    height: 75%;
  }

  &__image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    animation: item-thumbnail-in var(--transition-fast, 150ms) ease-out;
  }

  &--expandable {
    position: relative;
    cursor: zoom-in;
  }

  &__badge {
    position: absolute;
    right: 2px;
    bottom: 2px;
    padding: 0 5px;
    background: rgb(0 0 0 / 65%);
    border: 1px solid var(--skyrim-border-medium);
    border-radius: 999px;
    font-family: var(--font-heading);
    font-size: 0.56rem;
    letter-spacing: 0.08em;
    color: var(--skyrim-text-secondary);
    pointer-events: none;
  }

  &--enchanted {
    filter: drop-shadow(0 0 3px var(--thumb-glow));
  }

  &--enchanted.item-thumbnail--rendered {
    filter: drop-shadow(0 0 2px var(--thumb-glow)) drop-shadow(0 0 6px color-mix(in srgb, var(--thumb-glow) 55%, transparent));
  }
}

@keyframes item-thumbnail-in {
  from {
    opacity: 0;
    transform: scale(0.92);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
