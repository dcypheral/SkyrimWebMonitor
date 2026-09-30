import { describe, expect, it } from 'vitest';
import { nextAmmoId } from '../useArcheryLoadout';

describe('nextAmmoId', () => {
  const ammo = [{ formId: 'a' }, { formId: 'b' }, { formId: 'c' }];

  it('moves to the next arrow type', () => {
    expect(nextAmmoId(ammo, 'a')).toBe('b');
  });

  it('wraps around at the end', () => {
    expect(nextAmmoId(ammo, 'c')).toBe('a');
  });

  it('starts at the first when nothing is equipped', () => {
    expect(nextAmmoId(ammo, null)).toBe('a');
  });

  it('returns null without ammo', () => {
    expect(nextAmmoId([], 'a')).toBeNull();
  });
});
