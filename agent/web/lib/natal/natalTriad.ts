/**
 * Natal triad (Sun · Moon · Rising) — pure math, no React.
 *
 * Option B: astronomy-engine for Sun/Moon + GAST; Ascendant from
 * local sidereal time + mean obliquity (Meeus). Tropical signs.
 *
 * Time: local civil → UTC via luxon in the birth-place IANA zone
 * (historical DST). Never use the browser's zone for natal math.
 */

import * as Astronomy from "astronomy-engine";
import { DateTime } from "luxon";
import tzLookup from "tz-lookup";

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export type ZodiacSign = (typeof SIGNS)[number];

export type NatalSignPlacement = {
  sign: ZodiacSign;
  /** Degrees within the sign, 0–30 (two decimal places). */
  degreeInSign: number;
  /** Absolute tropical ecliptic longitude, 0–360. */
  longitude: number;
};

export type NatalBirthInput = {
  /** Civil date at the birth place: "YYYY-MM-DD". */
  dateLocal: string;
  /** Civil clock at the birth place: "HH:mm" or "HH:mm:ss". Omit if unknown. */
  timeLocal?: string;
  /** Signed decimal degrees, north positive. */
  lat: number;
  /** Signed decimal degrees, east positive. */
  lon: number;
  /** IANA zone for the birth place. Derived from lat/lon when omitted. */
  ianaTz?: string;
};

export type NatalTriad = {
  sun: NatalSignPlacement;
  moon: NatalSignPlacement & { approximate: boolean };
  /** Null when birth time is unknown — Ascendant needs an exact clock. */
  asc: NatalSignPlacement | null;
  /** Set when Rising cannot be shown. */
  ascMessage?: string;
  utcIso: string;
  ianaTz: string;
  timeIsApproximate: boolean;
};

export function toSign(lon: number): NatalSignPlacement {
  const L = ((lon % 360) + 360) % 360;
  const idx = Math.min(11, Math.floor(L / 30));
  return {
    sign: SIGNS[idx]!,
    degreeInSign: +(L % 30).toFixed(2),
    longitude: +L.toFixed(4),
  };
}

/** IANA zone from coordinates (tz-lookup). */
export function ianaTzForCoords(lat: number, lon: number): string {
  return tzLookup(lat, lon);
}

function meanObliquityDeg(utDays: number): number {
  const T = utDays / 36525;
  return 23.439291 - 0.0130042 * T - 1.64e-7 * T ** 2 + 5.04e-7 * T ** 3;
}

/**
 * Ascendant ecliptic longitude (degrees).
 * Validated against AA-rated charts (e.g. Obama Asc ≈ Aquarius 18°).
 * atan2(cos λ, −(sin λ cos ε + tan φ sin ε)) — do not flip 180°.
 */
export function ascendantLongitude(
  gastHours: number,
  latDeg: number,
  lonDeg: number,
  obliquityDeg: number,
): number {
  const lst = ((gastHours * 15 + lonDeg) % 360 + 360) % 360;
  const d2r = Math.PI / 180;
  const R = lst * d2r;
  const E = obliquityDeg * d2r;
  const P = latDeg * d2r;
  let asc =
    Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(E) + Math.tan(P) * Math.sin(E))) *
    (180 / Math.PI);
  return ((asc % 360) + 360) % 360;
}

function resolveUtc(birth: NatalBirthInput): {
  utc: Date;
  ianaTz: string;
  timeIsApproximate: boolean;
} {
  const ianaTz = birth.ianaTz?.trim() || ianaTzForCoords(birth.lat, birth.lon);
  const timeIsApproximate = !birth.timeLocal?.trim();
  const clock = timeIsApproximate ? "12:00" : birth.timeLocal!.trim();
  const iso = `${birth.dateLocal}T${clock.length === 5 ? `${clock}:00` : clock}`;
  const dt = DateTime.fromISO(iso, { zone: ianaTz });
  if (!dt.isValid) {
    throw new Error(`Invalid birth datetime: ${iso} in ${ianaTz} (${dt.invalidReason})`);
  }
  return { utc: dt.toUTC().toJSDate(), ianaTz, timeIsApproximate };
}

/**
 * Compute tropical Sun, Moon, and Ascendant for a birth instant.
 * Pure — no DOM, no React, no localStorage.
 */
export function computeNatalTriad(birth: NatalBirthInput): NatalTriad {
  if (!Number.isFinite(birth.lat) || !Number.isFinite(birth.lon)) {
    throw new Error("lat and lon are required for natal triad");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth.dateLocal)) {
    throw new Error('dateLocal must be "YYYY-MM-DD"');
  }

  const { utc, ianaTz, timeIsApproximate } = resolveUtc(birth);
  const t = Astronomy.MakeTime(utc);
  const sunLon = Astronomy.SunPosition(t).elon;
  const moonLon = Astronomy.EclipticGeoMoon(t).lon;

  const sun = toSign(sunLon);
  const moon = { ...toSign(moonLon), approximate: timeIsApproximate };

  if (timeIsApproximate) {
    return {
      sun,
      moon,
      asc: null,
      ascMessage: "Rising needs an exact birth time.",
      utcIso: utc.toISOString(),
      ianaTz,
      timeIsApproximate: true,
    };
  }

  const gastHours = Astronomy.SiderealTime(t);
  const eps = meanObliquityDeg(t.ut);
  const ascLon = ascendantLongitude(gastHours, birth.lat, birth.lon, eps);

  return {
    sun,
    moon,
    asc: toSign(ascLon),
    utcIso: utc.toISOString(),
    ianaTz,
    timeIsApproximate: false,
  };
}

/** Display helper: "Moon · 14° Scorpio". */
export function formatNatalPlacement(
  label: string,
  body: NatalSignPlacement,
  opts?: { approximate?: boolean },
): string {
  const deg = Math.floor(body.degreeInSign);
  const approx = opts?.approximate ? " ≈" : "";
  return `${label} · ${deg}° ${body.sign}${approx}`;
}
