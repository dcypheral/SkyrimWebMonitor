import { describe, expect, it } from 'vitest';
import { getSchoolColor, getSpellIconPath } from '../spellIcons';

describe('getSpellIconPath', () => {
  it('matches effects by keyword', () => {
    expect(getSpellIconPath({ name: 'Flames', categoryType: 'Destruction' })).toBe('lorc/fire-ray.svg');
    expect(getSpellIconPath({ name: 'Frostbite', categoryType: 'Destruction' })).toBe('lorc/ice-bolt.svg');
    expect(getSpellIconPath({ name: 'Chain Lightning', categoryType: 'Destruction' })).toBe('lorc/lightning-storm.svg');
    expect(getSpellIconPath({ name: 'Candlelight', categoryType: 'Alteration' })).toBe('lorc/candle-light.svg');
    expect(getSpellIconPath({ name: 'Conjure Flame Atronach', categoryType: 'Conjuration' })).toBe('lorc/spark-spirit.svg');
  });

  it('uses effect names when the spell name says nothing', () => {
    expect(getSpellIconPath({ name: 'Mystery', categoryType: 'Restoration', effects: [{ name: 'Restore Health' }] })).toBe(
      'delapouite/healing.svg',
    );
  });

  it('falls back to the school icon', () => {
    expect(getSpellIconPath({ name: 'Zzz', categoryType: 'Illusion' })).toBe('delapouite/sparkles.svg');
  });

  it('colours schools', () => {
    expect(getSchoolColor('Destruction')).toBe('#e0784c');
    expect(getSchoolColor(null)).toBe('#b9b2a3');
  });
});
