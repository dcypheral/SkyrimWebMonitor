import { ref } from 'vue';

export type ToastKind = 'info' | 'error' | 'success';

export interface ToastState {
  id: number;
  text: string;
  kind: ToastKind;
}

/** One short message at a time, shown by <app-toast />. */
const current = ref<ToastState | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;
let nextId = 0;

function show(text: string, kind: ToastKind = 'info', durationMs = 3500): void {
  if (timer) clearTimeout(timer);
  current.value = { id: ++nextId, text, kind };
  timer = setTimeout(() => {
    current.value = null;
    timer = null;
  }, durationMs);
}

function hide(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  current.value = null;
}

export function useToast() {
  return { current, show, hide };
}
