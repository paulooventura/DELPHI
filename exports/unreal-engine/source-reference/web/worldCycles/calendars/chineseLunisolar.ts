/**
 * Chinese lunisolar: CNY table (civil) + synodic month index from New Year.
 * Replaces lunar-fraction placeholder for month/leap labeling.
 */

export type ChineseLunisolarDate = {
  year: number; // sexagenary year index animal year (CNY-based)
  month: number; // 1–12 (or 13 if leap month present — leap flagged separately)
  day: number;
  isLeapMonth: boolean;
  animal: string;
  element: string;
  yinYang: "Yin" | "Yang";
};

const ANIMALS = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
const ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"];
const SYNODIC = 29.530588853;

/**
 * Chinese New Year as MM-DD for Gregorian years 1980–2050.
 * Source: common civil CNY tables (Asia/Shanghai midnight civil day).
 */
const CNY_MD: Record<number, [number, number]> = {
  1980: [2, 16], 1981: [2, 5], 1982: [1, 25], 1983: [2, 13], 1984: [2, 2],
  1985: [2, 20], 1986: [2, 9], 1987: [1, 29], 1988: [2, 17], 1989: [2, 6],
  1990: [1, 27], 1991: [2, 15], 1992: [2, 4], 1993: [1, 23], 1994: [2, 10],
  1995: [1, 31], 1996: [2, 19], 1997: [2, 7], 1998: [1, 28], 1999: [2, 16],
  2000: [2, 5], 2001: [1, 24], 2002: [2, 12], 2003: [2, 1], 2004: [1, 22],
  2005: [2, 9], 2006: [1, 29], 2007: [2, 18], 2008: [2, 7], 2009: [1, 26],
  2010: [2, 14], 2011: [2, 3], 2012: [1, 23], 2013: [2, 10], 2014: [1, 31],
  2015: [2, 19], 2016: [2, 8], 2017: [1, 28], 2018: [2, 16], 2019: [2, 5],
  2020: [1, 25], 2021: [2, 12], 2022: [2, 1], 2023: [1, 22], 2024: [2, 10],
  2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13],
  2030: [2, 3], 2031: [1, 23], 2032: [2, 11], 2033: [1, 31], 2034: [2, 19],
  2035: [2, 8], 2036: [1, 28], 2037: [2, 15], 2038: [2, 4], 2039: [1, 24],
  2040: [2, 12], 2041: [2, 1], 2042: [1, 22], 2043: [2, 10], 2044: [1, 30],
  2045: [2, 17], 2046: [2, 6], 2047: [1, 26], 2048: [2, 14], 2049: [2, 2],
  2050: [1, 23],
};

/** Years with a leap month (month number after which leap is inserted). */
const LEAP_AFTER: Record<number, number> = {
  1982: 4, 1984: 10, 1987: 6, 1990: 5, 1993: 3, 1995: 8, 1998: 5,
  2001: 4, 2004: 2, 2006: 7, 2009: 5, 2012: 4, 2014: 9, 2017: 6,
  2020: 4, 2023: 2, 2025: 6, 2028: 5, 2031: 3, 2033: 11, 2036: 6,
  2039: 5, 2042: 2, 2044: 7, 2047: 5, 2050: 3,
};

function cnyDate(gy: number): Date | null {
  const md = CNY_MD[gy];
  if (!md) return null;
  return new Date(gy, md[0] - 1, md[1]);
}

function sexagenary(animalYear: number) {
  const cycle = (animalYear - 1984 + 120) % 60;
  const animalIdx = cycle % 12;
  return {
    animal: ANIMALS[animalIdx]!,
    element: ELEMENTS[Math.floor((cycle % 10) / 2)]!,
    yinYang: (cycle % 2 === 0 ? "Yang" : "Yin") as "Yang" | "Yin",
  };
}

export function gregorianToChineseLunisolar(gy: number, gm: number, gd: number): ChineseLunisolarDate {
  const civil = new Date(gy, gm - 1, gd);
  let animalYear = gy;
  const cnyThis = cnyDate(gy);
  if (cnyThis && civil < cnyThis) animalYear = gy - 1;

  const cny = cnyDate(animalYear) ?? new Date(animalYear, 1, 1);
  const daysSinceCny = Math.floor((civil.getTime() - cny.getTime()) / 86400000);
  const monthIndex = Math.max(0, Math.floor(daysSinceCny / SYNODIC)); // 0-based from CNY
  const dayInMonth = Math.floor(daysSinceCny - monthIndex * SYNODIC) + 1;

  const leapAfter = LEAP_AFTER[animalYear];
  let month = monthIndex + 1;
  let isLeapMonth = false;
  if (leapAfter != null && monthIndex >= leapAfter) {
    if (monthIndex === leapAfter) {
      isLeapMonth = true;
      month = leapAfter; // leap month of leapAfter
    } else {
      month = monthIndex; // shift back after leap
    }
  }
  month = Math.min(12, Math.max(1, month));

  const sx = sexagenary(animalYear);
  return {
    year: animalYear,
    month,
    day: Math.min(30, Math.max(1, dayInMonth)),
    isLeapMonth,
    ...sx,
  };
}

export function chineseLunisolarAngle(c: ChineseLunisolarDate): number {
  const dayIndex = (c.month - 1) * SYNODIC + (c.day - 1);
  return ((dayIndex / (12 * SYNODIC)) * 360) % 360;
}

export function chineseYearFromGregorian(gy: number, gm: number, gd: number) {
  const c = gregorianToChineseLunisolar(gy, gm, gd);
  return sexagenary(c.year);
}
