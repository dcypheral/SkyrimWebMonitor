import { ref, computed, watch } from 'vue';
import { useWebSocketStore } from '@/stores/use-websocket-store/useWebsocketStore';
import { useModal } from '@/shared/lib/composables/useModal';
import { useHotkeysStore } from '@/stores/hotkeys/useHotkeysStore';
import { HotkeyPickerModal } from '@/shared/ui';
import type { ShoutItem } from '@/stores/magic/lib/types';

export function useMagicShoutActions(shoutsList: () => ShoutItem[]) {
  const wsStore = useWebSocketStore();
  const hotkeysStore = useHotkeysStore();
  const { closeModal, openModal } = useModal();

  const activeShout = ref<string | null>(null);

  const activeShoutData = computed(() => {
    if (!activeShout.value) return null;
    return shoutsList().find((s) => s.formId === activeShout.value) || null;
  });

  function equipShout(formId: string) {
    const shout = shoutsList().find((s) => s.formId === formId);
    if (!shout) return;

    if (shout.isEquipped) {
      wsStore.sendCommand({ command: 'unequip_shout', formId });
    } else {
      wsStore.sendCommand({ command: 'equip_shout', formId });
    }
  }

  function toggleFavorite() {
    if (!activeShout.value) return;
    wsStore.sendCommand({ command: 'favorite_shout', formId: activeShout.value });
  }

  function openHotkeyPicker() {
    if (!activeShout.value || !activeShoutData.value) return;
    const formId = activeShout.value;
    const itemName = activeShoutData.value.name;
    // Open at once with what the app knows; the refresh updates the grid.
    hotkeysStore.refreshFromGame();
    const currentSlot = hotkeysStore.getSlotForFormId(formId);

    openModal({
      component: HotkeyPickerModal,
      props: {
        currentSlot,
        itemName,
        formId,
      },
      on: {
        select: (slot: number) => {
          hotkeysStore.toggle(slot, { kind: 'spell', formId, name: itemName, spellType: 'Shout', school: 'None', cost: 0, level: 0, chargeTime: 0 });
          closeModal();
        },
      },
    });
  }

  // Automatically select the first shout when the list becomes available,
  // or fall back to the previous neighbour when the active shout disappears.
  let previousList: ShoutItem[] = [];
  watch(
    () => shoutsList(),
    (newList) => {
      const list = newList || [];

      if (list.length === 0) {
        previousList = [];
        return;
      }

      if (!activeShout.value) {
        activeShout.value = list[0].formId;
        previousList = list.slice();
        return;
      }

      const stillExists = list.some(shout => shout.formId === activeShout.value);
      if (!stillExists) {
        // Fall back to the previous neighbour in the old list that still exists.
        const oldIndex = previousList.findIndex(shout => shout.formId === activeShout.value);
        let fallback: string | null = null;
        if (oldIndex > 0) {
          for (let i = oldIndex - 1; i >= 0; i--) {
            const candidate = previousList[i].formId;
            if (list.some(shout => shout.formId === candidate)) {
              fallback = candidate;
              break;
            }
          }
        }
        activeShout.value = fallback ?? list[0].formId;
      }

      previousList = list.slice();
    },
    { immediate: true }
  );

  return {
    activeShout,
    activeShoutData,
    equipShout,
    toggleFavorite,
    openHotkeyPicker,
  };
}
