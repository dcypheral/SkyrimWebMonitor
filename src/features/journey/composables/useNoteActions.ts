/**
 * Opens the note editor / viewer modals from anywhere (home minimap, large
 * map, journal).
 */
import { useModal } from '@/shared/lib';
import { requestMapFocus } from '@/stores/journey/mapFocus';
import { useJourneyStore } from '@/stores/journey/useJourneyStore';
import { useNavigationStore } from '@/stores/use-navigation-store/useNavigationStore';
import NoteEditor from '../ui/note-editor/NoteEditor.vue';
import NoteView from '../ui/note-view/NoteView.vue';

export function useNoteActions() {
  const { openModal, closeModal } = useModal();
  const store = useJourneyStore();
  const nav = useNavigationStore();

  function openNewNote(): void {
    openModal({
      component: NoteEditor,
      props: { note: null },
      ghostClickGuardMs: 300,
      on: { close: closeModal, saved: closeModal },
    });
  }

  function openEditor(id: number): void {
    const note = store.notes.find((n) => n.id === id);
    if (!note) return;
    openModal({
      component: NoteEditor,
      props: { note },
      on: { close: closeModal, saved: closeModal },
    });
  }

  function showOnMap(id: number): void {
    const note = store.notes.find((n) => n.id === id);
    if (!note?.worldspace) return;
    closeModal();
    requestMapFocus(note.worldspace, note.x, note.y);
    nav.setActiveTab('map', false);
    nav.setActiveSubTab('view');
  }

  function openNote(id: number, options: { showMapButton?: boolean } = {}): void {
    const note = store.notes.find((n) => n.id === id);
    if (!note) return;
    openModal({
      component: NoteView,
      props: { note, showMapButton: options.showMapButton ?? true },
      ghostClickGuardMs: 300,
      on: {
        edit: (noteId: number) => openEditor(noteId),
        delete: async (noteId: number) => {
          await store.deleteNote(noteId);
          closeModal();
        },
        map: (noteId: number) => showOnMap(noteId),
      },
    });
  }

  return { openNewNote, openNote, openEditor, showOnMap };
}
