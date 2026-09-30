import { describe, expect, it } from 'vitest';
import { bestExperiment, brew, isCompatible, isHarmfulEffect, type AlchemyIngredient } from '../alchemy';

function ing(formId: string, effects: Array<[string, boolean]>, count = 1): AlchemyIngredient {
  return { formId, name: formId, count, effects: effects.map(([name, known]) => ({ name, known })) };
}

const blueMountain = ing('blue', [
  ['Restore Health', true],
  ['Fortify Conjuration', false],
  ['Fortify Health', false],
  ['Damage Magicka Regen', false],
]);
const wheat = ing('wheat', [
  ['Restore Health', true],
  ['Fortify Health', false],
  ['Damage Stamina Regen', false],
  ['Lingering Damage Magicka', false],
]);
const nightshade = ing('night', [
  ['Damage Health', true],
  ['Damage Magicka Regen', false],
  ['Lingering Damage Stamina', false],
  ['Fortify Destruction', false],
]);

describe('brew', () => {
  it('keeps only effects shared by two or more ingredients', () => {
    const result = brew([blueMountain, wheat]);
    expect(result.effects.map((e) => e.name)).toEqual(['Restore Health', 'Fortify Health']);
    expect(result.kind).toBe('potion');
  });

  it('lists the lessons brewing would teach', () => {
    const result = brew([blueMountain, wheat]);
    expect(result.lessons).toEqual([
      { formId: 'blue', effect: 'Fortify Health' },
      { formId: 'wheat', effect: 'Fortify Health' },
    ]);
    expect(result.effects.find((e) => e.name === 'Fortify Health')?.visible).toBe(false);
  });

  it('labels harmful-only brews as poison and mixes as mixed', () => {
    expect(brew([blueMountain, nightshade]).kind).toBe('poison');
    expect(brew([blueMountain, wheat, nightshade]).kind).toBe('mixed');
  });

  it('returns none when nothing is shared', () => {
    expect(brew([wheat, nightshade]).kind).toBe('none');
  });
});

describe('isHarmfulEffect', () => {
  it('matches vanilla harmful names', () => {
    expect(isHarmfulEffect('Damage Health')).toBe(true);
    expect(isHarmfulEffect('Weakness to Fire')).toBe(true);
    expect(isHarmfulEffect('Restore Health')).toBe(false);
  });
});

describe('isCompatible', () => {
  it('hides unknown matches without spoilers', () => {
    // blue + night share only an unknown effect.
    expect(isCompatible([blueMountain], nightshade, false)).toBe(false);
    expect(isCompatible([blueMountain], nightshade, true)).toBe(true);
  });

  it('uses known matches without spoilers', () => {
    expect(isCompatible([blueMountain], wheat, false)).toBe(true);
  });
});

describe('bestExperiment', () => {
  it('picks the combination that teaches the most', () => {
    const best = bestExperiment([blueMountain, wheat, nightshade]);
    expect(best?.ingredients).toEqual(['blue', 'wheat', 'night']);
    expect(best?.lessons).toBe(4);
  });

  it('ignores ingredients the player does not own', () => {
    expect(bestExperiment([blueMountain, ing('x', [['Fortify Health', false]], 0)])).toBeNull();
  });
});
