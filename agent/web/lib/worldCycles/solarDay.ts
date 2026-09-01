// ───────────────────────────────────────────────────────────────
// Solar-day frame for sunrise-anchored time systems.
//
// Several cultural sub-day systems (Hindu ghaṭi, Chinese kè in its
// classical use, the Hebrew ritual day) do NOT count from midnight —
// they count from sunrise, and their "hours" are seasonal: the unit
// stretches in summer and compresses in winter, because it divides
// the real interval of daylight (or of the full sunrise→sunrise day)
// rather than a fixed 24h.
//
// This module derives sunrise / sunset / solar noon for a civil day
// at the observer's location, reusing the existing solar math in
// lib/cosmic/math (no new dependency), and exposes a single helper
// that turns "now" into a normalized position within the relevant
// solar frame. Sub-day plugins read from this so their rings breathe.
// ───────────────────────────────────────────────────────────────

import { sunAltitudeDeg, solarNoonLocal } from "../cosmic/math";
import { lstDeg } from "../starmap";

/** Standard refraction-corrected sunrise/sunset altitude (deg). */
const SUNRISE_ALT_DEG = -0.833;

/**
 * Find the sunrise or sunset instant by bisecting the half-day on the correct
 * side of solar noon. This is robust to UTC-vs-host-local mismatch because it
 * brackets off the longitude-correct solar noon rather than host midnight.
 * Returns null when the sun never crosses the horizon in that half (polar).
 */
function findCrossing(
  solarNoon: Date,
  lat: number,
  lon: number,
  rising: boolean,
): Date | null {
  const noonAlt = sunAltitudeDeg(solarNoon, lat, lon, lstDeg);
  // Edge of the half-day, 12h before (rising) or after (setting) noon.
  const edge = new Date(solarNoon.getTime() + (rising ? -1 : 1) * 12 * 3600_000);
  const edgeAlt = sunAltitudeDeg(edge, lat, lon, lstDeg);
  // A crossing of SUNRISE_ALT_DEG exists only if noon is above and edge below.
  if (!(noonAlt > SUNRISE_ALT_DEG && edgeAlt < SUNRISE_ALT_DEG)) return null;

  let lo = rising ? edge.getTime() : solarNoon.getTime();
  let hi = rising ? solarNoon.getTime() : edge.getTime();
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const alt = sunAltitudeDeg(new Date(mid), lat, lon, lstDeg);
    const above = alt > SUNRISE_ALT_DEG;
    // Between edge(below) and noon(above): keep the sub-interval that straddles.
    if (rising ? above : !above) hi = mid;
    else lo = mid;
  }
  return new Date((lo + hi) / 2);
}

export type SolarFrame = {
  /** UTC instant of sunrise on the observer's civil day. */
  sunrise: Date;
  /** UTC instant of sunset on the observer's civil day. */
  sunset: Date;
  /** UTC instant of local solar noon. */
  solarNoon: Date;
  /** Daylight length in ms (sunset − sunrise). */
  dayLengthMs: number;
  /** Night length in ms (next sunrise − sunset). */
  nightLengthMs: number;
  /** True if the sun never rises/sets on this day at this latitude. */
  polar: boolean;
};

/**
 * Resolve the solar frame for the civil day containing `date` at (lat, lon).
 * `date` is any instant; we take its LOCAL civil Y-M-D (host-local, which the
 * caller aligns to the viewer's timezone upstream) to bound the day.
 *
 * At extreme latitudes the sun may not cross the horizon; we flag `polar`
 * and fall back to a fixed 24h frame so downstream never divides by zero.
 */
export function resolveSolarFrame(date: Date, lat: number, lon: number): SolarFrame {
  const solarNoon = solarNoonLocal(date, lon);

  const rise = findCrossing(solarNoon, lat, lon, true);
  const set = findCrossing(solarNoon, lat, lon, false);

  let polar = rise === null || set === null;
  let sunrise: Date = rise ?? new Date(solarNoon.getTime() - 6 * 3600_000);
  let sunset: Date = set ?? new Date(solarNoon.getTime() + 6 * 3600_000);
  if (!polar && !(sunset.getTime() > sunrise.getTime())) polar = true;

  if (polar) {
    // Fixed 12h/12h fallback centered on solar noon — keeps ratios finite.
    sunrise = new Date(solarNoon.getTime() - 6 * 3600_000);
    sunset = new Date(solarNoon.getTime() + 6 * 3600_000);
  }

  const dayLengthMs = sunset.getTime() - sunrise.getTime();
  const nightLengthMs = 86_400_000 - dayLengthMs;

  return { sunrise, sunset, solarNoon, dayLengthMs, nightLengthMs, polar };
}

/**
 * Position of `now` within the sunrise→sunrise day, as a fraction [0, 1).
 * 0 at sunrise, wrapping at the next sunrise. This is the frame Hindu
 * ghaṭi (60 per day) and the Hebrew ritual day divide.
 */
export function sunriseDayFraction(now: Date, frame: SolarFrame): number {
  const dayMs = 86_400_000;
  const offset = now.getTime() - frame.sunrise.getTime();
  return ((offset % dayMs) + dayMs) % dayMs / dayMs;
}

/**
 * Position within the DAYLIGHT arc [0,1) when the sun is up, else null.
 * Systems that split daytime and night into separate equal counts
 * (classical 百刻 usage, seasonal "temporal hours") read this.
 */
export function daylightFraction(now: Date, frame: SolarFrame): number | null {
  const t = now.getTime();
  if (t < frame.sunrise.getTime() || t >= frame.sunset.getTime()) return null;
  return (t - frame.sunrise.getTime()) / frame.dayLengthMs;
}
