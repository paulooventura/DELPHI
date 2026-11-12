/**
 * Weather from MET Norway's Locationforecast 2.0 (T336, Paulo 2026-11-12: MET Norway with its credit line).
 * Free for commercial use under CC BY 4.0 / NLOD with the credit "Weather: MET Norway" shown with the weather.
 * Terms: https://api.met.no/doc/TermsOfService (identify the app in User-Agent, at most 4 decimals in coordinates,
 * respect caching). Pure conversion into the app's WeatherInfo so it can be tested.
 */
import { weatherCodeToEmoji, type WeatherInfo } from "./cycleSystems";
import { subsolarPoint, sunElevation } from "./daynight";

export const MET_CREDIT = "Weather: MET Norway";

type MetSeries = {
  time: string;
  data: {
    instant?: { details?: Record<string, number> };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: Record<string, number> };
    next_6_hours?: { summary?: { symbol_code?: string }; details?: Record<string, number> };
  };
};

/** MET symbol ("lightrainshowers_day") → the WMO code the app's icons and words already use. */
export function metSymbolToWmo(symbol: string): number {
  const s = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (s.includes("thunder")) return s.includes("heavy") ? 99 : 95;
  if (s === "clearsky") return 0;
  if (s === "fair") return 1;
  if (s === "partlycloudy") return 2;
  if (s === "cloudy") return 3;
  if (s === "fog") return 45;
  if (s.includes("sleet")) return s.includes("heavy") ? 67 : 66;
  if (s.includes("snowshowers")) return s.includes("heavy") ? 86 : 85;
  if (s.includes("snow")) return s.startsWith("heavy") ? 75 : s.startsWith("light") ? 71 : 73;
  if (s.includes("rainshowers")) return s.startsWith("heavy") ? 82 : s.startsWith("light") ? 80 : 81;
  if (s.includes("rain")) return s.startsWith("heavy") ? 65 : s.startsWith("light") ? 61 : 63;
  return 3;
}

/** Local date (YYYY-MM-DD) and hour of a UTC instant in an IANA zone. */
function localParts(iso: string, timeZone: string): { date: string; hour: number } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24 };
}

function isDayAt(iso: string, symbol: string | undefined, lat: number, lon: number): boolean {
  if (symbol?.endsWith("_day")) return true;
  if (symbol?.endsWith("_night") || symbol?.endsWith("_polartwilight")) return false;
  const d = new Date(iso);
  return sunElevation(lat, lon, subsolarPoint(d)) > -0.833;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function metToWeather(
  json: unknown,
  opts: { lat: number; lon: number; timeZone: string; localDate?: string; nowMs?: number },
): WeatherInfo | undefined {
  const series = ((json as { properties?: { timeseries?: MetSeries[] } })?.properties?.timeseries ?? []).filter(s => s?.time);
  if (!series.length) return undefined;
  const now = opts.nowMs ?? Date.now();
  // "Current" = the latest step at or before now (the first step if the forecast starts later).
  let cur = series[0]!;
  for (const s of series) if (Date.parse(s.time) <= now) cur = s;

  const symbolOf = (s: MetSeries) => s.data.next_1_hours?.summary?.symbol_code ?? s.data.next_6_hours?.summary?.symbol_code;
  const curSymbol = symbolOf(cur) ?? "cloudy";
  const code = metSymbolToWmo(curSymbol);
  const curIsDay = isDayAt(cur.time, curSymbol, opts.lat, opts.lon);
  const { emoji, condition } = weatherCodeToEmoji(code, curIsDay);
  const det = cur.data.instant?.details ?? {};

  const target = opts.localDate ?? localParts(new Date(now).toISOString(), opts.timeZone).date;
  const hourly: WeatherInfo["hourly"] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    emoji: "·",
    condition: "",
    tempC: null,
    precipProb: null,
    cloudCover: null,
    isDay: hour >= 6 && hour < 20,
  }));
  for (const s of series) {
    const { date, hour } = localParts(s.time, opts.timeZone);
    if (date !== target || hourly[hour]!.emoji !== "·") continue;
    const sym = symbolOf(s);
    if (!sym) continue;
    const hCode = metSymbolToWmo(sym);
    const isDay = isDayAt(s.time, sym, opts.lat, opts.lon);
    const meta = weatherCodeToEmoji(hCode, isDay);
    hourly[hour] = {
      hour,
      emoji: meta.emoji,
      condition: meta.condition,
      weatherCode: hCode,
      tempC: num(s.data.instant?.details?.air_temperature),
      // Only where MET publishes it (mostly the Nordics); never guessed from the amount.
      precipProb: num(s.data.next_1_hours?.details?.probability_of_precipitation),
      cloudCover: num(s.data.instant?.details?.cloud_area_fraction),
      isDay,
    };
  }
  // Hours MET doesn't cover (earlier today, or 6-hour steps later): the nearest filled hour.
  for (let h = 0; h < 24; h++) {
    if (hourly[h]!.emoji !== "·") continue;
    let near: (typeof hourly)[number] | undefined;
    for (let d = 1; d < 24 && !near; d++) {
      const a = hourly[h - d];
      const b = hourly[h + d];
      near = a && a.emoji !== "·" ? a : b && b.emoji !== "·" ? b : undefined;
    }
    hourly[h] = {
      hour: h,
      emoji: near?.emoji ?? emoji,
      condition: near?.condition ?? condition,
      weatherCode: near?.weatherCode ?? code,
      tempC: near?.tempC ?? num(det.air_temperature),
      precipProb: near?.precipProb ?? null,
      cloudCover: near?.cloudCover ?? null,
      isDay: h >= 6 && h < 20,
    };
  }
  const curHour = localParts(new Date(now).toISOString(), opts.timeZone).hour;
  const wind = num(det.wind_speed);
  return {
    condition,
    emoji,
    tempC: num(det.air_temperature),
    windKmh: wind == null ? null : Math.round(wind * 3.6 * 10) / 10,
    pressureHpa: num(det.air_pressure_at_sea_level),
    weatherCode: code,
    cloudCover: num(det.cloud_area_fraction) ?? hourly[curHour]?.cloudCover ?? null,
    isDay: curIsDay,
    precipProb: num(cur.data.next_1_hours?.details?.probability_of_precipitation) ?? hourly[curHour]?.precipProb ?? null,
    hourly,
  };
}
