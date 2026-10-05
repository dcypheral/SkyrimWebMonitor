<template>
  <div
    class="gthumb"
    :class="{ 'gthumb--ready': !!url }"
  >
    <img
      v-if="url"
      :src="url"
      alt=""
      draggable="false"
    >
    <span
      v-else
      class="gthumb__page"
    >{{ page + 1 }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useGuideStore } from '@/stores/guide/useGuideStore';
import { pageThumbnail } from '../../lib/pageRenderer';

const props = defineProps<{ page: number }>();

const guide = useGuideStore();
const url = ref<string | null>(null);
let token = 0;

watch(
  () => [props.page, guide.fp, guide.status] as const,
  async ([page, fp, status]) => {
    const mine = ++token;
    url.value = null;
    if (!fp || status !== 'ready' || page < 0) return;
    try {
      const doc = await guide.getDocument();
      const made = await pageThumbnail(doc, fp, page);
      if (mine === token) url.value = made;
    } catch (err) {
      console.warn('[Guide] Thumbnail failed', page, err);
    }
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.gthumb {
  position: relative;
  aspect-ratio: 567 / 780;
  overflow: hidden;
  border-radius: 2px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 6%), transparent 60%),
    #2b261d;
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 60%),
    2px 3px 8px rgb(0 0 0 / 55%);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    animation: gthumb-in 0.25s ease-out;
  }
}

.gthumb__page {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--skyrim-text-dim);
  font-family: var(--font-heading, serif);
}

@keyframes gthumb-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
