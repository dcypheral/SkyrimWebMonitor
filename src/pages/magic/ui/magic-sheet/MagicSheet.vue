<template>
  <section
    class="sheet"
    :class="{ 'sheet--open': open }"
    :style="{ '--sheet-color': color }"
  >
    <button
      type="button"
      class="sheet__handle"
      :aria-expanded="open"
      @click="emit('update:open', !open)"
    >
      <base-icon
        :icon-path="icon"
        :size="16"
        :background-color="color"
      />
      <span class="sheet__title">{{ title }}</span>
      <span class="sheet__subtitle">{{ subtitle }}</span>
      <span
        class="sheet__caret"
        :class="{ 'sheet__caret--up': !open }"
        aria-hidden="true"
      />
    </button>

    <div class="sheet__body">
      <dl
        v-if="stats.length"
        class="sheet__stats"
      >
        <div
          v-for="s in stats"
          :key="s.label"
        >
          <dt>{{ s.label }}</dt>
          <dd>{{ s.value }}</dd>
        </div>
      </dl>
      <ul
        v-if="effects.length"
        class="sheet__effects"
      >
        <li
          v-for="(e, i) in effects"
          :key="i"
        >
          {{ e }}
        </li>
      </ul>
      <div class="sheet__actions">
        <slot />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { BaseIcon } from '@/shared/ui';

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    subtitle?: string;
    icon: string;
    color: string;
    stats?: Array<{ label: string; value: string }>;
    /** Plain-text effect descriptions. */
    effects?: string[];
  }>(),
  { subtitle: '', stats: () => [], effects: () => [] },
);

const emit = defineEmits<{ 'update:open': [value: boolean] }>();
</script>

<style scoped lang="scss">
.sheet {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid color-mix(in srgb, var(--sheet-color) 40%, var(--skyrim-border-dark));
  background: linear-gradient(180deg, color-mix(in srgb, var(--sheet-color) 7%, transparent), transparent 60%);
}

.sheet__handle {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 4px var(--spacing-sm);
  background: none;
  border: none;
  color: var(--skyrim-text-primary);
  text-align: left;
  cursor: pointer;
}

.sheet__title {
  overflow: hidden;
  font-family: var(--font-heading);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet__subtitle {
  flex: 1;
  overflow: hidden;
  font-size: 0.66rem;
  color: var(--skyrim-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet__caret {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--skyrim-text-secondary);
  border-bottom: 2px solid var(--skyrim-text-secondary);
  transform: translateY(-2px) rotate(45deg);
  transition: transform var(--transition-fast);

  &--up {
    transform: translateY(2px) rotate(-135deg);
  }
}

.sheet__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 0;
  overflow: hidden;
  padding: 0 var(--spacing-sm);
  transition: max-height var(--transition-normal), padding var(--transition-normal);

  .sheet--open & {
    max-height: 45vh;
    overflow-y: auto;
    padding-bottom: var(--spacing-sm);
  }
}

.sheet__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  font-size: 0.7rem;

  div {
    display: flex;
    gap: 4px;
  }

  dt {
    color: var(--skyrim-text-dim);
  }

  dd {
    margin: 0;
    color: var(--skyrim-text-primary);
  }
}

.sheet__effects {
  margin: 0;
  padding-left: 16px;
  font-size: 0.74rem;
  line-height: 1.35;
  color: var(--skyrim-text-secondary);
}

.sheet__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  :deep(.btn) {
    min-height: 34px;
    padding: 0 var(--spacing-md);
    font-size: 0.7rem;
  }

  :deep(.btn.is-on) {
    border-color: var(--sheet-color);
    color: var(--sheet-color);
  }
}
</style>
