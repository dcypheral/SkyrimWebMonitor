import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const sendCommand = vi.fn();
vi.mock('@/stores/use-websocket-store/useWebsocketStore', () => ({
  useWebSocketStore: () => ({ sendCommand }),
}));

import { triggerCommand, useHotkeysStore } from '../useHotkeysStore';
import type { HotkeyBinding } from '../lib/types';

const potion: HotkeyBinding = {
  kind: 'item', formId: '0xP', name: 'Potion', categoryType: 'Potion', count: 3, weight: 0.5, value: 20, isFavorite: false,
};

describe('app hotkeys 9-16', () => {
  beforeEach(() => {
    localStorage.clear();
    sendCommand.mockReset();
    setActivePinia(createPinia());
  });

  it('exposes 16 slots', () => {
    expect(useHotkeysStore().allSlots.map((s) => s.slot)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it('binds app slots locally and persists them', () => {
    const store = useHotkeysStore();
    store.bind(12, potion);
    expect(sendCommand).not.toHaveBeenCalled();
    expect(store.getSlotForFormId('0xP')).toBe(12);
    setActivePinia(createPinia());
    expect(useHotkeysStore().getSlotForFormId('0xP')).toBe(12);
  });

  it('sends game commands for slots 1-8', () => {
    useHotkeysStore().bind(3, potion);
    expect(sendCommand).toHaveBeenCalledWith({ command: 'hotkey_set', formId: '0xP', slot: 3 });
  });

  it('moves a form between slots and toggles off on the same slot', () => {
    const store = useHotkeysStore();
    store.bind(10, potion);
    store.toggle(11, potion);
    expect(store.getSlotForFormId('0xP')).toBe(11);
    store.toggle(11, potion);
    expect(store.getSlotForFormId('0xP')).toBeNull();
  });

  it('maps app slots to direct commands', () => {
    expect(triggerCommand({ ...potion, slot: 9, bound: true })).toEqual({ command: 'use', formId: '0xP' });
    expect(
      triggerCommand({ kind: 'spell', formId: '0xS', name: 'Flames', spellType: 'Spell', school: 'Destruction', cost: 1, level: 0, chargeTime: 0, slot: 9, bound: true }),
    ).toEqual({ command: 'equip_spell', formId: '0xS', hand: 'right' });
    expect(triggerCommand({ ...potion, slot: 2, bound: true })).toEqual({ command: 'hotkey_trigger', slot: 2 });
  });
});

describe('hotkey hand choice', () => {
  const flames = {
    kind: 'spell' as const, formId: '0xS', name: 'Flames', spellType: 'Spell' as const, school: 'Destruction' as const,
    cost: 1, level: 0, chargeTime: 0, slot: 3, bound: true as const,
  };

  beforeEach(() => {
    localStorage.clear();
    sendCommand.mockReset();
    setActivePinia(createPinia());
  });

  it('uses the game hotkey when no hand is chosen', () => {
    useHotkeysStore().trigger(flames);
    expect(sendCommand).toHaveBeenCalledWith({ command: 'hotkey_trigger', slot: 3 });
  });

  it('equips in the chosen hands and remembers the choice per form', () => {
    const store = useHotkeysStore();
    store.setHands(flames, true, true);
    store.trigger(flames);
    expect(sendCommand.mock.calls.map((c: unknown[]) => c[0])).toEqual([
      { command: 'equip_spell', formId: '0xS', hand: 'left' },
      { command: 'equip_spell', formId: '0xS', hand: 'right' },
    ]);
    setActivePinia(createPinia());
    expect(useHotkeysStore().handFor(flames)).toBe('both');
    // Another form in the same slot does not inherit the choice.
    expect(useHotkeysStore().handFor({ ...flames, formId: '0xT' })).toBeNull();
  });

  it('ignores the hand for items that cannot choose one', () => {
    const store = useHotkeysStore();
    const entry = { ...potion, slot: 9, bound: true as const };
    store.setHands(entry, true, false);
    store.trigger(entry);
    expect(sendCommand).toHaveBeenCalledWith({ command: 'use', formId: '0xP' });
  });
});
