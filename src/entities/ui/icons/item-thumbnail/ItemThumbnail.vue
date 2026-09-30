<template>
  <div
    ref="root"
    class="item-thumbnail"
    :class="{ 'item-thumbnail--enchanted': enchanted, 'item-thumbnail--rendered': !!url }"
    :style="{ '--thumb-size': `${size}px`, '--thumb-glow': ENCHANTED_GLOW_COLOR }"
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { BaseIcon } from '@/shared/ui';
import { ENCHANTED_GLOW_COLOR, getItemMaterial } from '@/shared/lib/constants/itemMaterials';
import type { ThumbnailFraming } from '@/shared/lib/nif';
import { useItemThumbnailsStore } from '@/stores/item-thumbnails/useItemThumbnailsStore';

interface Props {
  /** Category icon shown until (or instead of) the 3D render. */
  fallbackIconPath: string;
  modelPath?: string | null;
  keywords?: readonly string[] | null;
  enchanted?: boolean;
  /** Box size in px; the 3D render fills it, the fallback icon uses ~75%. */
  size?: number;
  framing?: ThumbnailFraming;
}

const props = withDefaults(defineProps<Props>(), {
  modelPath: null,
  keywords: null,
  enchanted: false,
  size: 32,
  framing: 'diagonal',
});

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
