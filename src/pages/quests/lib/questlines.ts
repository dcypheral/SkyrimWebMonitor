/**
 * Quest lines for grouping the quest list, from the game's quest type.
 */
import type { QuestJournalEntry } from '@/stores/quests/lib/types';

export type Questline =
  | 'main'
  | 'civilWar'
  | 'companions'
  | 'college'
  | 'thieves'
  | 'brotherhood'
  | 'daedric'
  | 'dawnguard'
  | 'dragonborn'
  | 'side'
  | 'misc';

export const QUESTLINE_ORDER: readonly Questline[] = [
  'main',
  'civilWar',
  'companions',
  'college',
  'thieves',
  'brotherhood',
  'daedric',
  'dawnguard',
  'dragonborn',
  'side',
  'misc',
];

/** Accent colour of each quest line's header bar. */
export const QUESTLINE_COLOR: Record<Questline, string> = {
  main: '#c9a227',
  civilWar: '#8fa1b8',
  companions: '#b8743a',
  college: '#6f8fd8',
  thieves: '#7d8f62',
  brotherhood: '#a33a3a',
  daedric: '#a35cb5',
  dawnguard: '#c9c2ad',
  dragonborn: '#4fa292',
  side: '#9a8b70',
  misc: '#6a604c',
};

export function questlineOf(quest: Pick<QuestJournalEntry, 'questType' | 'isMisc'>): Questline {
  if (quest.isMisc) return 'misc';
  const type = quest.questType;
  if (type.startsWith('Main')) return 'main';
  if (type === 'CivilWar') return 'civilWar';
  if (type.startsWith('Companions')) return 'companions';
  if (type === 'MagesGuild') return 'college';
  if (type === 'ThievesGuild') return 'thieves';
  if (type === 'DarkBrotherhood') return 'brotherhood';
  if (type === 'Daedric') return 'daedric';
  if (type.startsWith('DLC01')) return 'dawnguard';
  if (type.startsWith('DLC02')) return 'dragonborn';
  if (type === 'Miscellaneous') return 'misc';
  return 'side';
}

export interface QuestGroup {
  line: Questline;
  quests: QuestJournalEntry[];
}

/** Quests grouped by quest line, lines in story order, names A–Z. */
export function groupByQuestline(quests: readonly QuestJournalEntry[]): QuestGroup[] {
  const groups = new Map<Questline, QuestJournalEntry[]>();
  for (const q of quests) {
    const line = questlineOf(q);
    const list = groups.get(line);
    if (list) list.push(q);
    else groups.set(line, [q]);
  }
  return QUESTLINE_ORDER.filter((line) => groups.has(line)).map((line) => ({
    line,
    quests: (groups.get(line) ?? []).sort(
      (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name),
    ),
  }));
}

/** List label: misc entries are named by their open objective. */
export function questLabel(quest: QuestJournalEntry): string {
  if (quest.isMisc) {
    const open = quest.steps.find((s) => !s.completed && !s.failed) ?? quest.steps[0];
    if (open?.text) return open.text;
  }
  return quest.name;
}
