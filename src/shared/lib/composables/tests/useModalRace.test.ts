import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { useModal } from '../useModal';

describe('useModal close/open race', () => {
  it('keeps the new content when a modal opens right after a close', () => {
    vi.useFakeTimers();
    const A = defineComponent({ name: 'A', render: () => null });
    const B = defineComponent({ name: 'B', render: () => null });
    const modal = useModal();
    modal.openModal({ component: A });
    modal.closeModal();
    vi.advanceTimersByTime(100);
    modal.openModal({ component: B, props: { x: 1 } });
    vi.advanceTimersByTime(400);
    expect(modal.isOpen.value).toBe(true);
    expect(modal.modalComponent.value).toBe(B);
    expect(modal.modalProps.value).toEqual({ x: 1 });
    modal.closeModal();
    vi.advanceTimersByTime(400);
    expect(modal.modalComponent.value).toBeNull();
    vi.useRealTimers();
  });
});
