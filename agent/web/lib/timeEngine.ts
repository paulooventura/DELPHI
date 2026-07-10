/**
 * Pure time-cycle engine — maps a single Date to normalized cosmic clock rings.
 * Astronomical rings use Meeus-grade solar/lunar math from cosmic/math.
 */

import { julianDay, lunarPhaseFraction, sunEclipticLongitudeDeg } from "./cosmic/math";

// ─── Output types ───────────────────────────────────────────────────────────

export type CycleSegment = {
  id: string;
  name: string;
  symbol: string;
  /** Index or scalar identifier within the ring's cycle (e.g. ke 0–99, sign 0–19). */
  numericalValue: number;
  metadata: string;
};

export type ClockRingData = {
  ringId: number;
  name: string;
  /** Progress through the active segment, 0.0 (start) → 1.0 (end). */
  normalizedProgress: number;
  activeSegment: CycleSegment;
};

export type CosmicTimeSnapshot = {
  /** Input instant (unchanged reference). */
  date: Date;
  /** Rings ordered innermost (ringId 1) → outermost (10). */
  rings: ClockRingData[];
};

export const COSMIC_RING_COUNT = 10;

export type RingProvenanceTier = "measured" | "computed" | "cultural";

/** Data trust tier for each ring — shown in layer readouts. */
export function ringProvenanceTier(ringId: number): RingProvenanceTier {
  if (ringId <= 3) return "measured";
  if (ringId === 4 || ringId === 5 || ringId === 8 || ringId === 10) return "cultural";
  return "computed";
}

export function ringProvenanceNote(ringId: number): string {
  switch (ringId) {
    case 4: return "100 Kè per civil day (~14.4 min each)";
    case 5: return "12 dual-hours · branch animals";
    case 6: return "Synodic month · Meeus mean phase";
    case 7: return "Tropical year · solar λ seasons";
    case 8: return "Tzolk'in · Delphi anchor 2024-07-26";
    case 9: return "Tropical zodiac · solar ecliptic λ";
    case 10: return "Sexagenary 干支 · civil year index";
    default: return "";
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SYNODIC_MONTH = 29.530588853;
const TROPICAL_YEAR = 365.2422;
const KE_PER_DAY = 100;
const SHI_PER_DAY = 12;
const SEXAGENARY_CYCLE = 60;
const DEG_PER_DAY = 0.9856;

/** J2000.0 new moon anchor retained for documentation; phase uses cosmic/math. */

/** Tzolkin kin 1 anchor (local civil midnight). */
const TZOLKIN_ANCHOR_MS = new Date(2024, 6, 26).getTime();

const TZOLKIN_SIGNS = [
  "Imix", "Ik", "Akbal", "Kan", "Chikchan", "Kimi", "Manik", "Lamat", "Muluk", "Ok",
  "Chuen", "Eb", "Ben", "Ix", "Men", "Kib", "Kaban", "Etznab", "Kawak", "Ajaw",
] as const;

const SHI_ANIMALS = [
  { id: "zi", name: "Rat", han: "子", symbol: "🐀" },
  { id: "chou", name: "Ox", han: "丑", symbol: "🐂" },
  { id: "yin", name: "Tiger", han: "寅", symbol: "🐅" },
  { id: "mao", name: "Rabbit", han: "卯", symbol: "🐇" },
  { id: "chen", name: "Dragon", han: "辰", symbol: "🐉" },
  { id: "si", name: "Snake", han: "巳", symbol: "🐍" },
  { id: "wu", name: "Horse", han: "午", symbol: "🐴" },
  { id: "wei", name: "Goat", han: "未", symbol: "🐑" },
  { id: "shen", name: "Monkey", han: "申", symbol: "🐒" },
  { id: "you", name: "Rooster", han: "酉", symbol: "🐓" },
  { id: "xu", name: "Dog", han: "戌", symbol: "🐕" },
  { id: "hai", name: "Pig", han: "亥", symbol: "🐖" },
] as const;

const ZODIAC_SIGNS = [
  { name: "Aries", symbol: "♈" },
  { name: "Taurus", symbol: "♉" },
  { name: "Gemini", symbol: "♊" },
  { name: "Cancer", symbol: "♋" },
  { name: "Leo", symbol: "♌" },
  { name: "Virgo", symbol: "♍" },
  { name: "Libra", symbol: "♎" },
  { name: "Scorpio", symbol: "♏" },
  { name: "Sagittarius", symbol: "♐" },
  { name: "Capricorn", symbol: "♑" },
  { name: "Aquarius", symbol: "♒" },
  { name: "Pisces", symbol: "♓" },
] as const;

const HEAVENLY_STEMS = ["Jia", "Yi", "Bing", "Ding", "Wu", "Ji", "Geng", "Xin", "Ren", "Gui"] as const;
const EARTHLY_BRANCHES = ["Zi", "Chou", "Yin", "Mao", "Chen", "Si", "Wu", "Wei", "Shen", "You", "Xu", "Hai"] as const;
const STEM_HAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const BRANCH_HAN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

const LUNAR_PHASES: Array<{ max: number; name: string; symbol: string }> = [
  { max: 0.0625, name: "New Moon", symbol: "🌑" },
  { max: 0.1875, name: "Waxing Crescent", symbol: "🌒" },
  { max: 0.3125, name: "First Quarter", symbol: "🌓" },
  { max: 0.4375, name: "Waxing Gibbous", symbol: "🌔" },
  { max: 0.5625, name: "Full Moon", symbol: "🌕" },
  { max: 0.6875, name: "Waning Gibbous", symbol: "🌖" },
  { max: 0.8125, name: "Last Quarter", symbol: "🌗" },
  { max: 1.0, name: "Waning Crescent", symbol: "🌘" },
];

const SEASONS = [
  { name: "Spring", emoji: "🌸", nextEvent: "Summer Solstice" },
  { name: "Summer", emoji: "☀️", nextEvent: "Autumn Equinox" },
  { name: "Autumn", emoji: "🍁", nextEvent: "Winter Solstice" },
  { name: "Winter", emoji: "❄️", nextEvent: "Vernal Equinox" },
] as const;

// ─── Math helpers ─────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

/** Local civil day fraction 0.0–1.0. */
function localDayFraction(date: Date): number {
  const ms =
    date.getHours() * 3_600_000
    + date.getMinutes() * 60_000
    + date.getSeconds() * 1_000
    + date.getMilliseconds();
  return ms / 86_400_000;
}

function localMidnightMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today.getTime() - start.getTime()) / 86_400_000);
}

