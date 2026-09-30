import { formatDistance, formatDuration } from '@/stores/journey/lib/markdown';
import type { JourneySession } from '@/stores/journey/lib/types';

export { formatDistance, formatDuration };

export function sessionDate(session: JourneySession, locale: string): string {
  const start = new Date(session.startedAt);
  const end = new Date(session.endedAt);
  const day = start.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  const t = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${t(start)}–${t(end)}`;
}

export function countEvents(session: JourneySession, kind: JourneySession['events'][number]['kind']): number {
  let n = 0;
  for (const e of session.events) if (e.kind === kind) n++;
  return n;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
