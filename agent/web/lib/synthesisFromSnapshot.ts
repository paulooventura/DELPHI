// Deterministic zeitgeist from the main DELPHI cycle engine — one phrase blending all cultural layers.

import type { CycleSnapshot, WeatherInfo } from "./cycleSystems";
import { formatCodeWords } from "./galacticFrequency";
import type { MomentReading } from "../types/cosmos";

const SIGN_QUALITY: Record<string, { element: string; quality: string; verb: string; shadow: string }> = {
  Aries: { element: "fire", quality: "pioneering heat", verb: "ignite", shadow: "rash haste" },
  Taurus: { element: "earth", quality: "rooted patience", verb: "consolidate", shadow: "inertia" },
  Gemini: { element: "air", quality: "restless curiosity", verb: "connect", shadow: "scattered talk" },
  Cancer: { element: "water", quality: "tidal memory", verb: "shelter", shadow: "retreat" },
  Leo: { element: "fire", quality: "solar courage", verb: "radiate", shadow: "pride" },
  Virgo: { element: "earth", quality: "precise care", verb: "refine", shadow: "nitpicking" },
  Libra: { element: "air", quality: "harmonic balance", verb: "weigh", shadow: "indecision" },
  Scorpio: { element: "water", quality: "magnetic depth", verb: "transmute", shadow: "control" },
  Sagittarius: { element: "fire", quality: "aimed truth", verb: "seek", shadow: "restlessness" },
  Capricorn: { element: "earth", quality: "mountain discipline", verb: "build", shadow: "rigidity" },
  Aquarius: { element: "air", quality: "electric vision", verb: "reimagine", shadow: "detachment" },
  Pisces: { element: "water", quality: "dissolving empathy", verb: "dream", shadow: "escapism" },
};

const MOON_MOOD: Record<string, string> = {
  New: "a sealed seed beneath the soil",
  "New Moon": "a sealed seed beneath the soil",
  "Waxing Crescent": "a thin blade of intention catching light",
  "First Quarter": "a door half-open, asking commitment",
  "Waxing Gibbous": "pressure polishing what is almost ripe",
  Full: "everything lit at once, nothing hidden",
  "Full Moon": "everything lit at once, nothing hidden",
  "Waning Gibbous": "the harvest shared outward",
  "Last Quarter": "honest release and reckoning",
  "Waning Crescent": "composting the old cycle in silence",
};

const CHINESE_MOOD: Record<string, string> = {
  Rat: "clever beginnings",
  Ox: "slow, sure labor",
  Tiger: "bold crossing",
  Rabbit: "gentle diplomacy",
  Dragon: "mythic charge",
  Snake: "coiled knowing",
  Horse: "kinetic freedom",
  Goat: "artistic softness",
  Monkey: "playful invention",
  Rooster: "sharp announcement",
  Dog: "loyal vigilance",
  Pig: "generous completion",
};

const ELEMENT_MOOD: Record<string, string> = {
  Wood: "growing",
  Fire: "flaring",
  Earth: "settling",
  Metal: "cutting",
  Water: "flowing",
};

function weatherMood(w?: WeatherInfo): string {
  if (!w) return "";
  const c = w.condition.toLowerCase();
  if (c.includes("thunder")) return "storm-charged";
  if (c.includes("rain")) return "rain-washed";
  if (c.includes("fog")) return "veiled";
  if (c.includes("cloud") || c.includes("overcast")) return "muted";
  if (w.isDay === false) return "night-held";
  return "clear-skied";
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed)) % arr.length];
}

/** One-sentence zeitgeist blending all cultural cycle qualities. */
export function synthesizeZeitgeist(snapshot: CycleSnapshot, date: Date): string {
  const sign = snapshot.westernZodiac.sign;
  const sq = SIGN_QUALITY[sign] ?? SIGN_QUALITY.Aries!;
  const moon = MOON_MOOD[snapshot.lunar.phase] ?? MOON_MOOD[snapshot.lunar.phase.replace(" Moon", "")] ?? "lunar drift";
  const chinese = CHINESE_MOOD[snapshot.chineseZodiac.animal] ?? snapshot.chineseZodiac.animal.toLowerCase();
  const element = ELEMENT_MOOD[snapshot.chineseZodiac.element] ?? snapshot.chineseZodiac.element.toLowerCase();
  const galactic = snapshot.galactic;
  const tone = galactic.tone;
  const tribe = galactic.tribe;
  const season = snapshot.season.name.toLowerCase();
  const castle = snapshot.mayan.castleName;
  const weather = weatherMood(snapshot.weather);
  const seed = Math.floor(date.getTime() / 60000);

  const phrases = [
    `${sq.quality} meets ${moon}: ${element} ${snapshot.chineseZodiac.animal} energy (${chinese}) and Kin ${galactic.kin} ${tribe.color} ${tribe.name} (${tone.name} tone — ${tone.code.power}) pull you to ${sq.verb} — ${season} in the ${castle},${weather ? ` ${weather},` : ""} a ${sq.element} zeitgeist.`,
    `The hour wears ${sign} like a ${sq.element} cloak — ${moon}, while the ${snapshot.chineseZodiac.symbol} ${snapshot.chineseZodiac.animal} whispers ${chinese}; 13:20 says ${tone.code.action} through ${tribe.code.action}; ${sq.verb} before the moment turns.`,
    `Zeitgeist: ${sq.verb} with ${sq.quality} — Moon ${snapshot.lunar.phase.toLowerCase()}, ${element} ${chinese}, Mayan ${castle}, Tone ${tone.tone} ${tone.name} (${formatCodeWords(tone.code)}), ${tribe.color} ${tribe.name} (${formatCodeWords(tribe.code)}).`,
    `Between ${season} and ${castle}, ${sign}'s ${sq.quality} collides with ${moon}; Kin ${galactic.kin} marks the 13:20 pulse — ${galactic.affirmation}`,
  ];

  return pick(phrases, seed);
}

export function synthesizeFromSnapshot(snapshot: CycleSnapshot, date: Date): MomentReading {
  const signName = snapshot.westernZodiac.sign;
  const theme = SIGN_QUALITY[signName] ?? SIGN_QUALITY.Aries!;
  const zeitgeist = synthesizeZeitgeist(snapshot, date);

  return {
    headline: zeitgeist,
    body: "",
    shadow: theme.shadow,
    focus: theme.verb,
    tags: [
      signName,
      snapshot.lunar.phase,
      snapshot.galactic.label,
      `${snapshot.chineseZodiac.element} ${snapshot.chineseZodiac.animal}`,
    ].filter(Boolean),
  };
}
