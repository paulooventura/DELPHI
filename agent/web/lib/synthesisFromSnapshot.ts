// Deterministic moment reading from the main DELPHI cycle engine (cycleSystems + CosmicClockEngine).
// Does not use services/astronomyEngine.ts — one astronomy stack for clock, sky, and moment.

import type { CycleSnapshot, WeatherInfo } from "./cycleSystems";
import type { MomentReading } from "../types/cosmos";

const SIGN_THEME: Record<string, { element: string; verb: string; shadow: string }> = {
  Aries: { element: "fire", verb: "ignite", shadow: "impatience" },
  Taurus: { element: "earth", verb: "consolidate", shadow: "stubbornness" },
  Gemini: { element: "air", verb: "connect", shadow: "scattering" },
  Cancer: { element: "water", verb: "shelter", shadow: "withdrawal" },
  Leo: { element: "fire", verb: "radiate", shadow: "pride" },
  Virgo: { element: "earth", verb: "refine", shadow: "over-criticism" },
  Libra: { element: "air", verb: "balance", shadow: "indecision" },
  Scorpio: { element: "water", verb: "transmute", shadow: "control" },
  Sagittarius: { element: "fire", verb: "seek", shadow: "restlessness" },
  Capricorn: { element: "earth", verb: "build", shadow: "rigidity" },
  Aquarius: { element: "air", verb: "reimagine", shadow: "detachment" },
  Pisces: { element: "water", verb: "dissolve", shadow: "escapism" },
};

const MOON_TENOR: Record<string, string> = {
  New: "a seeding quiet, intentions still underground",
  "New Moon": "a seeding quiet, intentions still underground",
  "Waxing Crescent": "first momentum, fragile but real",
  "First Quarter": "a decision point asking for commitment",
  "Waxing Gibbous": "refinement under rising pressure",
  Full: "full illumination, everything visible at once",
  "Full Moon": "full illumination, everything visible at once",
  "Waning Gibbous": "the turn toward sharing what was gathered",
  "Last Quarter": "release and honest reckoning",
  "Waning Crescent": "rest, surrender, the composting of the cycle",
};

function weatherTone(w?: WeatherInfo): string {
  if (!w) return "the local air unmeasured";
  const c = w.condition.toLowerCase();
  if (c.includes("thunder")) return "charged, storm-lit air outside";
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) {
    return "rain softening the edges of the day";
  }
  if (c.includes("fog")) return "a veiled, fog-held atmosphere";
  if (c.includes("overcast") || c.includes("cloud")) return "a low grey ceiling overhead";
  const hour = new Date().getHours();
  const slot = w.hourly?.[hour];
  if (slot?.isDay === false) return "night air and a darkened sky";
  return "open, clear-skied conditions";
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed)) % arr.length];
}

export function synthesizeFromSnapshot(snapshot: CycleSnapshot, date: Date): MomentReading {
  const signName = snapshot.westernZodiac.sign;
  const theme = SIGN_THEME[signName] ?? SIGN_THEME.Aries;
  const moonPhase = snapshot.lunar.phase;
  const moonTenor = MOON_TENOR[moonPhase] ?? MOON_TENOR[moonPhase.replace(" Moon", "")] ?? "";
  const weatherToneText = weatherTone(snapshot.weather);
  const tzolkin = `${snapshot.tzolkin.tone} ${snapshot.tzolkin.sign} · Kin ${snapshot.tzolkin.kin}`;
  const chinese = `${snapshot.chineseZodiac.element} ${snapshot.chineseZodiac.animal}`;

  const seed = Math.floor(date.getTime() / 60000);

  const headlines = [
    `A ${theme.element} hour that wants to ${theme.verb}.`,
    `The moment leans ${theme.element}: time to ${theme.verb}.`,
    `Quiet instruction in the air — ${theme.verb}, don't force.`,
  ];

  const body =
    `The Sun moves through ${signName} ${snapshot.westernZodiac.symbol}, ` +
    `coloring the hour with the impulse to ${theme.verb}. ` +
    `The Moon offers ${moonTenor}. ` +
    `The season turns through ${snapshot.season.name}; ` +
    `the Chinese count reads ${chinese}. ` +
    `In the Maya Tzolk'in it is ${tzolkin}, ` +
    `within the ${snapshot.mayan.castleName} castle. ` +
    `Around you: ${weatherToneText}. ` +
    `These layers rhyme more than they argue — let the smallest cycle ` +
    `(the breath, the hour) carry the intention the largest ones are too slow to show.`;

  const illumPct = Math.round(snapshot.lunar.fraction * 100);

  return {
    headline: pick(headlines, seed),
    body,
    shadow: `Watch for ${theme.shadow} — the ${theme.element} drive overspent.`,
    focus: `Optimal focus: ${theme.verb} one concrete thing while the ${moonPhase.toLowerCase()} holds ${illumPct}% light.`,
    tags: [signName, moonPhase, snapshot.tzolkin.sign, chinese].filter(Boolean),
  };
}
