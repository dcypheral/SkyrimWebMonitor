/**
 * Alchemy maths for the practice mortar.
 *
 * Skyrim rules this follows:
 *  - A potion gets every effect that at least two of its (up to three)
 *    ingredients share.
 *  - Brewing it teaches each of those effects on every ingredient that
 *    contributed it.
 * Effect magnitudes and gold value depend on skill, perks and game data the
 * plugin does not send, so this predicts effects and lessons, not strength.
 */

export interface AlchemyEffect {
  name: string;
  known: boolean;
}

export interface AlchemyIngredient {
  formId: string;
  name: string;
  count: number;
  effects: readonly AlchemyEffect[];
}

export interface BrewEffect {
  name: string;
  /** formIds of the ingredients that carry it. */
  sources: string[];
  /** Known on at least one contributing ingredient (the player can see it). */
  visible: boolean;
  harmful: boolean;
}

export interface BrewLesson {
  formId: string;
  effect: string;
}

export interface BrewResult {
  effects: BrewEffect[];
  /** Effects the player would learn by brewing this. */
  lessons: BrewLesson[];
  kind: 'potion' | 'poison' | 'mixed' | 'none';
}

export const MAX_INGREDIENTS = 3;

/**
 * English names of harmful vanilla effects. Other languages fall back to
 * `harmful: false`, which only changes the colour and the potion/poison label.
 */
const HARMFUL_PATTERNS: readonly RegExp[] = [
  /^damage /i,
  /^ravage /i,
  /^lingering damage /i,
  /^weakness to /i,
  /^fear$/i,
  /^frenzy$/i,
  /^paralysis$/i,
  /^slow$/i,
  /^Урон /i,
  /^Опустошение /i,
  /^Уязвимость /i,
  /^Страх$/i,
  /^Бешенство$/i,
  /^Паралич$/i,
  /^Замедление$/i,
];

export function isHarmfulEffect(name: string): boolean {
  return HARMFUL_PATTERNS.some((re) => re.test(name.trim()));
}

export function brew(ingredients: readonly AlchemyIngredient[]): BrewResult {
  const byEffect = new Map<string, { sources: AlchemyIngredient[]; known: boolean }>();
  for (const ing of ingredients.slice(0, MAX_INGREDIENTS)) {
    for (const effect of ing.effects) {
      const entry = byEffect.get(effect.name) ?? { sources: [], known: false };
      if (!entry.sources.includes(ing)) entry.sources.push(ing);
      entry.known ||= effect.known;
      byEffect.set(effect.name, entry);
    }
  }

  const effects: BrewEffect[] = [];
  const lessons: BrewLesson[] = [];
  for (const [name, entry] of byEffect) {
    if (entry.sources.length < 2) continue;
    effects.push({
      name,
      sources: entry.sources.map((s) => s.formId),
      visible: entry.known,
      harmful: isHarmfulEffect(name),
    });
    for (const src of entry.sources) {
      const own = src.effects.find((e) => e.name === name);
      if (own && !own.known) lessons.push({ formId: src.formId, effect: name });
    }
  }

  let kind: BrewResult['kind'] = 'none';
  if (effects.length > 0) {
    const harmful = effects.filter((e) => e.harmful).length;
    if (harmful === 0) kind = 'potion';
    else if (harmful === effects.length) kind = 'poison';
    else kind = 'mixed';
  }
  return { effects, lessons, kind };
}

/**
 * Would adding `candidate` to `selected` add a new effect to the brew?
 * With `spoilers` off only effects the player already knows on both sides
 * count, so the hint never reveals an unknown effect.
 */
export function isCompatible(
  selected: readonly AlchemyIngredient[],
  candidate: AlchemyIngredient,
  spoilers: boolean,
): boolean {
  if (selected.length === 0 || selected.length >= MAX_INGREDIENTS) return false;
  if (selected.some((s) => s.formId === candidate.formId)) return false;
  const current = new Set(brew(selected).effects.map((e) => e.name));
  return candidate.effects.some(
    (ce) =>
      (spoilers || ce.known) &&
      !current.has(ce.name) &&
      selected.some((s) => s.effects.some((se) => se.name === ce.name && (spoilers || se.known))),
  );
}

export interface Experiment {
  ingredients: string[];
  lessons: number;
}

/**
 * The pair or trio that teaches the most unknown effects, using only
 * ingredients the player owns. Ties go to fewer ingredients (cheaper).
 */
export function bestExperiment(ingredients: readonly AlchemyIngredient[]): Experiment | null {
  const pool = ingredients.filter((i) => i.count > 0);
  let best: Experiment | null = null;
  const consider = (combo: AlchemyIngredient[]): void => {
    const { lessons } = brew(combo);
    if (lessons.length === 0) return;
    if (
      !best ||
      lessons.length > best.lessons ||
      (lessons.length === best.lessons && combo.length < best.ingredients.length)
    ) {
      best = { ingredients: combo.map((c) => c.formId), lessons: lessons.length };
    }
  };
  for (let a = 0; a < pool.length; a++) {
    for (let b = a + 1; b < pool.length; b++) {
      consider([pool[a], pool[b]]);
      // Trios only when the pair already shares something (keeps it O(n²·k)).
      if (brew([pool[a], pool[b]]).effects.length === 0) continue;
      for (let c = b + 1; c < pool.length; c++) consider([pool[a], pool[b], pool[c]]);
    }
  }
  return best;
}

/** How many of an ingredient's effects the player knows. */
export function knownEffectCount(ingredient: AlchemyIngredient): number {
  return ingredient.effects.filter((e) => e.known).length;
}
