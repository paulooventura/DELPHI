import { galacticDayFromKin, formatCodeWords, type GalacticDayReading } from "../galacticFrequency";
import type { CycleSnapshot, WeatherInfo, WheelLayer } from "../cycleSystems";
import { clockRingsFromReadings } from "./clockAdapter";
import type { CycleReading, WorldCycleSnapshot } from "./types";

function daysInMonth(year: number, monthNum: number): number {
  return new Date(year, monthNum, 0).getDate();
}

const CASTLE_NAMES = ["Red East", "White North", "Blue West", "Yellow South", "Green Centre"];
const CASTLE_COLORS = ["#e53e3e", "#a0aec0", "#4299e1", "#d69e2e", "#48bb78"];

const SEASON_DEFS: Array<[number, number, string, string]> = [
  [79, 172, "Spring", "🌸"],
  [172, 266, "Summer", "☀️"],
  [266, 355, "Autumn", "🍂"],
];

function getSeason(dayOfYear: number) {
  const def = SEASON_DEFS.find(([s, e]) => dayOfYear >= s && dayOfYear < e);
  if (!def) {
    const dayInSeason = dayOfYear >= 355 ? dayOfYear - 355 : dayOfYear;
    return { name: "Winter", emoji: "❄️", dayInSeason, angleDeg: (dayInSeason / 88) * 360 };
  }
  const [s, e, name, emoji] = def;
  const len = e - s;
  const dayInSeason = dayOfYear - s;
  return { name, emoji, dayInSeason, angleDeg: (dayInSeason / len) * 360 };
}

function weekOfYear(y: number, m: number, d: number): number {
  const date = new Date(y, m - 1, d);
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  x.setDate(x.getDate() + 4 - (x.getDay() || 7));
  const y0 = new Date(x.getFullYear(), 0, 1);
  return Math.ceil((((x.getTime() - y0.getTime()) / 86400000) + 1) / 7);
}

/**
 * Map WorldCycleSnapshot → legacy CycleSnapshot so Clock/Moment keep working.
 * Tropical sign comes from solar λ plugin (not date cutoffs).
 */
