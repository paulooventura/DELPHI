# DELPHI — Interface files for PHASE work

Six files Claude asked for. All under `agent/web/`. Reminder: `@/*` → `agent/web/*`.

## Quick answers to the open questions

- **Phase concept:** `worldCycles/types.ts` has no "phase" field. Each `CycleReading` exposes `angleDeg` (0–360) + `periodDays`; plugins put a normalized `fraction` in `meta` (see lunar). There is no dedicated phase/PhaseSnapshot type yet.
- **Confidence / provenance:** No per-reading confidence field. `CycleReading` carries `accuracy: AccuracyTier` ("astronomical" | "arithmetical" | "mean-orbit" | "symbolic") and `sources: string[]`. The closest thing to a "confidence spectrum" is hardcoded in `snapshotBridge.ts` (`spectrum` array with `axis` + `score` 0–1). PHASE should likely conform to `AccuracyTier` + `sources` rather than invent a second scheme.
- **snapshotBridge.ts:** despite the name it does NOT define `PhaseSnapshot`. It maps a `WorldCycleSnapshot` → legacy `CycleSnapshot` so the Clock/Moment UIs keep working.

---

## 1. `lib/worldCycles/types.ts`

```ts
/** World Cycle registry contracts — one JD spine, many cultural projections. */

export type AccuracyTier = "astronomical" | "arithmetical" | "mean-orbit" | "symbolic";
export type PluginFamily = "calendar" | "zodiac" | "mansion" | "meta";
export type PluginTier = "A" | "B" | "C" | "D";

export type CycleContext = {
  /** Instant in UTC */
  instant: Date;
  /** Julian Day (UTC-based, matches lib/cosmic/math) */
  jd: number;
  timeZone: string;
  lat: number;
  lon: number;
  /** Local civil Y-M-D in viewer's timezone (or host local if TZ unavailable) */
  localYear: number;
  localMonth: number;
  localDay: number;
  localHour: number;
  localMinute: number;
  localSecond: number;
  dayOfYear: number;
  /** Maya correlation: delphi Kin-1 anchor vs GMT 584283 */
  mayaCorrelation: "delphi_kin1" | "gmt_584283";
  ayanamsa: "lahiri" | "fagan_bradley";
};

export type CycleReading = {
  systemId: string;
  title: string;
  primary: string;
  secondary?: string;
  angleDeg: number;
  periodDays: number;
  meta: Record<string, string | number | boolean>;
  accuracy: AccuracyTier;
  sources: string[];
  family: PluginFamily;
  tier: PluginTier;
  region: string[];
  color: string;
  icon: string;
  category: string;
};

export type CyclePlugin = {
  id: string;
  title: string;
  family: PluginFamily;
  tier: PluginTier;
  region: string[];
  color: string;
  icon: string;
  category: string;
  defaultEnabled: boolean;
  resolve: (ctx: CycleContext) => CycleReading;
};

export type WorldCycleSnapshot = {
  capturedAtMs: number;
  isoDate: string;
  context: CycleContext;
  readings: CycleReading[];
  byId: Record<string, CycleReading>;
};

export type AtlasPresetId = "delphi_classic" | "abrahamic" | "asia" | "planet";

export type AtlasPreset = {
  id: AtlasPresetId;
  label: string;
  blurb: string;
  systemIds: string[];
};
```

---

## 2. `lib/worldCycles/registry.ts`

