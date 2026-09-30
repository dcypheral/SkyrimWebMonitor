import { describe, expect, it } from 'vitest';
import type { LocalMapResultData } from '@/api/websocket';
import { bandAnchor, bandOf, decodeLocalMap, localAreaKey } from '../lib/localMap';

function b64(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function le32(values: number[], signed: boolean): Uint8Array {
  const buf = new ArrayBuffer(values.length * 4);
  const view = new DataView(buf);
  values.forEach((v, i) => (signed ? view.setInt32(i * 4, v, true) : view.setUint32(i * 4, v, true)));
  return new Uint8Array(buf);
}

const sample = (isInterior = true): LocalMapResultData => ({
  key: 'c:0x1', isInterior, name: 'Hall', cellFormId: '0x00000001', worldspace: null,
  minX: -100, minY: 0, minZ: 0, maxX: 100, maxY: 100, maxZ: 400,
  vertexCount: 4, triangleCount: 3, truncated: false,
  // Three vertices at z=0 and one at z=400.
  vertices: b64(le32([-100, 0, 0, 100, 0, 0, 0, 100, 0, 0, 100, 400], true)),
  // Second triangle points past the vertex list and must be dropped.
  triangles: b64(le32([0, 1, 2, 0, 1, 9, 1, 2, 3], false)),
  edges: b64(new Uint8Array([0b101, 0, 0b010])),
  doors: [{ x: 1, y: 2, z: 3, name: 'Riverwood' }],
});

describe('local map', () => {
  it('decodes vertices, triangles and edge bits', () => {
    const g = decodeLocalMap(sample());
    expect(Array.from(g.vertices.slice(0, 3))).toEqual([-100, 0, 0]);
    expect(Array.from(g.triangles)).toEqual([0, 1, 2, 1, 2, 3]);
    expect(Array.from(g.edges)).toEqual([0b101, 0b010]);
    expect(g.triangleZ[1]).toBeCloseTo(400 / 3);
    expect(g.doors[0].name).toBe('Riverwood');
  });

  it('keys interiors by cell and exteriors by cell grid', () => {
    expect(localAreaKey({ x: 5, y: 5, isInterior: true, cellFormId: '0xA', worldspaceFormId: null })).toBe('c:0xA');
    expect(localAreaKey({ x: 4095, y: -1, isInterior: false, cellFormId: '0xB', worldspaceFormId: '0x3C' })).toBe('w:0x3C:0:-1');
    expect(localAreaKey({ x: 4096, y: 0, isInterior: false, cellFormId: null, worldspaceFormId: '0x3C' })).toBe('w:0x3C:1:0');
    expect(localAreaKey(null)).toBeNull();
  });

  it('bands floors inside, not outside', () => {
    const inside = decodeLocalMap(sample(true));
    expect(bandOf(inside, 0, 0)).toBe('floor');
    expect(bandOf(inside, 0, 400)).toBe('below');
    expect(bandOf(inside, 0, -400)).toBe('above');
    const outside = decodeLocalMap(sample(false));
    expect(bandOf(outside, 0, 400)).toBe('floor');
    expect(bandAnchor(44)).toBe(0);
    expect(bandAnchor(46)).toBe(90);
  });
});
