import { describe, expect, it } from 'vitest';
import { hasTravelled } from '../../lib/fastTravel';

describe('fast travel arrival', () => {
  const at = (x: number, y: number, cellFormId: string | null = '0x1', worldspace: string | null = 'Tamriel') => ({ x, y, cellFormId, worldspace });
  it('ignores walking', () => {
    expect(hasTravelled(at(0, 0), at(1500, 900, '0x2'))).toBe(false);
  });
  it('detects a long jump or a move into another world or interior', () => {
    expect(hasTravelled(at(0, 0), at(40000, 0, '0x9'))).toBe(true);
    expect(hasTravelled(at(0, 0), at(10, 10, '0x7', 'WhiterunWorld'))).toBe(true);
    expect(hasTravelled(at(0, 0, '0x1', null), at(0, 0, '0x5', 'Tamriel'))).toBe(true);
  });
});
