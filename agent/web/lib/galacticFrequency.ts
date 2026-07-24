/**
 * 13:20 Galactic Frequency — 13 Tones of Creation × 20 Tribes of Time.
 * Each Tone and Tribe carries three code words: power · action · essence.
 * Together they form the 260-kin synchronization matrix used on DELPHI.
 */

export type GalacticCodeWords = {
  power: string;
  action: string;
  essence: string;
};

export type CreationTone = {
  tone: number;
  name: string;
  code: GalacticCodeWords;
};

export type TribeOfTime = {
  index: number; // 0–19
  color: "Red" | "White" | "Blue" | "Yellow";
  name: string;
  /** Classic Maya day sign (Yucatec) paired to this tribe */
  mayaSign: string;
  code: GalacticCodeWords;
};

/** Dot-and-bar style label helpers live in cosmicAssets; names/code words here. */
export const CREATION_TONES: CreationTone[] = [
  { tone: 1, name: "Magnetic", code: { power: "Unify", action: "Attract", essence: "Purpose" } },
  { tone: 2, name: "Lunar", code: { power: "Polarize", action: "Stabilize", essence: "Challenge" } },
  { tone: 3, name: "Electric", code: { power: "Activate", action: "Bond", essence: "Service" } },
  { tone: 4, name: "Self-Existing", code: { power: "Define", action: "Measure", essence: "Form" } },
  { tone: 5, name: "Overtone", code: { power: "Empower", action: "Command", essence: "Radiance" } },
  { tone: 6, name: "Rhythmic", code: { power: "Organize", action: "Balance", essence: "Equality" } },
  { tone: 7, name: "Resonant", code: { power: "Channel", action: "Inspire", essence: "Attunement" } },
  { tone: 8, name: "Galactic", code: { power: "Harmonize", action: "Model", essence: "Integrity" } },
  { tone: 9, name: "Solar", code: { power: "Pulse", action: "Realize", essence: "Intention" } },
  { tone: 10, name: "Planetary", code: { power: "Perfect", action: "Produce", essence: "Manifestation" } },
  { tone: 11, name: "Spectral", code: { power: "Dissolve", action: "Release", essence: "Liberation" } },
  { tone: 12, name: "Crystal", code: { power: "Dedicate", action: "Universalize", essence: "Cooperation" } },
  { tone: 13, name: "Cosmic", code: { power: "Endure", action: "Transcend", essence: "Presence" } },
];

export const TRIBES_OF_TIME: TribeOfTime[] = [
  { index: 0, color: "Red", name: "Dragon", mayaSign: "Imix", code: { power: "Nurture", action: "Being", essence: "Birth" } },
  { index: 1, color: "White", name: "Wind", mayaSign: "Ik", code: { power: "Communicate", action: "Breath", essence: "Spirit" } },
  { index: 2, color: "Blue", name: "Night", mayaSign: "Akbal", code: { power: "Dream", action: "Intuition", essence: "Abundance" } },
  { index: 3, color: "Yellow", name: "Seed", mayaSign: "Kan", code: { power: "Target", action: "Flowering", essence: "Awareness" } },
  { index: 4, color: "Red", name: "Serpent", mayaSign: "Chikchan", code: { power: "Survive", action: "Instinct", essence: "Life Force" } },
  { index: 5, color: "White", name: "Worldbridger", mayaSign: "Kimi", code: { power: "Equalize", action: "Opportunity", essence: "Death" } },
  { index: 6, color: "Blue", name: "Hand", mayaSign: "Manik", code: { power: "Know", action: "Healing", essence: "Accomplishment" } },
  { index: 7, color: "Yellow", name: "Star", mayaSign: "Lamat", code: { power: "Beautify", action: "Art", essence: "Elegance" } },
  { index: 8, color: "Red", name: "Moon", mayaSign: "Muluk", code: { power: "Purify", action: "Flow", essence: "Universal Water" } },
  { index: 9, color: "White", name: "Dog", mayaSign: "Ok", code: { power: "Love", action: "Loyalty", essence: "Heart" } },
  { index: 10, color: "Blue", name: "Monkey", mayaSign: "Chuen", code: { power: "Play", action: "Illusion", essence: "Magic" } },
  { index: 11, color: "Yellow", name: "Human", mayaSign: "Eb", code: { power: "Influence", action: "Wisdom", essence: "Free Will" } },
  { index: 12, color: "Red", name: "Skywalker", mayaSign: "Ben", code: { power: "Explore", action: "Wakefulness", essence: "Space" } },
  { index: 13, color: "White", name: "Wizard", mayaSign: "Ix", code: { power: "Enchant", action: "Receptivity", essence: "Timelessness" } },
  { index: 14, color: "Blue", name: "Eagle", mayaSign: "Men", code: { power: "Create", action: "Mind", essence: "Vision" } },
  { index: 15, color: "Yellow", name: "Warrior", mayaSign: "Kib", code: { power: "Question", action: "Fearlessness", essence: "Intelligence" } },
  { index: 16, color: "Red", name: "Earth", mayaSign: "Kaban", code: { power: "Evolve", action: "Synchronicity", essence: "Navigation" } },
  { index: 17, color: "White", name: "Mirror", mayaSign: "Etznab", code: { power: "Reflect", action: "Order", essence: "Endlessness" } },
  { index: 18, color: "Blue", name: "Storm", mayaSign: "Kawak", code: { power: "Catalyze", action: "Energy", essence: "Self-Generation" } },
  { index: 19, color: "Yellow", name: "Sun", mayaSign: "Ajaw", code: { power: "Enlighten", action: "Life", essence: "Universal Fire" } },
];

