/**
 * Local map: the navmesh floor plan the plugin sends for the player's
 * surroundings (local_map_get). Decoding, area keys and height bands.
 */
import type { LocalMapDoor, LocalMapResultData } from '@/api/websocket';

/** Skyrim exterior cell size in world units. */
export const CELL_SIZE = 4096;
/** Triangles further than this above/below the player are another floor. */
export const FLOOR_BAND = 180;

export interface LocalMapGeometry {
  key: string;
  isInterior: boolean;
  name: string;
  cellFormId: string;
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
  /** x, y, z per vertex. */
  vertices: Int32Array;
  /** a, b, c per triangle. */
  triangles: Uint32Array;
  /** Open-edge bits per triangle (bit i: edge v[i] → v[i+1] is a wall). */
  edges: Uint8Array;
  /** Mean z per triangle. */
  triangleZ: Float32Array;
  doors: LocalMapDoor[];
  truncated: boolean;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function readInt32(bytes: Uint8Array): Int32Array {
  const count = Math.floor(bytes.length / 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, count * 4);
  const out = new Int32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt32(i * 4, true);
  return out;
}

function readUint32(bytes: Uint8Array): Uint32Array {
  const count = Math.floor(bytes.length / 4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, count * 4);
  const out = new Uint32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getUint32(i * 4, true);
  return out;
}

/** Decodes a local_map_get result. Drops triangles that point past the vertex list. */
export function decodeLocalMap(data: LocalMapResultData): LocalMapGeometry {
  const vertices = readInt32(base64ToBytes(data.vertices));
  const rawTriangles = readUint32(base64ToBytes(data.triangles));
  const rawEdges = base64ToBytes(data.edges);
  const vertexCount = Math.floor(vertices.length / 3);

  const keep: number[] = [];
  const triCount = Math.floor(rawTriangles.length / 3);
  for (let t = 0; t < triCount; t++) {
    const a = rawTriangles[t * 3];
    const b = rawTriangles[t * 3 + 1];
    const c = rawTriangles[t * 3 + 2];
    if (a < vertexCount && b < vertexCount && c < vertexCount) keep.push(t);
  }

  const triangles = new Uint32Array(keep.length * 3);
  const edges = new Uint8Array(keep.length);
  const triangleZ = new Float32Array(keep.length);
  keep.forEach((t, i) => {
    for (let k = 0; k < 3; k++) triangles[i * 3 + k] = rawTriangles[t * 3 + k];
    edges[i] = rawEdges[t] ?? 0;
    triangleZ[i] =
      (vertices[triangles[i * 3] * 3 + 2] + vertices[triangles[i * 3 + 1] * 3 + 2] + vertices[triangles[i * 3 + 2] * 3 + 2]) / 3;
  });

  return {
    key: data.key,
    isInterior: data.isInterior,
    name: data.name,
    cellFormId: data.cellFormId,
    bounds: { minX: data.minX, minY: data.minY, minZ: data.minZ, maxX: data.maxX, maxY: data.maxY, maxZ: data.maxZ },
    vertices,
    triangles,
    edges,
    triangleZ,
    doors: Array.isArray(data.doors) ? data.doors : [],
    truncated: data.truncated,
  };
}

export interface AreaPosition {
  x: number;
  y: number;
  isInterior: boolean;
  cellFormId: string | null;
  worldspaceFormId: string | null;
}

/**
 * Which local map the player needs: the interior cell, or the exterior
 * cell they stand in (the plugin sends that cell and its neighbours).
 */
export function localAreaKey(p: AreaPosition | null | undefined): string | null {
  if (!p) return null;
  if (p.isInterior) return p.cellFormId ? `c:${p.cellFormId}` : null;
  if (!p.worldspaceFormId || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return `w:${p.worldspaceFormId}:${Math.floor(p.x / CELL_SIZE)}:${Math.floor(p.y / CELL_SIZE)}`;
}

export type Band = 'below' | 'floor' | 'above';

/**
 * Height band per triangle relative to the player. Exteriors are one band:
 * hills are not floors.
 */
export function bandOf(geometry: LocalMapGeometry, triangle: number, playerZ: number): Band {
  if (!geometry.isInterior) return 'floor';
  const dz = geometry.triangleZ[triangle] - playerZ;
  if (dz > FLOOR_BAND) return 'above';
  if (dz < -FLOOR_BAND) return 'below';
  return 'floor';
}

/** Player z snapped so the bands are rebuilt only on real height changes. */
export function bandAnchor(playerZ: number): number {
  return Math.round(playerZ / (FLOOR_BAND / 2)) * (FLOOR_BAND / 2);
}
