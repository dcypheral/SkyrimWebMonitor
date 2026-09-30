import { describe, expect, it } from 'vitest';
import {
  escapeInline,
  fileStamp,
  formatDistance,
  formatDuration,
  indexMarkdown,
  notesToMarkdown,
  sessionToMarkdown,
  type MarkdownContext,
} from '../lib/markdown';
import type { JourneyNote, JourneySession } from '../lib/types';

const ctx: MarkdownContext = {
  t: (key, params) => [key, ...Object.values(params ?? {}).map(String)].join(' '),
  locale: 'en-GB',
  photoPath: (n) => (n.hasPhoto ? `photos/${String(n.id)}.webp` : null),
};

const start = new Date(2026, 8, 28, 19, 4).getTime();
const session: JourneySession = {
  id: start,
  startedAt: start,
  endedAt: start + 2 * 3600_000,
  activeMs: 2 * 3600_000 + 12 * 60_000,
  distance: 70 * 3400,
  startLevel: 23,
  endLevel: 24,
  events: [
    { t: start + 60_000, kind: 'location', text: 'Bleak Falls Barrow' },
    { t: start + 120_000, kind: 'objective', text: 'Retrieve the *Dragonstone*', detail: 'Bleak Falls' },
  ],
  title: 'Barrow run',
  pointCount: 10,
  segments: 1,
};
const note: JourneyNote = {
  id: start + 5,
  sessionId: start,
  createdAt: start + 300_000,
  updatedAt: start + 300_000,
  text: 'Draugr everywhere',
  worldspace: 'Tamriel',
  x: 10,
  y: 20,
  place: null,
  hasPhoto: true,
};

describe('markdown export', () => {
  it('formats durations and distances', () => {
    expect(formatDuration(2 * 3600_000 + 12 * 60_000)).toBe('2 h 12 min');
    expect(formatDuration(5 * 60_000)).toBe('5 min');
    expect(formatDistance(70 * 3400)).toBe('3.4 km');
    expect(formatDistance(70 * 250)).toBe('250 m');
  });

  it('builds sortable file stamps', () => {
    expect(fileStamp(start)).toBe('2026-09-28_1904');
  });

  it('escapes markup in game text', () => {
    expect(escapeInline('a*b_c')).toBe('a\\*b\\_c');
  });

  it('writes a session with timeline, notes and photo links', () => {
    const md = sessionToMarkdown(session, [note], ctx);
    expect(md).toContain('# Barrow run');
    expect(md).toContain('journal.md.timeline');
    expect(md).toContain('Retrieve the \\*Dragonstone\\*');
    expect(md).toContain('Draugr everywhere');
    expect(md).toContain(`![journal.md.photo](photos/${String(note.id)}.webp)`);
  });

  it('writes the notes file and the index', () => {
    expect(notesToMarkdown([note], ctx)).toContain('## ');
    const index = indexMarkdown([session], ctx);
    expect(index).toContain('(sessions/2026-09-28_1904.md)');
    expect(index).toContain('(notes.md)');
  });
});
