/**
 * Tabular Islamic (Kuwaiti algorithm) — arithmetical Hijri calendar.
 * Matches civil/tabular conversions used widely in software (not Saudi sighting).
 */

export type HijriDate = { year: number; month: number; day: number };

const MONTH_NAMES = [
  "Muharram",
  "Safar",
  "Rabiʻ I",
  "Rabiʻ II",
  "Jumada I",
  "Jumada II",
  "Rajab",
  "Shaʻban",
  "Ramadan",
  "Shawwal",
  "Dhuʻl-Qaʻdah",
  "Dhuʻl-Hijjah",
];

export function hijriMonthName(month: number): string {
  return MONTH_NAMES[((month - 1) % 12 + 12) % 12] ?? String(month);
}

/** Gregorian Y-M-D → tabular Hijri. */
export function gregorianToHijri(gy: number, gm: number, gd: number): HijriDate {
  const jd =
    Math.floor((1461 * (gy + 4800 + Math.floor((gm - 14) / 12))) / 4) +
    Math.floor((367 * (gm - 2 - 12 * Math.floor((gm - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((gy + 4900 + Math.floor((gm - 14) / 12)) / 100)) / 4) +
    gd -
    32075;

  const l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) +
    Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

/** Day-of-year angle within the Hijri year (~354.37 mean days). */
export function hijriYearAngle(h: HijriDate): number {
  const dayIndex = (h.month - 1) * 29.530588853 + (h.day - 1);
  return ((dayIndex / 354.36667) * 360) % 360;
}
