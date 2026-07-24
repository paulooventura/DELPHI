/**
 * Fixed arithmetic Hebrew calendar (Dershowitz/Reingold style absolute days).
 */

export type HebrewDate = { year: number; month: number; day: number };

const MONTH_NAMES = [
  "Nisan",
  "Iyar",
  "Sivan",
  "Tammuz",
  "Av",
  "Elul",
  "Tishrei",
  "Cheshvan",
  "Kislev",
  "Tevet",
  "Shevat",
  "Adar",
  "Adar II",
];

export function hebrewMonthName(year: number, month: number): string {
  if (month === 12 && !isHebrewLeapYear(year)) return "Adar";
  if (month === 12 && isHebrewLeapYear(year)) return "Adar I";
  if (month === 13) return "Adar II";
  // month is 1..13 in our converter; map display names for civil order starting Nisan=1
  return MONTH_NAMES[month - 1] ?? `M${month}`;
}

export function isHebrewLeapYear(year: number): boolean {
  return ((7 * year + 1) % 19) < 7;
}

function hebrewMonthsInYear(year: number): number {
  return isHebrewLeapYear(year) ? 13 : 12;
}

function hebrewElapsedDays(year: number): number {
  const monthsElapsed = Math.floor((235 * year - 234) / 19);
  const partsElapsed = 12084 + 13753 * monthsElapsed;
  let day = 29 * monthsElapsed + Math.floor(partsElapsed / 25920);
  if ((3 * (day + 1)) % 7 < 3) day += 1;
  return day;
}

function hebrewNewYear(year: number): number {
  const ny0 = hebrewElapsedDays(year);
  const ny1 = hebrewElapsedDays(year + 1);
  const delay1 = ((ny0 + 1) % 7 === 2 || (ny0 + 1) % 7 === 4 || (ny0 + 1) % 7 === 6) ? 1 : 0;
  let ny = ny0 + delay1;
  const delay2 = (ny1 - ny0 === 356 && delay1 === 0 && ((ny0 + 2) % 7 === 0)) ? 2 : 0;
  const delay3 = (ny1 - ny0 === 382 && delay1 === 0 && ((ny0 + 1) % 7 === 0)) ? 1 : 0;
  return ny + delay2 + delay3;
}

function daysInHebrewYear(year: number): number {
  return hebrewNewYear(year + 1) - hebrewNewYear(year);
}

function daysInHebrewMonth(year: number, month: number): number {
  if (month === 2 || month === 4 || month === 6 || month === 10 || month === 13) return 29;
  if (month === 12) return isHebrewLeapYear(year) ? 30 : 29;
  if (month === 8) return ((daysInHebrewYear(year) % 10) === 5) ? 30 : 29; // Cheshvan
  if (month === 9) return ((daysInHebrewYear(year) % 10) === 3) ? 29 : 30; // Kislev
  return 30;
}

/** Absolute day number (RD) for Gregorian date. */
function gregorianToRd(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045
  );
}

const HEBREW_EPOCH = 347998; // RD of 1 Tishrei 1 AM ≈ Sept 7, 3761 BCE Julian

export function gregorianToHebrew(gy: number, gm: number, gd: number): HebrewDate {
  const rd = gregorianToRd(gy, gm, gd);
  const days = rd - HEBREW_EPOCH + 1;
  let year = Math.floor((days * 98496.0) / 35975351.0) + 1;
  while (hebrewNewYear(year) <= days) year += 1;
  year -= 1;
  let dayOfYear = days - hebrewNewYear(year) + 1;
  // Months numbered from Tishrei=7 in civil display; we use Tishrei=1 internally then remap
  // Standard: month 1 = Tishrei
  let month = 1;
  while (dayOfYear > daysInHebrewMonth(year, month)) {
    dayOfYear -= daysInHebrewMonth(year, month);
    month += 1;
  }
  return { year, month, day: dayOfYear };
}

/** Convert internal Tishrei-based month to Nisan-based (1=Nisan) for angle. */
export function hebrewCivilMonth(year: number, tishreiMonth: number): number {
  // Tishrei=1 ... Elul=12/13 → Nisan = month 7 in Tishrei numbering
  const months = hebrewMonthsInYear(year);
  return ((tishreiMonth - 7 + months) % months) + 1;
}

export function hebrewYearAngle(h: HebrewDate): number {
  const months = hebrewMonthsInYear(h.year);
  const dayIndex = (h.month - 1) + (h.day - 1) / 30;
  return ((dayIndex / months) * 360) % 360;
}

export function hebrewMonthDisplay(year: number, tishreiMonth: number): string {
  // Map Tishrei-based index to names starting Tishrei
  const namesNonLeap = [
    "Tishrei",
    "Cheshvan",
    "Kislev",
    "Tevet",
    "Shevat",
    "Adar",
    "Nisan",
    "Iyar",
    "Sivan",
    "Tammuz",
    "Av",
    "Elul",
  ];
  const namesLeap = [
    "Tishrei",
    "Cheshvan",
    "Kislev",
    "Tevet",
    "Shevat",
    "Adar I",
    "Adar II",
    "Nisan",
    "Iyar",
    "Sivan",
    "Tammuz",
    "Av",
    "Elul",
  ];
  const names = isHebrewLeapYear(year) ? namesLeap : namesNonLeap;
  return names[tishreiMonth - 1] ?? `M${tishreiMonth}`;
}
