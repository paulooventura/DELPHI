/**
 * Time resolution — local wall-clock → Julian Day (UT).
 *
 * This is where the category's bodies are buried. A birth chart computed with
 * the wrong UTC offset is wrong by hours, which moves the Moon by degrees and
 * the ascendant by a whole sign. Most astrology apps get this wrong.
 *
 * Requires: luxon (historical tzdata), tz-lookup (coords → IANA zone).
 *   npm i luxon tz-lookup
 *   npm i -D @types/luxon
 */

import { DateTime } from "luxon";
import tzLookup from "tz-lookup";

/** JD of the Unix epoch (1970-01-01T00:00:00Z). */
const UNIX_EPOCH_JD = 2440587.5;

/** Gregorian adoption, proleptic default. Britain 1752, Russia 1918 — see below. */
const GREGORIAN_ADOPTION_JD = 2299160.5; // 1582-10-15

export type CalendarSystem = "gregorian" | "julian";

export type ResolvedTime = {
  jd: number;
  instant: Date;
  timeZone: string;
  /** UTC offset actually applied, in minutes. Useful for display + debugging. */
  offsetMinutes: number;
  /** True when the input had no clock time and noon local was substituted. */
  timeIsApproximate: boolean;
  /** True when the date precedes Gregorian adoption in most of Europe. */
  precedesGregorian: boolean;
  warnings: string[];
};

export type BirthInput = {
  /** Local civil date. */
  year: number;
  month: number; // 1–12
  day: number;
  /** Local clock time. Omit hour to signal "birth time unknown". */
  hour?: number;
  minute?: number;
  second?: number;
  lat: number;
  lon: number;
  /** Override zone lookup — use when the user knows better than the coords. */
  timeZone?: string;
  /** Dates before 1582 may be stated in Julian calendar. Default gregorian. */
  calendar?: CalendarSystem;
};

export function jdFromDate(d: Date): number {
  return d.getTime() / 86400000 + UNIX_EPOCH_JD;
}

export function dateFromJd(jd: number): Date {
  return new Date((jd - UNIX_EPOCH_JD) * 86400000);
}

/** IANA zone for coordinates. Throws on invalid coords — caller should catch. */
export function zoneForCoords(lat: number, lon: number): string {
  return tzLookup(lat, lon);
}

/**
 * Resolve a local civil moment to Julian Day, using the tz rules that were
 * actually in force at that place on that date.
 *
 * Handles:
 *   - historical DST rules and zone changes (via luxon + tzdata)
 *   - unknown birth time (substitutes local noon, flags it)
 *   - Julian/Gregorian calendar break
 *   - ambiguous / nonexistent local times at DST transitions
 */
export function resolveBirthTime(input: BirthInput): ResolvedTime {
  const warnings: string[] = [];
  const timeIsApproximate = input.hour === undefined;

  let zone: string;
  if (input.timeZone) {
    zone = input.timeZone;
  } else {
    try {
      zone = zoneForCoords(input.lat, input.lon);
    } catch {
      zone = "UTC";
      warnings.push("Could not determine timezone from coordinates; used UTC.");
    }
  }

  const hour = input.hour ?? 12;
  const minute = input.minute ?? 0;
  const second = input.second ?? 0;

  if (timeIsApproximate) {
    warnings.push(
      "Birth time unknown — local noon substituted. Fast cycles (solar day, " +
        "circadian, lunar sub-day position) are not meaningful for this chart.",
    );
  }

  const calendar = input.calendar ?? "gregorian";
  let { year, month, day } = input;

  // Julian → Gregorian conversion for historical dates stated in old style.
  if (calendar === "julian") {
    const converted = julianToGregorian(year, month, day);
    year = converted.year;
    month = converted.month;
    day = converted.day;
    warnings.push(
      `Input treated as Julian calendar; converted to Gregorian ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}.`,
    );
  }

  let dt = DateTime.fromObject(
    { year, month, day, hour, minute, second },
    { zone },
  );

  // Nonexistent local time (spring-forward gap) — luxon returns invalid.
  if (!dt.isValid) {
    warnings.push(
      `Local time ${hour}:${String(minute).padStart(2, "0")} did not exist in ${zone} on this date (DST transition). Shifted forward one hour.`,
    );
    dt = DateTime.fromObject(
      { year, month, day, hour: hour + 1, minute, second },
      { zone },
    );
  }

  // Ambiguous local time (fall-back overlap). Luxon picks the first occurrence;
  // flag it so the UI can offer the choice.
  const ambiguous = isAmbiguousLocalTime(dt);
  if (ambiguous) {
    warnings.push(
      "This local time occurred twice (DST fall-back). Earlier occurrence used; offset may be off by one hour.",
    );
  }

  const instant = dt.toJSDate();
  const jd = jdFromDate(instant);

  return {
    jd,
    instant,
    timeZone: zone,
    offsetMinutes: dt.offset,
    timeIsApproximate,
    precedesGregorian: jd < GREGORIAN_ADOPTION_JD,
    warnings,
  };
}

/** Detect DST fall-back ambiguity by probing the offset an hour either side. */
function isAmbiguousLocalTime(dt: DateTime): boolean {
  const before = dt.minus({ hours: 1 });
  const after = dt.plus({ hours: 1 });
  return before.offset !== dt.offset && after.offset === dt.offset;
}

/**
 * Convert a Julian-calendar date to the proleptic Gregorian equivalent.
 * Only needed for historical input predating local Gregorian adoption.
 */
export function julianToGregorian(
  year: number,
  month: number,
  day: number,
): { year: number; month: number; day: number } {
  // Julian Day from Julian calendar date (Meeus, ch. 7, no Gregorian correction)
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const jd =
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day -
    1524.5;

  // JD → Gregorian calendar date
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const a = z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const dayOut = b - d - Math.floor(30.6001 * e) + f;
  const monthOut = e < 14 ? e - 1 : e - 13;
  const yearOut = monthOut > 2 ? c - 4716 : c - 4715;

  return { year: yearOut, month: monthOut, day: Math.floor(dayOut) };
}

/** Resolve "now" at a given location. Convenience wrapper. */
export function resolveNow(lat: number, lon: number, timeZone?: string): ResolvedTime {
  const now = new Date();
  let zone = timeZone;
  if (!zone) {
    try {
      zone = zoneForCoords(lat, lon);
    } catch {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }
  }
  return {
    jd: jdFromDate(now),
    instant: now,
    timeZone: zone,
    offsetMinutes: DateTime.fromJSDate(now, { zone }).offset,
    timeIsApproximate: false,
    precedesGregorian: false,
    warnings: [],
  };
}