function vernalEquinoxMs(year: number): number {
  const y = year;
  const marchDay =
    y <= 2100
      ? 20.69115 + 0.2421904 * (y - 1900) - Math.floor((y - 1900) / 4)
      : 20.69115;
  const day = Math.floor(marchDay);
  const hourFrac = marchDay - day;
  return new Date(year, 2, day, Math.floor(hourFrac * 24), Math.floor((hourFrac * 24 % 1) * 60), 0).getTime();
}

function solarEclipticLongitudeDeg(date: Date): number {
  return sunEclipticLongitudeDeg(julianDay(date));
}

function tzolkinKin(date: Date): number {
  const civilMidnight = localMidnightMs(date);
  const diffDays = Math.floor((civilMidnight - TZOLKIN_ANCHOR_MS) / 86_400_000);
  return mod(diffDays, 260) + 1;
}

function sexagenaryYearIndex(year: number): number {
  return mod(year - 4, SEXAGENARY_CYCLE);
}

function continuousSeconds(date: Date): number {
  return date.getSeconds() + date.getMilliseconds() / 1000;
}

function continuousMinutes(date: Date): number {
  return date.getMinutes() + continuousSeconds(date) / 60;
}

function continuousHours24(date: Date): number {
  return date.getHours() + continuousMinutes(date) / 60;
}

function astronomicalSeason(solarLambda: number) {
  const seasonIndex = Math.floor(solarLambda / 90) % 4;
  const season = SEASONS[seasonIndex]!;
  const progressInSeason = (solarLambda % 90) / 90;
  const nextBoundary = (seasonIndex + 1) * 90;
  const degToNext = nextBoundary >= 360 ? 360 - solarLambda : nextBoundary - solarLambda;
  const daysToNext = Math.max(0, degToNext / DEG_PER_DAY);
  return { ...season, seasonIndex, progressInSeason, daysToNext };
}

// ─── Layer builders ───────────────────────────────────────────────────────────

function buildSecondsRing(date: Date): ClockRingData {
  const sec = date.getSeconds();
  const ms = date.getMilliseconds();
  const continuous = continuousSeconds(date);
  const progress = clamp01(continuous / 60);

  return {
    ringId: 1,
    name: "Seconds",
    normalizedProgress: progress,
    activeSegment: {
      id: "seconds",
      name: `${sec}.${pad3(ms)} s`,
      symbol: "⏱",
      numericalValue: sec,
      metadata: `Smooth 0–60 s sweep · ${continuous.toFixed(3)} s in current minute`,
    },
  };
}

function buildMinutesRing(date: Date): ClockRingData {
  const min = date.getMinutes();
  const continuous = continuousMinutes(date);
  const progress = clamp01(continuous / 60);

  return {
    ringId: 2,
    name: "Minutes",
    normalizedProgress: progress,
    activeSegment: {
      id: "minutes",
      name: `${pad2(min)} min`,
      symbol: "🕐",
      numericalValue: min,
      metadata: `60-minute cycle · ${continuous.toFixed(4)} m past the hour`,
    },
  };
}