export function worldCyclesToCycleSnapshot(
  world: WorldCycleSnapshot,
  weather?: WeatherInfo,
  enabledIds?: string[],
): CycleSnapshot {
  const ctx = world.context;
  const g = world.byId.gregorian;
  const trop = world.byId.tropical_zodiac;
  const lun = world.byId.lunar_phase;
  const zhYear = world.byId.chinese_year;
  const zhLuni = world.byId.chinese_lunisolar;
  const tz = world.byId.maya_tzolkin;
  const gal = world.byId.galactic_1320;

  const year = ctx.localYear;
  const month = ctx.localMonth;
  const day = ctx.localDay;
  const dayOfYear = ctx.dayOfYear;
  const dim = daysInMonth(year, month);

  const kin = Number(tz?.meta.kin ?? 1);
  const tone = Number(tz?.meta.tone ?? 1);
  const sign = String(tz?.meta.sign ?? "Imix");
  const galactic: GalacticDayReading = galacticDayFromKin(kin);
  const castle = Number(tz?.meta.castle ?? Math.ceil(kin / 52));
  const castleName = CASTLE_NAMES[castle - 1] ?? "Green Centre";
  const castleColor = CASTLE_COLORS[castle - 1] ?? "#48bb78";
  const wavespell = Number(tz?.meta.wavespell ?? Math.ceil(kin / 13));

  const westernZodiac = {
    sign: String(trop?.meta.sign ?? "Aries"),
    symbol: String(trop?.meta.symbol ?? "♈"),
  };
  const chineseZodiac = {
    animal: String(zhYear?.meta.animal ?? "Rat"),
    element: String(zhYear?.meta.element ?? "Wood"),
    yinYang: (zhYear?.meta.yinYang === "Yin" ? "Yin" : "Yang") as "Yin" | "Yang",
    symbol: String(zhYear?.meta.symbol ?? "🐀"),
  };
  const lunar = {
    phase: String(lun?.meta.phase ?? "New Moon"),
    emoji: String(lun?.meta.emoji ?? "🌑"),
    fraction: Number(lun?.meta.fraction ?? 0),
    angleDeg: lun?.angleDeg ?? 0,
  };
  const season = getSeason(dayOfYear);

  const weekdayLong = String(g?.meta.weekday ?? ctx.instant.toLocaleDateString("en", { weekday: "long" }));
  const monthLong = String(g?.meta.monthName ?? ctx.instant.toLocaleDateString("en", { month: "long" }));

  const spectrum: CycleSnapshot["spectrum"] = [
    { name: "Gregorian", axis: "evidence", score: 0.97, note: "Astronomical/civil standard, internationally verified." },
    { name: "Moon Phase", axis: "evidence", score: 0.94, note: "Computed from Synodic period — precise to within hours." },
    { name: "Hijri / Hebrew / Persian", axis: "cultural", score: 0.82, note: "Tier A living calendars via World Cycle registry." },
    { name: "Chinese Lunisolar", axis: "cultural", score: 0.74, note: "CNY-aware year + synodic month index." },
    { name: "Tzolkin (Mayan)", axis: "cultural", score: 0.64, note: "260-day ceremonial cycle with correlation choice." },
    { name: "13:20 Frequency", axis: "philosophical", score: 0.58, note: "13 Tones × 20 Tribes synchronization." },
    { name: "Tropical Zodiac", axis: "philosophical", score: 0.5, note: "Solar λ tropical signs — no date-cutoff drift." },
  ];

  const wheelLayers = buildWheelLayersFromWorld(world, {
    year, month, day, dayOfYear, dim, kin, tone, sign, galactic, wavespell,
    castle, castleName, castleColor, westernZodiac, chineseZodiac, lunar, season, zhLuni,
  }, enabledIds);

  return {
    capturedAtMs: world.capturedAtMs,
    isoDate: world.isoDate,
    gregorian: {
      weekday: weekdayLong,
      weekdayShort: weekdayLong.slice(0, 3),
      month: monthLong,
      monthShort: monthLong.slice(0, 3),
      monthNum: month,
      day,
      year,
      dayOfYear,
      weekOfYear: weekOfYear(year, month, day),
      daysInMonth: dim,
    },
    westernZodiac,
    chineseZodiac,
    tzolkin: { tone, sign, kin },
    galactic,
    mayan: { wavespell, castle, castleName, castleColor },
    lunar,
    season,
    weather,
    spectrum,
    wheelLayers,
  };
}

