/**
 * Sky alerts — planned on this device, delivered as local notifications.
 *
 * Moon phases come from astronomy-engine; visible ISS passes from SGP4 over the
 * place the user saved for alerts. The place is rounded to ~1 km, kept in
 * localStorage, and never sent anywhere: the only network call is fetching the
 * public ISS orbit elements.
 */

import { Body, Horizon, Equator, GeoVector, Observer, SearchMoonPhase, SearchRiseSet } from "astronomy-engine";
import { ecfToLookAngles, eciToEcf, gstime, json2satrec, propagate, type SatRec } from "../sgp4";
import { rowToOmm, type GpRow } from "../orbitRows";
import { RE_KM } from "../orbits";

export type AlertPlace = { lat: number; lon: number; label: string };
export type AlertPrefs = { moon: boolean; iss: boolean; place: AlertPlace | null };
export type PlannedAlert = { id: number; at: Date; title: string; body: string };

export const ALERT_PREFS_KEY = "pm-sky-alerts-v1";
export const MOON_ID_BASE = 7_100_000;
export const ISS_ID_BASE = 7_200_000;
export const ISS_NORAD = 25544;

const DEFAULT_PREFS: AlertPrefs = { moon: false, iss: false, place: null };
const DEG = Math.PI / 180;

export function roundPlace(lat: number, lon: number, label = ""): AlertPlace {
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, label: label.slice(0, 60) };
}

export function loadAlertPrefs(): AlertPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const p = JSON.parse(localStorage.getItem(ALERT_PREFS_KEY) || "null") as Partial<AlertPrefs> | null;
    if (!p) return { ...DEFAULT_PREFS };
    const place =
      p.place && Number.isFinite(p.place.lat) && Number.isFinite(p.place.lon)
        ? roundPlace(p.place.lat, p.place.lon, String(p.place.label || ""))
        : null;
    return { moon: !!p.moon, iss: !!p.iss && !!place, place };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveAlertPrefs(p: AlertPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ALERT_PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

const clock = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function compass(azDeg: number): string {
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8]!;
}

/** The local evening a phase belongs to: 19:00 on the date of (instant − 12 h). */
export function eveningOf(instant: Date): Date {
  const d = new Date(instant.getTime() - 12 * 3600_000);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 19, 0, 0, 0);
}

/** Full and new moons in [from, from + days], one notification each on their evening. */
export function planMoonAlerts(from: Date, days: number, place: AlertPlace | null): PlannedAlert[] {
  const out: PlannedAlert[] = [];
  const end = from.getTime() + days * 86400_000;
  const obs = place ? new Observer(place.lat, place.lon, 0) : null;
  for (const [lon, name] of [
    [180, "Full moon"],
    [0, "New moon"],
  ] as const) {
    let t: Date = from;
    while (t.getTime() < end) {
      const hit = SearchMoonPhase(lon, t, 40);
      if (!hit || hit.date.getTime() > end) break;
      const instant = hit.date;
      let at = eveningOf(instant);
      if (at.getTime() <= from.getTime()) at = new Date(from.getTime() + 60_000);
      let body = `${name} at ${clock(instant)}.`;
      if (obs && lon === 180) {
        const rise = SearchRiseSet(Body.Moon, obs, +1, new Date(at.getTime() - 6 * 3600_000), 1);
        if (rise) body = `${name} at ${clock(instant)}. Moonrise ${clock(rise.date)}.`;
      } else if (lon === 0) {
        body = `${name} at ${clock(instant)}. Darkest skies of the month for stars.`;
      }
      out.push({ id: 0, at, title: name === "Full moon" ? "Full moon tonight" : "New moon tonight", body });
      t = new Date(instant.getTime() + 86400_000);
    }
  }
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.map((a, i) => ({ ...a, id: MOON_ID_BASE + i }));
}

export type IssPass = { rise: Date; peak: Date; set: Date; maxElDeg: number; riseAz: number; setAz: number };

type Vec = { x: number; y: number; z: number };

function sunUnit(date: Date): Vec {
  const v = GeoVector(Body.Sun, date, false);
  const m = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

/** Cylindrical Earth shadow; good enough to say "you'll see it". */
function sunlit(r: Vec, s: Vec): boolean {
  const along = r.x * s.x + r.y * s.y + r.z * s.z;
  if (along > 0) return true;
  const px = r.x - along * s.x;
  const py = r.y - along * s.y;
  const pz = r.z - along * s.z;
  return Math.hypot(px, py, pz) > RE_KM;
}

function sunAltDeg(date: Date, obs: Observer): number {
  const eq = Equator(Body.Sun, date, obs, true, true);
  return Horizon(date, obs, eq.ra, eq.dec, "normal").altitude;
}

/** Passes above `minElDeg` in the window, with the observer in dusk/dark and the ISS sunlit at peak. */
export function findVisiblePasses(
  rec: SatRec,
  place: AlertPlace,
  from: Date,
  hours: number,
  { stepS = 20, minElDeg = 10, minPeakDeg = 20 } = {},
): IssPass[] {
  const obsGeo = { latitude: place.lat * DEG, longitude: place.lon * DEG, height: 0 };
  const obs = new Observer(place.lat, place.lon, 0);
  const passes: IssPass[] = [];
  let cur: { rise: Date; riseAz: number; peak: Date; maxEl: number; peakR: Vec } | null = null;
  let lastAz = 0;
  const end = from.getTime() + hours * 3600_000;
  for (let t = from.getTime(); t <= end; t += stepS * 1000) {
    const date = new Date(t);
    const pv = propagate(rec, date);
    if (!pv || typeof pv.position !== "object") continue;
    const r = pv.position as Vec;
    const look = ecfToLookAngles(obsGeo, eciToEcf(r, gstime(date)));
    const el = look.elevation / DEG;
    const az = look.azimuth / DEG;
    if (el >= minElDeg) {
      if (!cur) cur = { rise: date, riseAz: az, peak: date, maxEl: el, peakR: r };
      else if (el > cur.maxEl) {
        cur.maxEl = el;
        cur.peak = date;
        cur.peakR = r;
      }
    } else if (cur) {
      const visible =
        cur.maxEl >= minPeakDeg && sunAltDeg(cur.peak, obs) < -6 && sunlit(cur.peakR, sunUnit(cur.peak));
      if (visible) {
        passes.push({ rise: cur.rise, peak: cur.peak, set: date, maxElDeg: cur.maxEl, riseAz: cur.riseAz, setAz: lastAz });
      }
      cur = null;
    }
    lastAz = az;
  }
  return passes;
}

export function issRecFromRow(row: GpRow): SatRec | null {
  try {
    return json2satrec(rowToOmm(row) as never);
  } catch {
    return null;
  }
}

/** Visible ISS passes → notifications 5 minutes before each rise. */
export function planIssAlerts(rec: SatRec, place: AlertPlace, from: Date, hours = 72, max = 12): PlannedAlert[] {
  return findVisiblePasses(rec, place, from, hours)
    .filter(p => p.rise.getTime() - 5 * 60_000 > from.getTime())
    .slice(0, max)
    .map((p, i) => {
      const mins = Math.max(1, Math.round((p.set.getTime() - p.rise.getTime()) / 60_000));
      return {
        id: ISS_ID_BASE + i,
        at: new Date(p.rise.getTime() - 5 * 60_000),
        title: "ISS overhead in 5 minutes",
        body: `Rises in the ${compass(p.riseAz)} at ${clock(p.rise)}, peaks ${Math.round(p.maxElDeg)}° high, sets in the ${compass(p.setAz)}. About ${mins} min.`,
      };
    });
}