function buildHoursRing(date: Date): ClockRingData {
  const hr = date.getHours();
  const continuous = continuousHours24(date);
  const progress = clamp01(continuous / 24);
  const h12 = hr % 12 || 12;

  return {
    ringId: 3,
    name: "Hours",
    normalizedProgress: progress,
    activeSegment: {
      id: "hours",
      name: `${pad2(hr)} h (${h12} · ${hr >= 12 ? "PM" : "AM"})`,
      symbol: "🕛",
      numericalValue: hr,
      metadata: `24-hour cycle · ${continuous.toFixed(5)} h since midnight`,
    },
  };
}

function buildKeRing(date: Date): ClockRingData {
  const dayFrac = localDayFraction(date);
  const keFloat = dayFrac * KE_PER_DAY;
  const keIndex = Math.floor(keFloat) % KE_PER_DAY;
  const progress = clamp01(keFloat - keIndex);
  const keNumber = keIndex + 1;

  return {
    ringId: 4,
    name: "Chinese Kè",
    normalizedProgress: progress,
    activeSegment: {
      id: `ke-${keIndex}`,
      name: `Kè ${keNumber}`,
      symbol: "刻",
      numericalValue: keIndex,
      metadata: `${keNumber} of ${KE_PER_DAY} daily divisions (~14.4 min each)`,
    },
  };
}

function buildShiRing(date: Date): ClockRingData {
  const dayFrac = localDayFraction(date);
  const shifted = mod(dayFrac + 1 / 24, 1);
  const shiFloat = shifted * SHI_PER_DAY;
  const shiIndex = Math.floor(shiFloat) % SHI_PER_DAY;
  const progress = clamp01(shiFloat - shiIndex);
  const animal = SHI_ANIMALS[shiIndex]!;
  const hour24 = date.getHours();

  return {
    ringId: 5,
    name: "Chinese Shí",
    normalizedProgress: progress,
    activeSegment: {
      id: `shi-${animal.id}`,
      name: `${animal.han} ${animal.name}`,
      symbol: animal.symbol,
      numericalValue: shiIndex,
      metadata: `Dual-hour ${shiIndex + 1}/12 · local hour ${hour24}`,
    },
  };
}

function buildLunarRing(date: Date): ClockRingData {
  const phase = lunarPhaseFraction(date);
  const phaseInfo = LUNAR_PHASES.find(p => phase <= p.max) ?? LUNAR_PHASES[LUNAR_PHASES.length - 1]!;
  const ageDays = phase * SYNODIC_MONTH;

  return {
    ringId: 6,
    name: "Lunar Phase",
    normalizedProgress: clamp01(phase),
    activeSegment: {
      id: `lunar-${phaseInfo.name.toLowerCase().replace(/\s+/g, "-")}`,
      name: phaseInfo.name,
      symbol: phaseInfo.symbol,
      numericalValue: Math.round(phase * 1000) / 1000,
      metadata: `Age ${ageDays.toFixed(2)} d · synodic ${SYNODIC_MONTH.toFixed(5)} d`,
    },
  };
}

function buildSolarYearRing(date: Date): ClockRingData {
  const year = date.getFullYear();
  const t = date.getTime();
  const solarLambda = solarEclipticLongitudeDeg(date);
  const season = astronomicalSeason(solarLambda);

  let startMs = vernalEquinoxMs(year);
  let endMs = vernalEquinoxMs(year + 1);
  if (t < startMs) {
    startMs = vernalEquinoxMs(year - 1);
    endMs = vernalEquinoxMs(year);
  }

  const spanMs = endMs - startMs;
  const progress = clamp01(spanMs > 0 ? (t - startMs) / spanMs : 0);
  const doy = dayOfYear(date);

  return {
    ringId: 7,
    name: "Solar Year & Seasons",
    normalizedProgress: progress,
    activeSegment: {
      id: `solar-year-${year}`,
      name: `${season.emoji} ${season.name} · ${year}`,
      symbol: season.emoji,
      numericalValue: doy,
      metadata: [
        `Astronomical season: ${season.name} (${(season.progressInSeason * 100).toFixed(1)}% through)`,
        `Year progress: ${(progress * 100).toFixed(1)}% · Day ${doy}`,
        `${season.daysToNext.toFixed(1)} d to ${season.nextEvent}`,
        `Tropical year · ${TROPICAL_YEAR} d · λ ${solarLambda.toFixed(1)}°`,
      ].join(" · "),
    },
  };
}

function buildTzolkinRing(date: Date): ClockRingData {
  const kin = tzolkinKin(date);
  const signIndex = mod(kin - 1, 20);
  const signName = TZOLKIN_SIGNS[signIndex]!;
  const tone = mod(kin - 1, 13) + 1;
  const dayFrac = localDayFraction(date);

  return {
    ringId: 8,
    name: "Tzolk'in Day Sign",
    normalizedProgress: clamp01(dayFrac),
    activeSegment: {
      id: `tzolkin-${signName.toLowerCase()}`,
      name: signName,
      symbol: "🧭",
      numericalValue: signIndex,
      metadata: `Kin ${kin} · Tone ${tone} · sign index ${signIndex}/19`,
    },
  };
}

