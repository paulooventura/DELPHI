import { julianDay } from "../cosmic/math";
import type { CycleContext } from "./types";

export type CycleContextOptions = {
  timeZone?: string;
  lat?: number;
  lon?: number;
  ayanamsa?: CycleContext["ayanamsa"];
};

function partsInZone(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const bag = Object.fromEntries(
      fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const hour = bag.hour === "24" ? 0 : Number(bag.hour);
    return {
      year: Number(bag.year),
      month: Number(bag.month),
      day: Number(bag.day),
      hour,
      minute: Number(bag.minute),
      second: Number(bag.second),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
}

function dayOfYearFromYmd(y: number, m: number, d: number): number {
  const start = Date.UTC(y, 0, 0);
  const cur = Date.UTC(y, m - 1, d);
  return Math.round((cur - start) / 86400000);
}

export function buildCycleContext(date: Date = new Date(), opts: CycleContextOptions = {}): CycleContext {
  const timeZone = opts.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const p = partsInZone(date, timeZone);
  return {
    instant: date,
    jd: julianDay(date),
    timeZone,
    lat: opts.lat ?? 0,
    lon: opts.lon ?? 0,
    localYear: p.year,
    localMonth: p.month,
    localDay: p.day,
    localHour: p.hour,
    localMinute: p.minute,
    localSecond: p.second,
    dayOfYear: dayOfYearFromYmd(p.year, p.month, p.day),
    ayanamsa: opts.ayanamsa ?? "lahiri",
  };
}
