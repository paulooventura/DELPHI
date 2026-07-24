/**
 * Ethiopian calendar (+ Coptic companion labels).
 * Ethiopian New Year (Enkutatash) ≈ Sept 11 (Gregorian; Sept 12 in Gregorian leap years).
 */

export type EthiopianDate = { year: number; month: number; day: number };

const ETH_MONTHS = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miazia",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehasse",
  "Pagumen",
];

const COPTIC_MONTHS = [
  "Thout",
  "Paopi",
  "Hathor",
  "Koiak",
  "Tobi",
  "Meshir",
  "Paremhat",
  "Parmouti",
  "Pashons",
  "Paoni",
  "Epip",
  "Mesori",
  "Pi Kogi Enavot",
];

export function ethiopianMonthName(month: number): string {
  return ETH_MONTHS[((month - 1) % 13 + 13) % 13] ?? String(month);
}

export function copticMonthName(month: number): string {
  return COPTIC_MONTHS[((month - 1) % 13 + 13) % 13] ?? String(month);
}

function isGregorianLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Approximate JD for Gregorian noon. */
function gregorianToJd(y: number, m: number, d: number): number {
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

const ETH_EPOCH = 1724220.5; // JD of Ethiopian epoch (rough civil mapping)

export function gregorianToEthiopian(gy: number, gm: number, gd: number): EthiopianDate {
  // Civil rule: Ethiopian year = Gregorian year - 7 until Enkutatash, then -8 before?
  // Standard: Eth year ≈ Gy - 8 after Sept NY, Gy - 7 before NY in same Gregorian year.
  const newYearMonth = 9;
  const newYearDay = isGregorianLeap(gy + 1) || isGregorianLeap(gy) ? 12 : 11;
  // More precise: Enkutatash is Sept 11, or Sept 12 if the following Gregorian year is leap
  // Actually: Sept 11 normally; Sept 12 in years preceding Gregorian leap year.
  const enkutatashDay = isGregorianLeap(gy + 1) ? 12 : 11;

  let ey: number;
  if (gm > newYearMonth || (gm === newYearMonth && gd >= enkutatashDay)) {
    ey = gy - 7;
  } else {
    ey = gy - 8;
  }

  const jd = gregorianToJd(gy, gm, gd);
  // Day of Ethiopian year from last Enkutatash
  const nyY = ey + 7; // Gregorian year of that Enkutatash
  const nyDay = isGregorianLeap(nyY + 1) ? 12 : 11;
  const nyJd = gregorianToJd(nyY, 9, nyDay);
  let doy = Math.floor(jd - nyJd);
  if (doy < 0) {
    // before computed NY — use previous
    const prevEy = ey - 1;
    const prevNyY = prevEy + 7;
    const prevNyDay = isGregorianLeap(prevNyY + 1) ? 12 : 11;
    const prevNyJd = gregorianToJd(prevNyY, 9, prevNyDay);
    doy = Math.floor(jd - prevNyJd);
    ey = prevEy;
  }

  let month = Math.floor(doy / 30) + 1;
  let day = (doy % 30) + 1;
  if (month > 13) {
    month = 13;
    day = Math.min(day, 6);
  }
  return { year: ey, month, day };
}

/** Coptic is offset by 276 years from Ethiopian (same month/day structure). */
export function ethiopianToCoptic(e: EthiopianDate): EthiopianDate {
  return { year: e.year - 276, month: e.month, day: e.day };
}

export function ethiopianYearAngle(e: EthiopianDate): number {
  const dayIndex = (e.month - 1) * 30 + (e.day - 1);
  return ((dayIndex / 365.25) * 360) % 360;
}