function buildWheelLayersFromWorld(
  world: WorldCycleSnapshot,
  pack: {
    year: number; month: number; day: number; dayOfYear: number; dim: number;
    kin: number; tone: number; sign: string; galactic: GalacticDayReading;
    wavespell: number; castle: number; castleName: string; castleColor: string;
    westernZodiac: { sign: string; symbol: string };
    chineseZodiac: { animal: string; element: string; yinYang: string; symbol: string };
    lunar: { phase: string; emoji: string; fraction: number; angleDeg: number };
    season: { name: string; emoji: string; dayInSeason: number; angleDeg: number };
    zhLuni?: WorldCycleSnapshot["byId"][string];
  },
  enabledIds?: string[],
): WheelLayer[] {
  const {
    year, month, day, dayOfYear, dim, kin, tone, galactic, castleName, castle,
    westernZodiac, chineseZodiac, lunar, season, zhLuni,
  } = pack;
  const tribeLabel = `${galactic.tribe.color} ${galactic.tribe.name}`;
  const toneLabel = `${galactic.tone.tone} ${galactic.tone.name}`;
  const chineseAnimalPos = ((year - 1984 + 120) % 12) / 12;
  const chineseCyclePos = ((Number(world.byId.chinese_year?.meta.animalYear ?? year) - 1984 + 120) % 60) / 60;
  const tropAngle = world.byId.tropical_zodiac?.angleDeg ?? 0;
  const zodiacAngle = (tropAngle % 30) / 30 * 360;
  const luniMonth = Number(zhLuni?.meta.month ?? Math.floor(lunar.fraction * 12) % 12 + 1);
  const luniDay = Number(zhLuni?.meta.day ?? 1);
  const luniAngle = zhLuni?.angleDeg ?? (((lunar.fraction * 12) % 1) * 360);

  const date = world.context.instant;
  const all: WheelLayer[] = [
    { id: "day", name: "Day", icon: "🕒", label: date.toLocaleDateString("en", { weekday: "short" }), sublabel: `D${dayOfYear}`, angleDeg: (date.getDay() / 7) * 360, periodDays: 7, color: "#4d8bff", category: "nature" },
    { id: "kin", name: "Kin", icon: "🧭", label: `Kin ${kin}`, sublabel: tribeLabel, angleDeg: ((kin - 1) / 260) * 360, periodDays: 260, color: "#7c3aed", category: "mayan" },
    { id: "chinese-sign", name: "Chinese Sign", icon: "🐉", label: `${chineseZodiac.symbol} ${chineseZodiac.animal}`, sublabel: "12-yr cycle", angleDeg: chineseAnimalPos * 360, periodDays: 4383, color: "#dc2626", category: "chinese" },
    { id: "wavespell", name: "Tone", icon: "🌊", label: toneLabel, sublabel: formatCodeWords(galactic.tone.code), angleDeg: ((tone - 1) / 13) * 360, periodDays: 13, color: "#6366f1", category: "mayan" },
    { id: "castle", name: "Castle", icon: "🏰", label: castleName, sublabel: `Castle ${castle}/5`, angleDeg: (((kin - 1) % 52) / 52) * 360, periodDays: 52, color: pack.castleColor, category: "mayan" },
    { id: "moon", name: "Moon", icon: "🌙", label: `${lunar.emoji} ${lunar.phase}`, sublabel: `${(lunar.fraction * 100).toFixed(0)}%`, angleDeg: lunar.angleDeg, periodDays: 29.530588853, color: "#94a3b8", category: "lunar" },
    { id: "chinese-month", name: "Chinese Month", icon: "📅", label: zhLuni?.meta.isLeapMonth ? `Leap M${luniMonth}` : `Lunar M${luniMonth}`, sublabel: `Day ${luniDay}`, angleDeg: luniAngle, periodDays: 29.530588853, color: "#f43f5e", category: "chinese" },
    { id: "greg-month", name: "Month", icon: "🗓️", label: date.toLocaleDateString("en", { month: "short" }), sublabel: `Day ${day}`, angleDeg: ((month - 1 + (day - 1 + date.getHours() / 24) / dim) / 12) * 360, periodDays: 30.44, color: "#0891b2", category: "western" },
    { id: "zodiac", name: "Zodiac", icon: "✨", label: `${westernZodiac.symbol} ${westernZodiac.sign}`, sublabel: `λ ${(tropAngle).toFixed(1)}°`, angleDeg: zodiacAngle % 360, periodDays: 30.44, color: "#f97316", category: "western" },
    { id: "season", name: "Season", icon: "🍃", label: `${season.emoji} ${season.name}`, sublabel: `Day ${season.dayInSeason}`, angleDeg: season.angleDeg, periodDays: 91.3, color: "#22c55e", category: "nature" },
    { id: "chinese-year", name: "Chinese Year", icon: "🧧", label: `${chineseZodiac.element} ${chineseZodiac.animal}`, sublabel: "60-yr cycle", angleDeg: chineseCyclePos * 360, periodDays: 21915, color: "#b91c1c", category: "chinese" },
    { id: "greg-year", name: "Year", icon: "📆", label: String(year), sublabel: `Day ${dayOfYear}/365`, angleDeg: (dayOfYear / 365.25) * 360, periodDays: 365.25, color: "#1e40af", category: "western" },
  ];

  // Optional Atlas-driven rings via clock adapter (Tier A calendars + lunisolar)
  const ATLAS_RING_IDS = ["hijri", "hebrew", "persian", "ethiopian", "chinese_lunisolar"] as const;
  const atlasReadings: CycleReading[] = [];
  for (const id of ATLAS_RING_IDS) {
    const r = world.byId[id];
    if (!r) continue;
    if (enabledIds && !enabledIds.includes(id)) continue;
    // chinese-month already drawn from classic pack — skip duplicate ring id
    if (id === "chinese_lunisolar") continue;
    atlasReadings.push(r);
  }
  const extras = clockRingsFromReadings(atlasReadings);

  // Keep classic order; append enabled Tier A rings
  return [...all, ...extras];
}
