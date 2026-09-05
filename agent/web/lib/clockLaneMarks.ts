/**
 * Sonic keys for the orrery lanes + default-on time units.
 * Fast units are tracked as gentle harmonic pulses; larger boundaries keep
 * their own restrained timbres.
 */

import { computeSolarDayEvents } from "./cosmic/astronomy";
import { computeOrreryState, type OrreryLaneId } from "./lore/orreryLanes";

export type ClockLaneMarks = {
  helek: number;
  prana: number;
  pala: number;
  ghati: number;
  muhurta: number;
  planetaryHour: string;
  shi: number;
  ke: number;
  beat: number;
  pancawara: number;
  moon: number;
  wuku: number;
  season: number;
  crossedSunrise: boolean;
  crossedSunset: boolean;
};

const PLANETS = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"] as const;

function zoneFor(lat: number, lon: number): string {
  if (lon >= -100 && lon <= -70 && lat >= 24 && lat <= 50) return "America/Chicago";
  if (lon >= 30 && lon <= 36 && lat >= 33 && lat <= 36) return "Asia/Nicosia";
  return "UTC";
}

function civilSeconds(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 3600 + get("minute") * 60 + get("second");
}

/** Swatch .beat — 1000 / day from BMT (UTC+1), no time zones. */
export function beatIndex(date: Date): number {
  const bmtMs = date.getTime() + 3_600_000;
  const d = new Date(bmtMs);
  const secs =
    d.getUTCHours() * 3600 +
    d.getUTCMinutes() * 60 +
    d.getUTCSeconds() +
    d.getUTCMilliseconds() / 1000;
  return Math.floor(secs / 86.4) % 1000;
}

/** Classical kè — 100 / civil day from local midnight (14.4 min). */
export function keIndex(date: Date, lat: number, lon: number): number {
  return Math.floor(civilSeconds(date, zoneFor(lat, lon)) / 864) % 100;
}

function laneIndex(lanes: ReturnType<typeof computeOrreryState>["lanes"], id: OrreryLaneId): number {
  return lanes.find((l) => l.id === id)?.index ?? 0;
}

function validTime(d: Date): boolean {
  return Number.isFinite(d.getTime());
}

function crossed(prevMs: number | undefined, nowMs: number, event: Date): boolean {
  if (prevMs == null || !validTime(event)) return false;
  const t = event.getTime();
  return prevMs < t && nowMs >= t;
}

export function readClockLaneMarks(
  date: Date,
  lat: number,
  lon: number,
  prevMs?: number,
): ClockLaneMarks {
  const { lanes } = computeOrreryState(date, lat, lon);
  const phIdx = Math.max(0, laneIndex(lanes, "planetary-hour")) % PLANETS.length;
  const solar = computeSolarDayEvents(date, lat, lon);
  const nowMs = date.getTime();

  return {
    helek: laneIndex(lanes, "helek"),
    prana: laneIndex(lanes, "prana"),
    pala: laneIndex(lanes, "pala"),
    ghati: laneIndex(lanes, "ghati"),
    muhurta: laneIndex(lanes, "muhurta"),
    planetaryHour: PLANETS[phIdx] ?? "sun",
    shi: laneIndex(lanes, "shi"),
    ke: keIndex(date, lat, lon),
    beat: beatIndex(date),
    pancawara: laneIndex(lanes, "pancawara"),
    moon: laneIndex(lanes, "moon"),
    wuku: laneIndex(lanes, "wuku-tzolkin"),
    season: laneIndex(lanes, "season"),
    crossedSunrise: crossed(prevMs, nowMs, solar.sunrise),
    crossedSunset: crossed(prevMs, nowMs, solar.sunset),
  };
}

export function marksKey(m: ClockLaneMarks): string {
  return [
    m.helek,
    m.prana,
    m.pala,
    m.ghati,
    m.muhurta,
    m.planetaryHour,
    m.shi,
    m.ke,
    m.beat,
    m.pancawara,
    m.moon,
    m.wuku,
    m.season,
  ].join(":");
}
