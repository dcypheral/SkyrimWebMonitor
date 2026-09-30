/**
 * Markdown export of sessions and notes. Pure functions: labels and
 * locale come in from the caller, so they are easy to test and translate.
 */
import { unitsToKm } from './pathRecorder';
import type { JourneyNote, JourneySession, SessionEvent } from './types';

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface MarkdownContext {
  t: Translate;
  locale: string;
  /** Relative path of a note's photo inside the export, or null. */
  photoPath: (note: JourneyNote) => string | null;
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${String(m)} min`;
  return `${String(h)} h ${String(m).padStart(2, '0')} min`;
}

export function formatDistance(units: number): string {
  const km = unitsToKm(units);
  if (km < 1) return `${String(Math.round(km * 1000))} m`;
  return `${km.toFixed(1)} km`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local "YYYY-MM-DD_HHmm" — sorts by time, safe as a file name. */
export function fileStamp(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function sessionFileName(session: JourneySession): string {
  return `${fileStamp(session.startedAt)}.md`;
}

function time(ms: number, locale: string): string {
  return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function date(ms: number, locale: string): string {
  return new Date(ms).toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

/** Escapes characters that would turn note text into Markdown markup. */
export function escapeInline(text: string): string {
  return text.replace(/([\\`*_[\]#|<>])/g, '\\$1');
}

export function sessionTitle(session: JourneySession, ctx: MarkdownContext): string {
  const when = `${date(session.startedAt, ctx.locale)}, ${time(session.startedAt, ctx.locale)}–${time(session.endedAt, ctx.locale)}`;
  return session.title ? `${session.title} — ${when}` : when;
}

export function eventLine(e: SessionEvent, ctx: MarkdownContext): string {
  const at = time(e.t, ctx.locale);
  const text = escapeInline(e.text);
  switch (e.kind) {
    case 'level':
      return `- ${at} — ${ctx.t('journal.md.level', { level: text })}`;
    case 'objective':
      return `- ${at} — ${ctx.t('journal.md.objective', { quest: escapeInline(e.detail ?? ''), objective: text })}`;
    case 'quest':
      return `- ${at} — ${ctx.t('journal.md.quest', { quest: text })}`;
    case 'location':
      return `- ${at} — ${ctx.t('journal.md.entered', { place: text })}`;
    case 'discovery':
      return `- ${at} — ${ctx.t('journal.md.discovered', { place: text })}`;
    case 'note':
      return `- ${at} — ${ctx.t('journal.md.note', { text })}`;
  }
}

export function noteBlock(note: JourneyNote, ctx: MarkdownContext, headingLevel = 3): string {
  const lines: string[] = [];
  const where = note.place ?? (note.worldspace ? `${note.worldspace} (${String(note.x)}, ${String(note.y)})` : '');
  const head = `${date(note.createdAt, ctx.locale)} ${time(note.createdAt, ctx.locale)}${where ? ` · ${escapeInline(where)}` : ''}`;
  lines.push(`${'#'.repeat(headingLevel)} ${head}`, '');
  if (note.text.trim()) lines.push(note.text.trim(), '');
  const photo = ctx.photoPath(note);
  if (photo) lines.push(`![${ctx.t('journal.md.photo')}](${photo})`, '');
  return lines.join('\n');
}

export function sessionToMarkdown(session: JourneySession, notes: readonly JourneyNote[], ctx: MarkdownContext): string {
  const out: string[] = [];
  out.push(`# ${sessionTitle(session, ctx)}`, '');
  const stats = [
    ctx.t('journal.md.played', { time: formatDuration(session.activeMs) }),
    ctx.t('journal.md.walked', { distance: formatDistance(session.distance) }),
  ];
  if (session.startLevel !== null && session.endLevel !== null) {
    stats.push(
      session.startLevel === session.endLevel
        ? ctx.t('journal.md.levelOnly', { level: session.endLevel })
        : ctx.t('journal.md.levelRange', { from: session.startLevel, to: session.endLevel }),
    );
  }
  out.push(stats.join(' · '), '');

  if (session.events.length > 0) {
    out.push(`## ${ctx.t('journal.md.timeline')}`, '');
    for (const e of session.events) out.push(eventLine(e, ctx));
    out.push('');
  }

  const own = notes.filter((n) => n.sessionId === session.id).sort((a, b) => a.createdAt - b.createdAt);
  if (own.length > 0) {
    out.push(`## ${ctx.t('journal.md.notes')}`, '');
    for (const n of own) out.push(noteBlock(n, ctx));
  }
  return out.join('\n').trimEnd() + '\n';
}

export function notesToMarkdown(notes: readonly JourneyNote[], ctx: MarkdownContext): string {
  const out: string[] = [`# ${ctx.t('journal.md.allNotes')}`, ''];
  for (const n of notes.slice().sort((a, b) => a.createdAt - b.createdAt)) out.push(noteBlock(n, ctx, 2));
  return out.join('\n').trimEnd() + '\n';
}

export function indexMarkdown(sessions: readonly JourneySession[], ctx: MarkdownContext): string {
  const sorted = sessions.slice().sort((a, b) => a.startedAt - b.startedAt);
  let distance = 0;
  let active = 0;
  for (const s of sorted) {
    distance += s.distance;
    active += s.activeMs;
  }
  const out = [
    `# ${ctx.t('journal.md.journalTitle')}`,
    '',
    ctx.t('journal.md.totals', {
      sessions: sorted.length,
      time: formatDuration(active),
      distance: formatDistance(distance),
    }),
    '',
    `| ${ctx.t('journal.md.colSession')} | ${ctx.t('journal.md.colPlayed')} | ${ctx.t('journal.md.colWalked')} | ${ctx.t('journal.md.colEvents')} |`,
    '|---|---|---|---|',
  ];
  for (const s of sorted) {
    const name = escapeInline(sessionTitle(s, ctx));
    out.push(
      `| [${name}](sessions/${sessionFileName(s)}) | ${formatDuration(s.activeMs)} | ${formatDistance(s.distance)} | ${String(s.events.length)} |`,
    );
  }
  out.push('', `[${ctx.t('journal.md.allNotes')}](notes.md)`, '');
  return out.join('\n');
}
