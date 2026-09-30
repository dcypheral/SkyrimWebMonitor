import { onBeforeUnmount } from 'vue';

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

/**
 * Tap vs. long-press on one element. A long press suppresses the click that
 * follows it, so the two actions never fire together.
 */
export function useLongPress(onTap: () => void, onLongPress: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;
  let longPressed = false;

  function clear(): void {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function onPointerDown(event: PointerEvent): void {
    longPressed = false;
    startX = event.clientX;
    startY = event.clientY;
    clear();
    timer = setTimeout(() => {
      longPressed = true;
      timer = null;
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent): void {
    if (!timer) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_TOLERANCE_PX) clear();
  }

  function onClick(): void {
    if (longPressed) {
      longPressed = false;
      return;
    }
    onTap();
  }

  onBeforeUnmount(clear);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onClick,
  };
}