```ts
import type { CyclePlugin } from "./types";
import { chineseLunisolarPlugin } from "./plugins/chineseLunisolar";
import { chineseYearPlugin } from "./plugins/chineseYear";
import { ethiopianPlugin } from "./plugins/ethiopian";
import { galactic1320Plugin } from "./plugins/galactic1320";
import { gregorianPlugin } from "./plugins/gregorian";
import { hebrewPlugin } from "./plugins/hebrew";
import { hijriPlugin } from "./plugins/hijri";
import { lunarPlugin } from "./plugins/lunar";
import { persianPlugin } from "./plugins/persian";
import { tropicalPlugin } from "./plugins/tropical";
import { tzolkinPlugin } from "./plugins/tzolkin";

/** Canonical plugin registry — single source for Atlas / Clock / Moment. */
export const WORLD_CYCLE_PLUGINS: CyclePlugin[] = [
  gregorianPlugin,
  tropicalPlugin,
  lunarPlugin,
  chineseYearPlugin,
  chineseLunisolarPlugin,
  hijriPlugin,
  hebrewPlugin,
  persianPlugin,
  ethiopianPlugin,
  tzolkinPlugin,
  galactic1320Plugin,
];

const byId = new Map(WORLD_CYCLE_PLUGINS.map((p) => [p.id, p]));

export function getPlugin(id: string): CyclePlugin | undefined {
  return byId.get(id);
}

export function listPlugins(): CyclePlugin[] {
  return [...WORLD_CYCLE_PLUGINS];
}

export function defaultEnabledIds(): string[] {
  return WORLD_CYCLE_PLUGINS.filter((p) => p.defaultEnabled).map((p) => p.id);
}
```

---

## 3. `lib/worldCycles/plugins/lunar.ts`

```ts
import type { CyclePlugin } from "../types";

const KNOWN_NEW_MOON = Date.parse("2000-01-06T18:14:00Z");
const SYNODIC = 29.530588853;
const PHASES: [number, string, string][] = [
  [0.0625, "New Moon", "🌑"],
  [0.1875, "Waxing Crescent", "🌒"],
  [0.3125, "First Quarter", "🌓"],
  [0.4375, "Waxing Gibbous", "🌔"],
  [0.5625, "Full Moon", "🌕"],
  [0.6875, "Waning Gibbous", "🌖"],
  [0.8125, "Last Quarter", "🌗"],
  [1.0000, "Waning Crescent", "🌘"],
];

export const lunarPlugin: CyclePlugin = {
  id: "lunar_phase",
  title: "Lunar Phase",
  family: "calendar",
  tier: "A",
  region: ["global"],
  color: "#94a3b8",
  icon: "🌙",
  category: "lunar",
  defaultEnabled: true,
  resolve(ctx) {
    const elapsed = (ctx.instant.getTime() - KNOWN_NEW_MOON) / 86400000;
    const fraction = ((elapsed % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
    const angleDeg = fraction * 360;
    const found = PHASES.find(([t]) => fraction < t) ?? PHASES[PHASES.length - 1]!;
    return {
      systemId: "lunar_phase",
      title: "Lunar Phase",
      primary: `${found[2]} ${found[1]}`,
      secondary: `${(fraction * 100).toFixed(0)}% illuminated cycle`,
      angleDeg,
      periodDays: SYNODIC,
      meta: {
        phase: found[1],
        emoji: found[2],
        fraction: Number(fraction.toFixed(6)),
      },
      accuracy: "mean-orbit",
      sources: ["Synodic month from known new moon 2000-01-06"],
      family: "calendar",
      tier: "A",
      region: ["global"],
      color: "#94a3b8",
      icon: "🌙",
      category: "lunar",
    };
  },
};
```

---

## 4. `lib/cosmic/CosmicClockEngine.ts`

