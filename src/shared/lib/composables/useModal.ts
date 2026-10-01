import { shallowRef, ref, type Component } from 'vue';
import type { ModalOptions } from '@/shared/lib/types';

const isOpen = ref(false);
const modalComponent = shallowRef<Component | null>(null);
const modalProps = ref<Record<string, unknown>>({});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modalHandlers = ref<Record<string, (...args: any[]) => unknown>>({});
const openedAtMs = ref(0);
const ghostClickGuardMs = ref(0);
const placement = ref<'center' | 'top'>('center');
let onCloseCallback: (() => void) | null = null;
/** Clears the closed modal's content after the close animation. */
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

function openModal(options: ModalOptions) {
  // A modal opened within 300 ms of a close must not lose its content to the
  // previous close's cleanup (that left an empty, thin modal frame).
  if (cleanupTimer) {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }
  modalComponent.value = options.component;
  modalProps.value = options.props ?? {};
  modalHandlers.value = options.on ?? {};
  openedAtMs.value = performance.now();
  ghostClickGuardMs.value = Math.max(0, options.ghostClickGuardMs ?? 0);
  placement.value = options.placement ?? 'center';
  isOpen.value = true;
  onCloseCallback = options.onClose ?? null;
}

function closeModal() {
  isOpen.value = false;
  ghostClickGuardMs.value = 0;
  if (onCloseCallback && typeof onCloseCallback === 'function') {
    onCloseCallback();
    onCloseCallback = null;
  }
  if (cleanupTimer) clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => {
    cleanupTimer = null;
    if (isOpen.value) return;
    modalComponent.value = null;
    modalProps.value = {};
    modalHandlers.value = {};
  }, 300);
}

export function useModal() {
  return {
    isOpen,
    modalComponent,
    modalProps,
    modalHandlers,
    openedAtMs,
    ghostClickGuardMs,
    placement,
    openModal,
    closeModal,
  };
}
