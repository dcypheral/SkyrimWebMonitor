<template>
  <Teleport to="body">
    <Transition name="app-toast">
      <div
        v-if="current"
        :key="current.id"
        class="app-toast"
        :class="`app-toast--${current.kind}`"
        role="status"
        aria-live="polite"
        @click="hide"
      >
        {{ current.text }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '@/shared/lib/composables/useToast';

const { current, hide } = useToast();
</script>

<style scoped lang="scss">
.app-toast {
  position: fixed;
  top: calc(10px + env(safe-area-inset-top));
  left: 50%;
  z-index: calc(var(--z-modal) + 10);
  max-width: calc(100% - 32px);
  padding: 8px 14px;
  background: rgb(14 14 14 / 95%);
  border: 1px solid var(--skyrim-border-medium);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 14px rgb(0 0 0 / 60%);
  font-size: var(--font-size-sm);
  color: var(--skyrim-text-primary);
  text-align: center;
  transform: translateX(-50%);

  &--error {
    border-color: #b8664e;
    color: #f0c2b4;
  }

  &--success {
    border-color: var(--skyrim-accent-main);
  }
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -6px);
}
</style>
