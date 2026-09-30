/**
 * Companion mode for dual-screen handhelds (AYN Thor and similar).
 *
 * Android gives the controller to the screen that was touched last. In
 * companion mode the app's window is marked "not focusable": taps still work,
 * but they no longer pull the controller away from the game on the other
 * screen. Text fields need the keyboard, and the keyboard needs focus, so
 * the mode pauses while a text field is in use.
 *
 * Browser/Electron builds: everything here is a no-op.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ref, watch } from 'vue';

interface CompanionModePlugin {
  setPassive(options: { passive: boolean }): Promise<{ passive: boolean }>;
  getState(): Promise<{ passive: boolean }>;
}

const CompanionMode = registerPlugin<CompanionModePlugin>('CompanionMode');

const STORAGE_KEY = 'skyrim-monitor-companion-mode';

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Only meaningful in the Android app. */
export const isCompanionModeSupported = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** User setting (default on). */
export const companionModeEnabled = ref(readEnabled());

/** Number of places that currently need typing (keyboard focus). */
let textHolds = 0;

async function apply(): Promise<void> {
  if (!isCompanionModeSupported) return;
  const passive = companionModeEnabled.value && textHolds === 0;
  try {
    await CompanionMode.setPassive({ passive });
  } catch (err) {
    console.warn('[CompanionMode] setPassive failed', err);
  }
}

export function persistCompanionMode(value: boolean): void {
  companionModeEnabled.value = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* localStorage can be unavailable in restricted WebViews */
  }
}

/**
 * Pause companion mode while typing. Returns the release function.
 * The first tap that pauses it cannot focus the window any more (Android
 * decides focus at touch-down), so the keyboard appears on the next tap.
 */
export function holdTextInput(): () => void {
  textHolds++;
  void apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    textHolds = Math.max(0, textHolds - 1);
    void apply();
  };
}

function isTextField(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    const nonText = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden'];
    return !nonText.includes(el.type) && !el.readOnly && !el.disabled;
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

let installed = false;

/** Call once at app start. */
export function installCompanionMode(): void {
  if (installed || !isCompanionModeSupported) return;
  installed = true;

  // Any text field anywhere pauses the mode while it has DOM focus.
  let releaseField: (() => void) | null = null;
  let releaseTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRelease = (delay: number): void => {
    if (releaseTimer) clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      if (isTextField(document.activeElement)) return;
      releaseField?.();
      releaseField = null;
    }, delay);
  };
  const hold = (target: EventTarget | null): void => {
    if (!isTextField(target)) return;
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    releaseField ??= holdTextInput();
  };
  // pointerdown works even when the page never received DOM focus.
  document.addEventListener(
    'pointerdown',
    (e) => {
      hold(e.target);
      // If the field never gets focus, give the controller back later.
      if (releaseField) scheduleRelease(8000);
    },
    true,
  );
  document.addEventListener('focusin', (e) => hold(e.target));
  // Moving between two fields fires focusout then focusin: wait a moment.
  document.addEventListener('focusout', () => scheduleRelease(250));

  watch(companionModeEnabled, () => void apply(), { immediate: true });
}