```ts
import { getCycleSnapshot } from "../cycleSystems";
import { computeSolarDayEvents, sunTropicalLongitude } from "./astronomy";
import {
  lunarPhaseFraction,
  muhurtaPhase,
  normalizeDeg,
  precessionAngleDeg,
  PRECESSION_PERIOD_YEARS,
  solarDayAngleDeg,
  tideCycle,
} from "./math";
import { buildSensorSnapshot, luxToSpectrum } from "./sensors";
import type { CosmicClockInput, CosmicClockState, CycleLayer } from "./types";

const CHINESE_ANIMALS = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];

/**
 * Central clock engine: one baseline timestamp drives every concentric cycle layer.
 * Mirrors the native Cosmic Clock architecture (Swift/Kotlin) in TypeScript for the web app.
 */
export class CosmicClockEngine {
  private input: CosmicClockInput;
  private lux: number | null = null;
  private pressureHpa: number | null = null;

  constructor(input: CosmicClockInput) {
    this.input = input;
  }

  setInput(partial: Partial<CosmicClockInput>): void {
    this.input = { ...this.input, ...partial };
  }

  setLux(lux: number | null): void {
    this.lux = lux;
  }

  setPressureHpa(hpa: number | null): void {
    this.pressureHpa = hpa;
  }

  /** Compute full state matrix for a single instant (ms-precision). */
  tick(now: Date = new Date()): CosmicClockState {
    const { lat, lon } = this.input;
    const dayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const solar = computeSolarDayEvents(dayLocal, lat, lon);
    const lunarPhase = lunarPhaseFraction(now);
    const lunarAngleDeg = normalizeDeg(lunarPhase * 360);
    const tide = tideCycle(now, lunarPhase);
    const muhurta = muhurtaPhase(now, solar.sunrise);
    const sunLon = sunTropicalLongitude(now);
    const precession = precessionAngleDeg(now);
    const solarDayAngle = solarDayAngleDeg(now, solar.solarNoon);

    const sensors = buildSensorSnapshot({
      lat,
      lon,
      headingDeg: this.input.headingDeg,
      altitudeM: this.input.altitudeM,
      pressureHpa: this.pressureHpa ?? this.input.pressureHpa ?? null,
      lux: this.lux ?? this.input.lux ?? null,
    });
    const ui = luxToSpectrum(sensors.lux);
    const cycles = getCycleSnapshot(now);
    const cnIdx = CHINESE_ANIMALS.indexOf(cycles.chineseZodiac.animal);

    const layers: CycleLayer[] = [
      {
        id: "barometric-breath",
        name: "Atmospheric Breath",
        tier: 1,
        angleDeg: normalizeDeg(sensors.atmosphericBreath * 360),
        phase: sensors.atmosphericBreath,
        color: "#67e8f9",
        meta: {
          pressureHpa: sensors.pressureHpa,
          deltaHpa: sensors.pressureDeltaHpa,
        },
      },
      {
        id: "light-spectrum",
        name: "Light Spectrum",
        tier: 1,
        angleDeg: normalizeDeg(sensors.lightSpectrum * 360),
        phase: sensors.lightSpectrum,
        color: ui.accent,
        meta: { lux: sensors.lux },
      },
      {
        id: "solar-day",
        name: "Terrestrial Day",
        tier: 2,
        angleDeg: solarDayAngle,
        phase: solarDayAngle / 360,
        color: "#f59e0b",
        meta: {
          solarNoonMs: solar.solarNoon.getTime(),
          sunriseMs: solar.sunrise.getTime(),
          sunsetMs: solar.sunset.getTime(),
        },
      },
      {
        id: "lunar-synodic",
        name: "Lunar Synodic",
        tier: 3,
        angleDeg: lunarAngleDeg,
        phase: lunarPhase,
        color: "#94a3b8",
        meta: { illumination: Math.round(lunarPhase * 1000) / 10 },
      },
      {
        id: "tidal",
        name: "Tidal Cycle",
        tier: 3,
        angleDeg: tide.angleDeg,
        phase: tide.angleDeg / 360,
        color: "#0891b2",
        meta: { label: tide.label },
      },
      {
        id: "muhurta",
        name: "Vedic Muhurta",
        tier: 4,
        angleDeg: muhurta.angleDeg,
        phase: (muhurta.index + (muhurta.angleDeg % (360 / 30)) / (360 / 30)) / 30,
        color: "#a855f7",
        meta: { index: muhurta.index, total: 30 },
      },
      {
        id: "tzolkin",
        name: "Tzolkin",
        tier: 4,
        angleDeg: normalizeDeg(((cycles.tzolkin.kin - 1) / 260) * 360),
        phase: cycles.tzolkin.kin / 260,
        color: "#7c3aed",
        meta: {
          kin: cycles.tzolkin.kin,
          sign: cycles.tzolkin.sign,
          tone: cycles.galactic.tone.name,
          tribe: `${cycles.galactic.tribe.color} ${cycles.galactic.tribe.name}`,
          affirmation: cycles.galactic.affirmation,
        },
      },
      {
        id: "chinese-zodiac",
        name: "Chinese Zodiac Day",
        tier: 4,
        angleDeg: normalizeDeg(((cnIdx >= 0 ? cnIdx : 0) / 12) * 360),
        phase: (cnIdx >= 0 ? cnIdx : 0) / 12,
        color: "#dc2626",
        meta: { animal: cycles.chineseZodiac.animal },
      },
      {
        id: "sun-ecliptic",
        name: "Solar Season",
        tier: 5,
        angleDeg: sunLon,
        phase: sunLon / 360,
        color: "#f97316",
        meta: { longitude: sunLon, sign: cycles.westernZodiac.sign },
      },
      {
        id: "precession",
        name: "Great Year",
        tier: 6,
        angleDeg: precession,
        phase: precession / 360,
        color: "#6366f1",
        meta: { periodYears: PRECESSION_PERIOD_YEARS },
      },
    ];

    return {
      timestampMs: now.getTime(),
      now,
      sensors,
      solar,
      solarDayAngleDeg: solarDayAngle,
      lunarPhaseFraction: lunarPhase,
      lunarAngleDeg,
      tideAngleDeg: tide.angleDeg,
      tideLabel: tide.label,
      muhurtaIndex: muhurta.index,
      muhurtaAngleDeg: muhurta.angleDeg,
      sunTropicalLongitudeDeg: sunLon,
      precessionAngleDeg: precession,
      ui,
      layers,
    };
  }
}

export function createCosmicClockEngine(input: CosmicClockInput): CosmicClockEngine {
  return new CosmicClockEngine(input);
}
```

