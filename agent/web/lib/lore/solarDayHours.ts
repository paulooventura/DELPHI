/**
 * Sunrise-anchored day partitions used by Heliodrome / resolveMoment.
 *
 * - Planetary hours: classical unequal hours (12 day from sunrise→sunset,
 *   12 night from sunset→next sunrise) with Chaldean cascade.
 * - Muhūrta: 15 day + 15 night unequal parts of the same solar day
 *   (closer to classical ahorātra than fixed 48-min wall-clock slices).
 */

import { computeSolarDayEvents } from "../cosmic/astronomy";
import { MUHURTA_COUNT, normalizeDeg } from "../cosmic/math";

/** Chaldean order for planetary hours. */
export const CHALDEAN_PLANETS = [
  "saturn",
  "jupiter",
  "mars",
  "sun",
  "venus",
  "mercury",
  "moon",
] as const;

export type ChaldeanPlanet = (typeof CHALDEAN_PLANETS)[number];

/** Weekday (0=Sun … 6=Sat) → first daytime hour's planet index in CHALDEAN_PLANETS. */
export const PLANETARY_DAY_RULER_IDX = [3, 6, 2, 5, 1, 4, 0] as const;

export type SolarDayWindow = {
  /** Sunrise that opened the current planetary / muhūrta day. */
  sunrise: Date;
  sunset: Date;
  nextSunrise: Date;
  /** Local weekday (0=Sun) at that sunrise — rulers the first daytime hour. */
  weekdayAtSunrise: number;
};

export type UnequalHourState = {
  /** 0–23 across day (0–11) then night (12–23). */
  hourIndex: number;
  /** Fraction elapsed through the current unequal hour. */
  progress: number;
  planet: ChaldeanPlanet;
  planetIndex: number;
  isDay: boolean;
};

export type UnequalMuhurtaState = {
  /** 0–29 (0–14 day, 15–29 night). */
  index: number;
  progress: number;
  angleDeg: number;
};

function weekdayInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).formatToParts(date);
  const wd = parts.find(p => p.type === "weekday")?.value ?? "";
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[wd] ?? date.getUTCDay();
}

/**
 * Solar window for the planetary day containing `date`.
 * Before today's sunrise → yesterday's sunrise…today's sunrise.
 */
export function solarDayWindow(
  date: Date,
  lat: number,
  lon: number,
  timeZone: string,
): SolarDayWindow {
  const today = computeSolarDayEvents(date, lat, lon);
  let sunrise = today.sunrise;
  let sunset = today.sunset;
  let nextSunrise: Date;

  if (date.getTime() < sunrise.getTime()) {
    const prev = new Date(date.getTime() - 86_400_000);
    const y = computeSolarDayEvents(prev, lat, lon);
    sunrise = y.sunrise;
    sunset = y.sunset;
    nextSunrise = today.sunrise;
  } else {
    const next = new Date(date.getTime() + 86_400_000);
    nextSunrise = computeSolarDayEvents(next, lat, lon).sunrise;
    // Polar / failed set: keep a sane night length.
    if (!(sunset.getTime() > sunrise.getTime())) {
      sunset = new Date(sunrise.getTime() + 12 * 3_600_000);
    }
    if (!(nextSunrise.getTime() > sunset.getTime())) {
      nextSunrise = new Date(sunset.getTime() + 12 * 3_600_000);
    }
  }

  return {
    sunrise,
    sunset,
    nextSunrise,
    weekdayAtSunrise: weekdayInZone(sunrise, timeZone),
  };
}

export function unequalPlanetaryHour(
  date: Date,
  window: SolarDayWindow,
): UnequalHourState {
  const t = date.getTime();
  const rise = window.sunrise.getTime();
  const set = window.sunset.getTime();
  const nextRise = window.nextSunrise.getTime();
  const dayLen = Math.max(1, set - rise);
  const nightLen = Math.max(1, nextRise - set);

  let hourIndex: number;
  let progress: number;
  let isDay: boolean;

  if (t < set) {
    isDay = true;
    const frac = Math.min(1, Math.max(0, (t - rise) / dayLen));
    const f12 = frac * 12;
    hourIndex = Math.min(11, Math.floor(f12));
    progress = f12 - hourIndex;
  } else {
    isDay = false;
    const frac = Math.min(1, Math.max(0, (t - set) / nightLen));
    const f12 = frac * 12;
    const nightH = Math.min(11, Math.floor(f12));
    hourIndex = 12 + nightH;
    progress = f12 - nightH;
  }

  const planetIndex =
    (PLANETARY_DAY_RULER_IDX[window.weekdayAtSunrise]! + hourIndex) % 7;
  return {
    hourIndex,
    progress,
    planet: CHALDEAN_PLANETS[planetIndex]!,
    planetIndex,
    isDay,
  };
}

/**
 * 30 muhūrtas: 15 equal parts sunrise→sunset, 15 equal parts sunset→next sunrise.
 */
export function unequalMuhurta(
  date: Date,
  window: SolarDayWindow,
): UnequalMuhurtaState {
  const t = date.getTime();
  const rise = window.sunrise.getTime();
  const set = window.sunset.getTime();
  const nextRise = window.nextSunrise.getTime();
  const dayLen = Math.max(1, set - rise);
  const nightLen = Math.max(1, nextRise - set);
  const half = MUHURTA_COUNT / 2; // 15

  let index: number;
  let progress: number;

  if (t < set) {
    const frac = Math.min(1, Math.max(0, (t - rise) / dayLen));
    const f = frac * half;
    index = Math.min(half - 1, Math.floor(f));
    progress = f - index;
  } else {
    const frac = Math.min(1, Math.max(0, (t - set) / nightLen));
    const f = frac * half;
    const nightI = Math.min(half - 1, Math.floor(f));
    index = half + nightI;
    progress = f - nightI;
  }

  const angleDeg = normalizeDeg(((index + progress) / MUHURTA_COUNT) * 360);
  return { index, progress, angleDeg };
}
