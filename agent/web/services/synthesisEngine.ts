// ───────────────────────────────────────────────────────────────
// COSMOS · synthesisEngine
// Deterministic archetypal synthesis. No randomness — the same
// instant always yields the same reading, so it feels like a
// reading of *the moment*, not a generator.
// ───────────────────────────────────────────────────────────────

import type {
  CycleState,
  MomentReading,
  WeatherData,
  UserProfile,
} from '@/types/cosmos';
import { moonInfoPublic } from './astronomyEngine';

// Element/quality lexicon keyed off the active tropical sign.
const SIGN_THEME: Record<string, { element: string; verb: string; shadow: string }> = {
  Aries: { element: 'fire', verb: 'ignite', shadow: 'impatience' },
  Taurus: { element: 'earth', verb: 'consolidate', shadow: 'stubbornness' },
  Gemini: { element: 'air', verb: 'connect', shadow: 'scattering' },
  Cancer: { element: 'water', verb: 'shelter', shadow: 'withdrawal' },
  Leo: { element: 'fire', verb: 'radiate', shadow: 'pride' },
  Virgo: { element: 'earth', verb: 'refine', shadow: 'over-criticism' },
  Libra: { element: 'air', verb: 'balance', shadow: 'indecision' },
  Scorpio: { element: 'water', verb: 'transmute', shadow: 'control' },
  Sagittarius: { element: 'fire', verb: 'seek', shadow: 'restlessness' },
  Capricorn: { element: 'earth', verb: 'build', shadow: 'rigidity' },
  Aquarius: { element: 'air', verb: 'reimagine', shadow: 'detachment' },
  Pisces: { element: 'water', verb: 'dissolve', shadow: 'escapism' },
};

const MOON_TENOR: Record<string, string> = {
  New: 'a seeding quiet, intentions still underground',
  'Waxing Crescent': 'first momentum, fragile but real',
  'First Quarter': 'a decision point asking for commitment',
  'Waxing Gibbous': 'refinement under rising pressure',
  Full: 'full illumination, everything visible at once',
  'Waning Gibbous': 'the turn toward sharing what was gathered',
  'Last Quarter': 'release and honest reckoning',
  'Waning Crescent': 'rest, surrender, the composting of the cycle',
};

const WEATHER_TONE = (w?: WeatherData): string => {
  if (!w) return 'the local air unmeasured';
  if (w.code >= 95) return 'charged, storm-lit air outside';
  if (w.code >= 61) return 'rain softening the edges of the day';
  if (w.code >= 45) return 'a veiled, fog-held atmosphere';
  if (w.cloudCover > 70) return 'a low grey ceiling overhead';
  if (!w.isDay) return 'night air and a darkened sky';
  return 'open, clear-skied conditions';
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed)) % arr.length];
}

export function synthesize(
  cycles: CycleState[],
  weather: WeatherData | undefined,
  date: Date,
  _profile?: UserProfile,
): MomentReading {
  const tropical = cycles.find((c) => c.id === 'tropical');
  const tzolkin = cycles.find((c) => c.id === 'tzolkin');
  const nak = cycles.find((c) => c.id === 'nakshatra');
  const age = cycles.find((c) => c.id === 'precession');

  const signName = tropical?.label.split(' ')[0] ?? 'Aries';
  const theme = SIGN_THEME[signName] ?? SIGN_THEME.Aries;
  const moon = moonInfoPublic(date);
  const moonTenor = MOON_TENOR[moon.name] ?? '';
  const weatherTone = WEATHER_TONE(weather);

  const seed = Math.floor(date.getTime() / 60000); // changes per minute

  const headlines = [
    `A ${theme.element} hour that wants to ${theme.verb}.`,
    `The moment leans ${theme.element}: time to ${theme.verb}.`,
    `Quiet instruction in the air — ${theme.verb}, don't force.`,
  ];

  const body =
    `The Sun moves through ${tropical?.label ?? '—'}, ` +
    `coloring the hour with the impulse to ${theme.verb}. ` +
    `The Moon offers ${moonTenor}. ` +
    `Sidereally the sky reads ${nak?.label ?? '—'}, ` +
    `and the long arc still turns within the ${age?.label ?? '—'}. ` +
    `In the Maya count it is ${tzolkin?.label ?? '—'}. ` +
    `Around you: ${weatherTone}. ` +
    `These layers rhyme more than they argue — let the smallest cycle ` +
    `(the breath, the hour) carry the intention the largest ones are too slow to show.`;

  return {
    headline: pick(headlines, seed),
    body,
    shadow: `Watch for ${theme.shadow} — the ${theme.element} drive overspent.`,
    focus: `Optimal focus: ${theme.verb} one concrete thing while the ${moon.name.toLowerCase()} moon holds ${(moon.illum * 100).toFixed(0)}% light.`,
    tags: [signName, moon.name, nak?.label ?? '', tzolkin?.label ?? ''].filter(Boolean),
  };
}
