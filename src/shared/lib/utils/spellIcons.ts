/**
 * Picks an icon for a spell from its name and effect names (English and
 * Russian keywords). Order matters: specific rules come first. Falls back to
 * the school icon, so modded spells always get something sensible.
 */
import { getMagicSchoolIconPath } from '@/shared/lib/constants/magicSchoolIcons';

interface Rule {
  re: RegExp;
  icon: string;
}

const RULES: readonly Rule[] = [
  // Summons first: "Conjure Flame Atronach" is a summon, not a fire spell.
  { re: /atronach|атронах/i, icon: 'lorc/spark-spirit.svg' },
  { re: /dremora|дремор/i, icon: 'lorc/imp-laugh.svg' },
  // Destruction
  { re: /fire ?storm|incinerat|wall of flames|огненн(ая|ый) (буря|стена)|испепел/i, icon: 'lorc/fire-wave.svg' },
  { re: /fire ?ball|fire ?bolt|огненный (шар|снаряд)/i, icon: 'lorc/fireball.svg' },
  { re: /flame|fire|burn|пламя|огонь|огн/i, icon: 'lorc/fire-ray.svg' },
  { re: /blizzard|ice storm|снежн|ледян(ая|ой) буря|метель/i, icon: 'lorc/frostfire.svg' },
  { re: /ice spike|icy spear|ледян(ой|ое) (шип|копье)/i, icon: 'lorc/ice-spear.svg' },
  { re: /frost|ice|cold|freez|мороз|лед|холод/i, icon: 'lorc/ice-bolt.svg' },
  { re: /storm|chain lightning|гроз|цепная молния/i, icon: 'lorc/lightning-storm.svg' },
  { re: /spark|shock|lightning|thunder|искр|молни|электр/i, icon: 'lorc/lightning-arc.svg' },
  // Restoration
  { re: /turn undead|repel undead|bane of the undead|изгнание нежити|отпугивание нежити/i, icon: 'lorc/holy-symbol.svg' },
  { re: /sun ?fire|stendarr|vampire'?s bane|солнечн/i, icon: 'lorc/sun-radiations.svg' },
  { re: /ward|барьер|оберег/i, icon: 'lorc/magic-shield.svg' },
  { re: /heal|restor|regenerat|close wounds|grand healing|исцел|лечен|восстанов|регенер/i, icon: 'delapouite/healing.svg' },
  // Conjuration
  { re: /soul trap|ловушка душ/i, icon: 'lorc/spiral-bloom.svg' },
  { re: /raise|reanimat|revenant|dead thrall|corpse|воскре|оживлен|труп/i, icon: 'lorc/skull-crossed-bones.svg' },
  { re: /banish|command daedra|expel|изгнан/i, icon: 'lorc/interdiction.svg' },
  { re: /bound (bow|arrow)|призрачный лук/i, icon: 'lorc/pocket-bow.svg' },
  { re: /bound|призрачн(ый|ое|ая) (меч|кинжал|топор|оружие|щит)/i, icon: 'lorc/broadsword.svg' },
  { re: /familiar|wolf|фамильяр|волк/i, icon: 'lorc/wolf-head.svg' },
  { re: /summon|conjure|призыв/i, icon: 'lorc/magic-portal.svg' },
  // Illusion
  { re: /invisib|невидим/i, icon: 'delapouite/invisible.svg' },
  { re: /muffle|приглуш|бесшум/i, icon: 'lorc/footprint.svg' },
  { re: /calm|pacify|harmony|успоко|умирот|гармон/i, icon: 'lorc/dove.svg' },
  { re: /fear|rout|hysteria|страх|паник|истери/i, icon: 'lorc/terror.svg' },
  { re: /fury|frenzy|mayhem|ярост|бешенств|хаос/i, icon: 'delapouite/angry-eyes.svg' },
  { re: /courage|rally|call to arms|храбр|сплочен|призыв к оружию/i, icon: 'lorc/muscle-up.svg' },
  { re: /clairvoyance|ясновиден/i, icon: 'lorc/crystal-ball.svg' },
  // Alteration
  { re: /detect|night eye|обнаруж|ночное зрен/i, icon: 'lorc/eyeball.svg' },
  { re: /candle|magelight|light|свет/i, icon: 'lorc/candle-light.svg' },
  { re: /telekinesis|телекинез/i, icon: 'lorc/magic-palm.svg' },
  { re: /paraly|паралич/i, icon: 'lorc/stoned-skull.svg' },
  { re: /waterbreath|водное дыхание/i, icon: 'lorc/wave-crest.svg' },
  { re: /transmute|трансмут/i, icon: 'lorc/stone-sphere.svg' },
  { re: /equilibrium|равновес/i, icon: 'lorc/embrassed-energy.svg' },
  { re: /mass paralysis|dragonhide|flesh|oakflesh|stoneflesh|ironflesh|ebonyflesh|кож/i, icon: 'lorc/breastplate.svg' },
  { re: /unlock|отпир/i, icon: 'lorc/unlocking.svg' },
];

export function getSpellIconPath(
  spell: { name?: string | null; categoryType?: string | null; effects?: ReadonlyArray<{ name?: string | null }> | null },
): string {
  const text = [spell.name ?? '', ...(spell.effects ?? []).map((e) => e.name ?? '')].join(' ');
  for (const rule of RULES) if (rule.re.test(text)) return rule.icon;
  return getMagicSchoolIconPath(spell.categoryType);
}

/** Accent colour per school (spellbook tiles). */
export const SCHOOL_COLORS: Record<string, string> = {
  Destruction: '#e0784c',
  Restoration: '#f0d27a',
  Alteration: '#6fc2b8',
  Conjuration: '#a58bea',
  Illusion: '#e28ad0',
  Enchanting: '#8fb4ff',
};

export function getSchoolColor(school?: string | null): string {
  return (school && SCHOOL_COLORS[school]) || '#b9b2a3';
}