function buildZodiacRing(date: Date): ClockRingData {
  const lambda = solarEclipticLongitudeDeg(date);
  const signIndex = Math.floor(lambda / 30) % 12;
  const progressInSign = mod(lambda, 30) / 30;
  const sign = ZODIAC_SIGNS[signIndex]!;

  return {
    ringId: 9,
    name: "Western Tropical Zodiac",
    normalizedProgress: clamp01(progressInSign),
    activeSegment: {
      id: `zodiac-${sign.name.toLowerCase()}`,
      name: sign.name,
      symbol: sign.symbol,
      numericalValue: signIndex,
      metadata: `Solar longitude ${lambda.toFixed(2)}° · sign ${signIndex + 1}/12`,
    },
  };
}

function buildSexagenaryRing(date: Date): ClockRingData {
  const year = date.getFullYear();
  const cycleIndex = sexagenaryYearIndex(year);
  const stemIdx = cycleIndex % 10;
  const branchIdx = cycleIndex % 12;
  const stem = HEAVENLY_STEMS[stemIdx]!;
  const branch = EARTHLY_BRANCHES[branchIdx]!;
  const stemHan = STEM_HAN[stemIdx]!;
  const branchHan = BRANCH_HAN[branchIdx]!;

  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year + 1, 0, 1).getTime();
  const yearProgress = (date.getTime() - yearStart) / (yearEnd - yearStart);
  const cycleProgress = clamp01((cycleIndex + yearProgress) / SEXAGENARY_CYCLE);

  return {
    ringId: 10,
    name: "Chinese Sexagenary Cycle",
    normalizedProgress: cycleProgress,
    activeSegment: {
      id: `sexagenary-${stemHan}${branchHan}`,
      name: `${stemHan}${branchHan} (${stem}-${branch})`,
      symbol: "🧧",
      numericalValue: cycleIndex,
      metadata: `Year ${year} · stem ${stemIdx + 1}/10 · branch ${branchIdx + 1}/12 · 60-year index ${cycleIndex}`,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Digital wall-clock string `HH:MM:SS.mmm` (local civil). */
export function formatStandardDigitalTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${pad3(date.getMilliseconds())}`;
}

/** Hub readout matching reference UI: `NOW 12:00:23 AM`. */
export function formatHubClockTime(date: Date): string {
  const h24 = date.getHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `NOW ${pad2(h12)}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())} ${ampm}`;
}

/** Rings rendered on the semi-circle wheel (fastest inner → slowest outer). */
export const WHEEL_VISIBLE_RING_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Primary dashboard layer cards (cosmic layers 1–6 in the reference). */
export const DASHBOARD_COSMIC_LAYER_IDS = [4, 5, 6, 7, 8, 9] as const;

export function dashboardLayerNumber(ringId: number): number {
  return Math.max(1, ringId - 3);
}

/**
 * Calculate normalized cosmic clock rings for a single instant.
 * Rings are ordered innermost (1) → outermost (10).
 */
export function calculateCosmicTime(date: Date): CosmicTimeSnapshot {
  const instant = new Date(date.getTime());

  return {
    date: instant,
    rings: [
      buildSecondsRing(instant),
      buildMinutesRing(instant),
      buildHoursRing(instant),
      buildKeRing(instant),
      buildShiRing(instant),
      buildLunarRing(instant),
      buildSolarYearRing(instant),
      buildTzolkinRing(instant),
      buildZodiacRing(instant),
      buildSexagenaryRing(instant),
    ],
  };
}

/** Convenience: progress angle in degrees for a ring (0–360). */
export function ringAngleDeg(ring: ClockRingData): number {
  return ring.normalizedProgress * 360;
}

/** Combined cycle fraction (0–1) for dial rotation under the NOW playhead. */
export function ringCycleFraction(ring: ClockRingData): number {
  const { ringId, normalizedProgress, activeSegment } = ring;
  const v = activeSegment.numericalValue;
  switch (ringId) {
    case 1:
      return normalizedProgress;
    case 2:
      return normalizedProgress;
    case 3:
      return normalizedProgress;
    case 4:
      return (v + normalizedProgress) / 100;
    case 5:
      return (v + normalizedProgress) / 12;
    case 6:
      return normalizedProgress;
    case 7:
      return normalizedProgress;
    case 8:
      return (v + normalizedProgress) / 20;
    case 9:
      return (v + normalizedProgress) / 12;
    case 10:
      return normalizedProgress;
    default:
      return normalizedProgress;
  }
}
