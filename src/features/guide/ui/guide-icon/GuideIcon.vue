<template>
  <svg
    class="guide-icon"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-for="(d, i) in paths"
      :key="i"
      :d="d"
      :fill="filled && i === 0 ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export type GuideIconName =
  | 'book'
  | 'close'
  | 'contents'
  | 'ribbon'
  | 'marker'
  | 'search'
  | 'zoom-in'
  | 'zoom-out'
  | 'link'
  | 'back'
  | 'trash'
  | 'check'
  | 'file';

const ICONS: Record<GuideIconName, string[]> = {
  book: ['M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5C4.7 19 4 19.7 4 20.5z', 'M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5c.8 0 1.5.7 1.5 1.5z', 'M4 20.5V5.5M20 20.5V5.5'],
  close: ['M6 6l12 12M18 6L6 18'],
  contents: ['M8 6h12M8 12h12M8 18h12', 'M4 6h.01M4 12h.01M4 18h.01'],
  ribbon: ['M7 3h10v18l-5-4-5 4z'],
  marker: ['M14.5 4.5l5 5L10 19H5v-5z', 'M12 7l5 5', 'M4 21h8'],
  search: ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z', 'M15.5 15.5L20 20'],
  'zoom-in': ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z', 'M15.5 15.5L20 20M10.5 8v5M8 10.5h5'],
  'zoom-out': ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z', 'M15.5 15.5L20 20M8 10.5h5'],
  link: ['M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  back: ['M15 5l-7 7 7 7'],
  trash: ['M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4M9 12h6M9 16h6'],
};

const props = withDefaults(defineProps<{ name: GuideIconName; size?: number; filled?: boolean }>(), {
  size: 20,
  filled: false,
});

const paths = computed(() => ICONS[props.name]);
</script>

<style scoped lang="scss">
.guide-icon {
  display: block;
  flex-shrink: 0;
}
</style>