export type GalacticDayReading = {
  kin: number;
  tone: CreationTone;
  tribe: TribeOfTime;
  /** Guiding line: Tone power + Tribe action */
  affirmation: string;
  /** Compact label for UI */
  label: string;
  /** 13:20 frequency note */
  frequencyNote: string;
};

export function creationToneByNumber(tone: number): CreationTone {
  const t = Math.max(1, Math.min(13, Math.round(tone)));
  return CREATION_TONES[t - 1]!;
}

export function tribeByMayaSign(sign: string): TribeOfTime {
  const found = TRIBES_OF_TIME.find(
    (tribe) => tribe.mayaSign.toLowerCase() === sign.trim().toLowerCase(),
  );
  return found ?? TRIBES_OF_TIME[0]!;
}

export function tribeByIndex(index: number): TribeOfTime {
  const i = ((Math.round(index) % 20) + 20) % 20;
  return TRIBES_OF_TIME[i]!;
}

/**
 * Dreamspell 13:20 kin from a Gregorian civil date — INDEPENDENT of the Maya GMT
 * correlation. Two properties define it, both authored into the Dreamspell system by
 * José Argüelles (1987), and neither shared with the Long Count Tzolk'in:
 *
 *   1. Its own anchor: 26 July 2013 = Kin 164 (Yellow Galactic Seed), the well-known
 *      "Galactic Seed year" Dreamspell New Year.
 *   2. Its own leap rule: 29 February is a "day out of time" (Hunab Ku 0.0) that carries
 *      NO kin, so the count does not advance across it. Every Feb-29 between the anchor
 *      and the target shifts the count by one.
 *
 * This is deliberately NOT derived from the Tzolk'in plugin — changing the Maya
 * correlation dropdown must not move the 13:20 reading.
 */
const DREAMSPELL_ANCHOR = { y: 2013, m: 7, d: 26, kin: 164 } as const;

function civilDayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Count 29-Feb civil days in the half-open interval (fromDay, toDay] (signed). */
function feb29Between(fromDay: number, toDay: number): number {
  if (toDay < fromDay) return -feb29Between(toDay, fromDay);
  let count = 0;
  const fromY = new Date(fromDay * 86400000).getUTCFullYear();
  const toY = new Date(toDay * 86400000).getUTCFullYear();
  for (let y = fromY; y <= toY; y++) {
    if (!isLeapYear(y)) continue;
    const leap = civilDayNumber(y, 2, 29);
    if (leap > fromDay && leap <= toDay) count += 1;
  }
  return count;
}

export function dreamspellKinFromDate(y: number, m: number, d: number): number {
  const anchorDay = civilDayNumber(DREAMSPELL_ANCHOR.y, DREAMSPELL_ANCHOR.m, DREAMSPELL_ANCHOR.d);
  const targetDay = civilDayNumber(y, m, d);
  // Kin-advancing steps = calendar days minus the leap days the count skips over.
  const steps = targetDay - anchorDay - feb29Between(anchorDay, targetDay);
  return (((DREAMSPELL_ANCHOR.kin - 1 + steps) % 260) + 260) % 260 + 1;
}

export function galacticDayFromKin(kin: number): GalacticDayReading {
  const k = Math.max(1, Math.min(260, Math.round(kin)));
  const tone = creationToneByNumber(((k - 1) % 13) + 1);
  const tribe = tribeByIndex((k - 1) % 20);
  return {
    kin: k,
    tone,
    tribe,
    affirmation: `${tone.code.power} through ${tribe.code.action} — ${tribe.color} ${tribe.name}, Tone ${tone.tone} ${tone.name}.`,
    label: `Kin ${k} · ${tone.name} ${tribe.color} ${tribe.name}`,
    frequencyNote:
      "13 tones × 20 tribes = the 13:20 frequency of synchronization — power, action, and essence braided into one kin.",
  };
}

export function formatCodeWords(code: GalacticCodeWords): string {
  return `${code.power} · ${code.action} · ${code.essence}`;
}
