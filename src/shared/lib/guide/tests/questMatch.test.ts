import { describe, it, expect } from 'vitest';
import { matchBookmarks, matchText } from '../questMatch';
import { chapterForQuestType, flattenOutline, outlinePath, questChapters, sectionAt } from '../outline';
import { foldPage } from '../pageText';
import { OUTLINE, PAGE_COUNT, QUEST_HEADER, page } from './fixtures';

describe('outline helpers', () => {
  it('flattens nested bookmarks with parents', async () => {
    const flat = await flattenOutline(
      [{ title: 'A', dest: 'a', items: [{ title: 'B', dest: 'b' }] }, { title: 'C', dest: null }],
      async (dest) => (dest === 'a' ? 1 : dest === 'b' ? 2 : -1),
    );
    expect(flat).toEqual([
      { title: 'A', page: 1, depth: 0, parent: -1 },
      { title: 'B', page: 2, depth: 1, parent: 0 },
      { title: 'C', page: -1, depth: 0, parent: -1 },
    ]);
  });

  it('finds the deepest section covering a page', () => {
    const i = sectionAt(OUTLINE, 14);
    expect(OUTLINE[i]?.title).toBe('Bleak Falls Barrow');
    expect(outlinePath(OUTLINE, i)).toEqual(['Quests', 'Main Quest', 'Bleak Falls Barrow']);
    expect(OUTLINE[sectionAt(OUTLINE, 10)]?.title).toBe('Main Quest');
  });

  it('derives the quest chapter ranges', () => {
    expect(questChapters(OUTLINE, PAGE_COUNT)).toEqual([
      { chapter: 'base', from: 10, to: 30 },
      { chapter: 'dragonborn', from: 30, to: 40 },
    ]);
    expect(chapterForQuestType('DLC01_Vampire')).toBe('dawnguard');
    expect(chapterForQuestType('DLC02_Dragonborn')).toBe('dragonborn');
    expect(chapterForQuestType('SideQuest')).toBe('base');
  });
});

describe('matchBookmarks', () => {
  it('matches titles with "Act I:" style prefixes removed', () => {
    expect(matchBookmarks({ name: 'Unbound', questType: 'MainQuest' }, OUTLINE, PAGE_COUNT).map((m) => m.page)).toEqual([11]);
    expect(matchBookmarks({ name: 'Bleak Falls Barrow', questType: 'MainQuest' }, OUTLINE, PAGE_COUNT)[0]?.page).toBe(13);
  });

  it('returns both sides of a shared quest', () => {
    const found = matchBookmarks({ name: 'The Jagged Crown', questType: 'CivilWar' }, OUTLINE, PAGE_COUNT);
    expect(found.map((m) => m.title)).toEqual(['Imperial: The Jagged Crown', 'Stormcloak: The Jagged Crown']);
  });

  it('ignores chapter titles and pages outside quest chapters', () => {
    expect(matchBookmarks({ name: 'Training', questType: 'SideQuest' }, OUTLINE, PAGE_COUNT)).toEqual([]);
    // "Dragonborn" names both a chapter group and the quest; only the quest entry counts.
    const db = matchBookmarks({ name: 'Dragonborn', questType: 'DLC02_Dragonborn' }, OUTLINE, PAGE_COUNT);
    expect(db[0]?.page).toBe(31);
  });

  it('needs an exact title for short names', () => {
    expect(matchBookmarks({ name: 'Unbond', questType: 'MainQuest' }, OUTLINE, PAGE_COUNT)).toEqual([]);
  });
});

describe('matchText', () => {
  const chapterFooter = 'TRAINING THE INVENTORY QUESTS ATLAS OF SKYRIM';
  const pages = [
    page(33, ['Solstheim side quests overview', 'See Served Cold later.']),
    page(34, [...QUEST_HEADER, 'Speak to Adril Arano about the murder.']),
    page(35, ['The trail leads to the Ashlander camp.'], `SERVED COLD ${chapterFooter}`),
    page(36, [...QUEST_HEADER, 'INTERSECTING QUESTS: Served Cold']),
    page(37, ['More text.'], `MARCH OF THE DEAD ${chapterFooter}`),
  ].map(foldPage);

  it('points at the walkthrough opening of the first spread naming the quest', () => {
    const found = matchText({ name: 'Served Cold', questType: 'DLC02_Dragonborn' }, pages, OUTLINE, PAGE_COUNT);
    expect(found[0]?.page).toBe(34);
  });

  it('falls back to pages that mention the quest when no footer names it', () => {
    const found = matchText({ name: 'Adril Arano', questType: 'DLC02_Dragonborn' }, pages, OUTLINE, PAGE_COUNT);
    expect(found[0]?.page).toBe(34);
  });

  it('finds nothing for unknown names', () => {
    expect(matchText({ name: 'The Lusty Argonian Maid', questType: 'SideQuest' }, pages, OUTLINE, PAGE_COUNT)).toEqual([]);
  });
});
