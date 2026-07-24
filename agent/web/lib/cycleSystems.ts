import {
  galacticDayFromKin,
  type GalacticDayReading,
} from "./galacticFrequency";
// Deep imports avoid barrel ↔ facade circular init (clockAdapter/snapshotBridge).
import { resolveWorldCycles } from "./worldCycles/resolveWorldCycles";
import { worldCyclesToCycleSnapshot } from "./worldCycles/snapshotBridge";

// ─── Types ────────────────────────────────────────────────────────────────

export type WheelLayer = {
  id: string;
  name: string;
  icon: string;
  label: string;
  sublabel: string;
  angleDeg: number;     // 0-360 current position
  periodDays: number;   // full revolution length in days
  color: string;        // ring stroke color
  category: string;
};

export type WeatherInfo = {
  condition: string;
  emoji: string;
  tempC: number | null;
  windKmh: number | null;
  /** Sea-level adjusted surface pressure (hPa) for barometric breath ring */
  pressureHpa: number | null;
  /** WMO code + cloud cover for current conditions */
  weatherCode?: number | null;
  cloudCover?: number | null;
  isDay?: boolean;
  precipProb?: number | null;
  /** Local forecast per clock hour (0–23) in the viewer's timezone */
  hourly?: Array<{
    hour: number;
    emoji: string;
    condition: string;
    weatherCode?: number | null;
    tempC: number | null;
    precipProb?: number | null;
    cloudCover?: number | null;
    isDay?: boolean;
  }>;
};

export function daysInMonth(year: number, monthNum: number): number {
  return new Date(year, monthNum, 0).getDate();
}

/** WMO weather interpretation codes (Open-Meteo). */
export function weatherCodeToEmoji(code: number, isDay = true): { emoji: string; condition: string } {
  const condition =
    code === 0 ? "Clear sky"
    : code === 1 ? "Mainly clear"
    : code === 2 ? "Partly cloudy"
    : code === 3 ? "Overcast"
    : code === 45 ? "Fog"
    : code === 48 ? "Rime fog"
    : code === 51 ? "Light drizzle"
    : code === 53 ? "Drizzle"
    : code === 55 ? "Dense drizzle"
    : code === 56 || code === 57 ? "Freezing drizzle"
    : code === 61 ? "Light rain"
    : code === 63 ? "Rain"
    : code === 65 ? "Heavy rain"
    : code === 66 || code === 67 ? "Freezing rain"
    : code === 71 ? "Light snow"
    : code === 73 ? "Snow"
    : code === 75 ? "Heavy snow"
    : code === 77 ? "Snow grains"
    : code === 80 ? "Light showers"
    : code === 81 ? "Showers"
    : code === 82 ? "Heavy showers"
    : code === 85 ? "Snow showers"
    : code === 86 ? "Heavy snow showers"
    : code === 95 ? "Thunderstorm"
    : code === 96 || code === 99 ? "Thunderstorm with hail"
    : "Unknown";

  const emoji =
    code === 0 ? (isDay ? "☀️" : "🌙")
    : code === 1 ? (isDay ? "🌤️" : "🌙")
    : code === 2 ? "⛅"
    : code === 3 ? "☁️"
    : code === 45 || code === 48 ? "🌫️"
    : code >= 51 && code <= 57 ? "🌦️"
    : code >= 61 && code <= 67 ? "🌧️"
    : code >= 71 && code <= 77 ? "❄️"
    : code >= 80 && code <= 82 ? "🌦️"
    : code >= 85 && code <= 86 ? "🌨️"
    : code >= 95 ? "⛈️"
    : "·";

  return { emoji, condition };
}

export type CycleSnapshot = {
  capturedAtMs: number;
  isoDate: string;
  gregorian: {
    weekday: string;
    weekdayShort: string;
    month: string;
    monthShort: string;
    monthNum: number;
    day: number;
    year: number;
    dayOfYear: number;
    weekOfYear: number;
    daysInMonth: number;
  };
  westernZodiac: { sign: string; symbol: string };
  chineseZodiac: { animal: string; element: string; yinYang: "Yin" | "Yang"; symbol: string };
  tzolkin: { tone: number; sign: string; kin: number };
  /** 13 Tones of Creation × 20 Tribes of Time (13:20 galactic frequency) */
  galactic: GalacticDayReading;
  mayan: { wavespell: number; castle: number; castleName: string; castleColor: string };
  lunar: { phase: string; emoji: string; fraction: number; angleDeg: number };
  season: { name: string; emoji: string; dayInSeason: number; angleDeg: number };
  weather?: WeatherInfo;
  spectrum: Array<{ name: string; axis: "evidence" | "cultural" | "philosophical"; score: number; note: string }>;
  wheelLayers: WheelLayer[];  // calendar/astronomical only — clock wheels are in the frontend
  /** Optional World Cycle ids used for this snapshot (Atlas prefs). */
  enabledSystemIds?: string[];
};

export type GetCycleSnapshotOptions = {
  enabledIds?: string[];
  timeZone?: string;
  lat?: number;
  lon?: number;
  ayanamsa?: "lahiri" | "fagan_bradley";
};

/**
 * Facade over resolveWorldCycles — Clock / Moment / API keep this entry point.
 * Tropical zodiac is solar λ (no date-cutoff drift).
 * Always resolves the full registry so CycleSnapshot core fields stay complete;
 * `enabledIds` only gates optional Atlas rings / UI preferences.
 */
export function getCycleSnapshot(
  input?: Date,
  weather?: WeatherInfo,
  opts?: GetCycleSnapshotOptions,
): CycleSnapshot {
  const date = input ?? new Date();
  const world = resolveWorldCycles({
    date,
    timeZone: opts?.timeZone,
    lat: opts?.lat,
    lon: opts?.lon,
    ayanamsa: opts?.ayanamsa,
  });
  const snap = worldCyclesToCycleSnapshot(world, weather, opts?.enabledIds);
  return { ...snap, enabledSystemIds: opts?.enabledIds };
}

// Re-export for callers that only need galactic helper typing continuity
export { galacticDayFromKin };
