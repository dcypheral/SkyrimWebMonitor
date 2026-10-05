import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { deleteDB } from 'idb';
import { OUTLINE, PAGE_COUNT } from '@/shared/lib/guide/tests/fixtures';
import { useGuideStore } from '../useGuideStore';
import * as db from '../lib/guideDb';

const FP = 'abc-123';

async function seedGuide(): Promise<void> {
  await db.writeFile({ blob: new Blob(['%PDF']), fp: FP, name: 'guide.pdf', size: 4, lastModified: 0, addedAt: 0 });
  await db.writeMeta({ fp: FP, pageCount: PAGE_COUNT, outline: OUTLINE, pageWidth: 500, pageHeight: 700, indexedPages: 0, lastPage: 7 });
}

describe('useGuideStore', () => {
  beforeEach(async () => {
    await db.resetGuideDbForTests();
    await deleteDB('strategy-guide');
    setActivePinia(createPinia());
  });

  it('reports no guide when none was picked', async () => {
    const guide = useGuideStore();
    await guide.init();
    expect(guide.status).toBe('none');
    expect(guide.matchFor({ name: 'Unbound', questType: 'MainQuest' })).toBeNull();
  });

  it('restores a saved guide and matches quests to bookmarks', async () => {
    await seedGuide();
    const guide = useGuideStore();
    await guide.init();
    expect(guide.status).toBe('ready');
    expect(guide.fileName).toBe('guide.pdf');
    expect(guide.lastPage).toBe(7);

    const crown = guide.matchFor({ name: 'The Jagged Crown', questType: 'CivilWar', questEditorId: 'CW03' });
    expect(crown).toMatchObject({ source: 'bookmark', page: 21 });
    expect(crown?.alternatives).toEqual([{ page: 24, title: 'Stormcloak: The Jagged Crown' }]);

    const misc = guide.matchFor({ name: '', questType: 'Miscellaneous', isMisc: true, questEditorId: 'FF01' });
    expect(misc).toMatchObject({ source: 'section', page: 28 });
  });

  it('lets a player link override the bookmark, and persists it', async () => {
    await seedGuide();
    const guide = useGuideStore();
    await guide.init();
    const quest = { name: 'The Jagged Crown', questType: 'CivilWar', questEditorId: 'CW03' };
    await guide.linkQuest(quest, 25);
    const linked = guide.matchFor(quest);
    expect(linked).toMatchObject({ source: 'link', page: 25 });
    expect(linked?.alternatives.map((a) => a.page)).toEqual([21, 24]);

    setActivePinia(createPinia());
    const again = useGuideStore();
    await again.init();
    expect(again.matchFor(quest)?.page).toBe(25);
    await again.unlinkQuest(quest);
    expect(again.matchFor(quest)?.source).toBe('bookmark');
  });

  it('stores bookmarks and highlights', async () => {
    await seedGuide();
    const guide = useGuideStore();
    await guide.init();
    await guide.addBookmark(13, 'Bleak Falls Barrow');
    const h = await guide.addHighlight(13, [0.1, 0.2, 0.3, 0.05], 'amber');
    expect(h?.id).toBeTypeOf('number');
    if (h?.kind === 'highlight') await guide.updateAnnotation({ ...h, note: 'Claw door', color: 'blue' });

    setActivePinia(createPinia());
    const again = useGuideStore();
    await again.init();
    const kinds = again.annotations.map((a) => a.kind).sort();
    expect(kinds).toEqual(['bookmark', 'highlight']);
    const saved = again.annotations.find((a) => a.kind === 'highlight');
    expect(saved).toMatchObject({ note: 'Claw door', color: 'blue', rect: [0.1, 0.2, 0.3, 0.05] });
    if (saved?.id !== undefined) await again.removeAnnotation(saved.id);
    expect(again.annotations).toHaveLength(1);
  });

  it('names sections for pages', async () => {
    await seedGuide();
    const guide = useGuideStore();
    await guide.init();
    expect(guide.sectionTitle(14)).toBe('Bleak Falls Barrow');
    expect(guide.sectionPath(22)).toEqual(['Quests', 'Civil War Quests', 'Imperial: The Jagged Crown']);
  });
});
