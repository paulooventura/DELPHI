import { gmstDeg, lstDeg } from "./starmap";

export function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

/** Local civil time with millisecond precision. */
export function formatLocalTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/** UTC with millisecond precision. */
export function formatUtcTime(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} `
    + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
}

export function timezoneMeta(date: Date): { name: string; offset: string } {
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "−";
  const abs = Math.abs(offsetMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const offset = m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${pad(m)}`;
  return { name, offset };
}

export function formatLat(deg: number): string {
  const hemi = deg >= 0 ? "N" : "S";
  return `${hemi} ${Math.abs(deg).toFixed(8)}°`;
}

export function formatLon(deg: number): string {
  const hemi = deg >= 0 ? "E" : "W";
  return `${hemi} ${Math.abs(deg).toFixed(8)}°`;
}

export function formatDegrees(deg: number, places = 4): string {
  const n = ((deg % 360) + 360) % 360;
  return `${n.toFixed(places)}°`;
}

export function formatMeters(m: number | null, places = 2): string | null {
  if (m == null || !Number.isFinite(m)) return null;
  return `${m.toFixed(places)} m`;
}

export function formatSpeedMps(mps: number | null): string | null {
  if (mps == null || !Number.isFinite(mps)) return null;
  return `${mps.toFixed(3)} m/s (${(mps * 3.6).toFixed(2)} km/h)`;
}

export type SpacetimeSnapshot = {
  localTime: string;
  utcTime: string;
  tzName: string;
  tzOffset: string;
  unixMs: number;
  julianDay: string;
  gmst: string;
  lst: string;
  lat: string;
  lon: string;
};

export function buildSpacetimeSnapshot(date: Date, lat: number, lon: number): SpacetimeSnapshot {
  const tz = timezoneMeta(date);
  return {
    localTime: formatLocalTime(date),
    utcTime: formatUtcTime(date),
    tzName: tz.name,
    tzOffset: tz.offset,
    unixMs: date.getTime(),
    julianDay: julianDate(date).toFixed(6),
    gmst: gmstDeg(date).toFixed(6),
    lst: lstDeg(date, lon).toFixed(6),
    lat: formatLat(lat),
    lon: formatLon(lon),
  };
}
