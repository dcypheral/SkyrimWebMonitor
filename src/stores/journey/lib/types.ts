/**
 * Hero's journey: sessions, path segments and notes.
 *
 * World coordinates are Skyrim units (about 1.43 cm each; 70 units ≈ 1 m).
 * Path points are stored as whole units, which is far finer than any map
 * zoom can show.
 */

/** One sample of the player's position, as the recorder sees it. */
export interface JourneySample {
  /** ms since epoch */
  t: number;
  x: number;
  y: number;
  /** Map worldspace the point belongs to (null = no map, e.g. interiors). */
  worldspace: string | null;
  isInterior: boolean;
  /** Interior cell name, if any. */
  cell: string | null;
}

export type SessionEventKind = 'level' | 'objective' | 'quest' | 'location' | 'discovery' | 'note';

export interface SessionEvent {
  /** ms since epoch */
  t: number;
  kind: SessionEventKind;
  text: string;
  /** Extra context, e.g. quest name for an objective, note id for a note, marker type for a discovery. */
  detail?: string;
  /** Map position (discoveries): worldspace and world units. */
  worldspace?: string;
  x?: number;
  y?: number;
}

export interface JourneySession {
  /** = startedAt; unique per device. */
  id: number;
  startedAt: number;
  /** Last time data arrived for this session. */
  endedAt: number;
  /** Time with data flowing (gaps longer than a minute are not counted). */
  activeMs: number;
  /** Distance travelled on foot/horse in world units (fast travel excluded). */
  distance: number;
  startLevel: number | null;
  endLevel: number | null;
  events: SessionEvent[];
  /** Optional player-given title. */
  title: string;
  /** Stored path points (after thinning). */
  pointCount: number;
  /** Next free segment number for this session's path. */
  segments: number;
}

/**
 * A stored slice of one continuous path segment. A segment breaks on fast
 * travel, load doors and long gaps; long segments are split into chunks of
 * at most CHUNK_POINTS points. Consecutive chunks of one segment share their
 * joining point, so drawing them one after another gives a continuous line.
 */
export interface PathChunk {
  /** `${sessionId}:${segment}:${seq}` (zero padded, sorts in order). */
  key: string;
  sessionId: number;
  segment: number;
  seq: number;
  worldspace: string;
  /** Flat [x0, y0, x1, y1, …] in whole world units. */
  points: Int32Array;
}

export interface JourneyNote {
  /** = createdAt; unique per device. */
  id: number;
  sessionId: number | null;
  createdAt: number;
  updatedAt: number;
  text: string;
  /** Map worldspace of the pin; null when the note has no map position. */
  worldspace: string | null;
  x: number;
  y: number;
  /** Interior or place name at the time of writing. */
  place: string | null;
  hasPhoto: boolean;
  photoWidth?: number;
  photoHeight?: number;
  photoSource?: 'device' | 'game';
}

export interface NotePhoto {
  noteId: number;
  blob: Blob;
}
