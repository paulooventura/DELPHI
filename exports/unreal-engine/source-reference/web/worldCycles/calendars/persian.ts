/**
 * Persian / Solar Hijri (Jalali) — civil calendar of Iran/Afghanistan.
 * Conversion: common open Jalali algorithm (modern civil range).
 */

export type PersianDate = { year: number; month: number; day: number };

const MONTH_NAMES = [
  "Farvardin",
  "Ordibehesht",
  "Khordad",
  "Tir",
  "Mordad",
  "Shahrivar",
  "Mehr",
  "Aban",
  "Azar",
  "Dey",
  "Bahman",
  "Esfand",
];

export function persianMonthName(month: number): string {
  return MONTH_NAMES[((month - 1) % 12 + 12) % 12] ?? String(month);
}

/** Gregorian Y-M-D → Jalali (Solar Hijri). */
export function gregorianToPersian(gy: number, gm: number, gd: number): PersianDate {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1]!;

  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { year: jy, month: jm, day: jd };
}

export function persianYearAngle(p: PersianDate): number {
  const daysBefore =
    p.month <= 6 ? (p.month - 1) * 31 + (p.day - 1) : 6 * 31 + (p.month - 7) * 30 + (p.day - 1);
  return ((daysBefore / 365.2422) * 360) % 360;
}