---

## 5. `types/cosmos.ts`

```ts
// ───────────────────────────────────────────────────────────────
// COSMOS · shared types
// ───────────────────────────────────────────────────────────────

export type TabId = 'sky' | 'clock' | 'moment';

export interface GeoCoords {
  lat: number;
  lon: number;
}

export interface SensorData {
  alpha: number; // compass heading  (z)
  beta: number;  // front-back tilt  (x)
  gamma: number; // left-right tilt  (y)
  available: boolean;
  permission: 'unknown' | 'granted' | 'denied' | 'unsupported';
}

export interface WeatherData {
  tempC: number;
  code: number;          // WMO weather code
  description: string;
  isDay: boolean;
  cloudCover: number;    // %
  windKph: number;
  fetchedAt: number;     // epoch ms
}

export interface UserProfile {
  name?: string;
  birthISO?: string;     // ISO datetime of birth
  birthCoords?: GeoCoords;
}

// A single celestial body resolved for a given instant.
export interface CelestialBody {
  id: string;
  label: string;
  kind: 'sun' | 'moon' | 'planet' | 'star';
  ra: number;            // right ascension, degrees 0–360
  dec: number;           // declination, degrees -90–90
  magnitude?: number;
  glyph?: string;
  archetype?: string;
}

// One cultural cycle ring resolved to "where is the pointer now".
export interface CycleState {
  id: string;
  ring: string;          // human ring name
  activeIndex: number;
  count: number;
  label: string;         // active segment label
  detail?: string;
  fraction: number;      // 0–1 progress through the active segment
  rotation: number;      // degrees to rotate ring so active sits at 12 o'clock
  culture: string;
  blurb: string;         // history shown in flyout
}

export interface MomentReading {
  headline: string;
  body: string;
  shadow: string;
  focus: string;
  tags: string[];
}
```

---

## 6. `lib/worldCycles/snapshotBridge.ts`

```ts
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
```
