/**
 * resolveMoment — what's active *now* (computed entries only).
 *
 * Given (jd, lat, lon), returns the moment-pool qualia ids for the traditions
 * that can be resolved from ephemeris + civil calendars. Never cast, never birth.
 */

import { computePhases } from "../phase/engine";
import { dateFromJd } from "../phase/timeResolution";
import { buildCycleContext } from "../worldCycles/context";
import { chineseYearPlugin } from "../worldCycles/plugins/chineseYear";
import { tzolkinPlugin } from "../worldCycles/plugins/tzolkin";
import { ayanamsa, localSiderealTime } from "../../services/astronomyEngine";
import { byId, type QualiaEntry } from "./qualia";

const WZ = [
  "wz-aries", "wz-taurus", "wz-gemini", "wz-cancer", "wz-leo", "wz-virgo",
  "wz-libra", "wz-scorpio", "wz-sagittarius", "wz-capricorn", "wz-aquarius", "wz-pisces",
] as const;

const VSZ = [
  "vsz-mesha", "vsz-vrishabha", "vsz-mithuna", "vsz-karka", "vsz-simha", "vsz-kanya",
  "vsz-tula", "vsz-vrishchika", "vsz-dhanus", "vsz-makara", "vsz-kumbha", "vsz-meena",
] as const;

const MP = [
  "mp-new", "mp-wax-cres", "mp-first-q", "mp-wax-gib",
  "mp-full", "mp-wan-gib", "mp-last-q", "mp-wan-cres",
] as const;

const NK = [
  "nk-ashwini", "nk-bharani", "nk-krittika", "nk-rohini", "nk-mrigashira", "nk-ardra",
  "nk-punarvasu", "nk-pushya", "nk-ashlesha", "nk-magha", "nk-purva-phalguni", "nk-uttara-phalguni",
  "nk-hasta", "nk-chitra", "nk-swati", "nk-vishakha", "nk-anuradha", "nk-jyeshtha",
  "nk-mula", "nk-purva-ashadha", "nk-uttara-ashadha", "nk-shravana", "nk-dhanishta",
  "nk-shatabhisha", "nk-purva-bhadrapada", "nk-uttara-bhadrapada", "nk-revati",
] as const;

const PD = [
  "pd-sun", "pd-moon", "pd-mars", "pd-mercury", "pd-jupiter", "pd-venus", "pd-saturn",
] as const;

/** Plugin sign spelling → qualia tz-* slug. */
const TZ_SIGN: Record<string, string> = {
  Imix: "tz-imix",
  Ik: "tz-ik",
  Akbal: "tz-akbal",
  Kan: "tz-kan",
  Chikchan: "tz-chicchan",
  Kimi: "tz-cimi",
  Manik: "tz-manik",
  Lamat: "tz-lamat",
  Muluk: "tz-muluc",
  Ok: "tz-oc",
  Chuen: "tz-chuen",
  Eb: "tz-eb",
  Ben: "tz-ben",
  Ix: "tz-ix",
  Men: "tz-men",
  Kib: "tz-cib",
  Kaban: "tz-caban",
  Etznab: "tz-etznab",
  Kawak: "tz-cauac",
  Ajaw: "tz-ahau",
};

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/**
 * Ecliptic longitude of the Ascendant (rising degree) — the 10° band that is
 * currently rising maps to an Egyptian decan. ε ≈ J2000 mean obliquity.
 */
function risingEclipticLon(jd: number, latDeg: number, lonDeg: number): number {
  const D2R = Math.PI / 180;
  const eps = 23.4392911 * D2R;
  const φ = latDeg * D2R;
  const θ = localSiderealTime(jd, lonDeg) * D2R; // RAMC in radians
  // λ = atan2( cos θ , −(sin θ cos ε + tan φ sin ε) )
  const y = Math.cos(θ);
  const x = -(Math.sin(θ) * Math.cos(eps) + Math.tan(φ) * Math.sin(eps));
  return norm360((Math.atan2(y, x) * 180) / Math.PI);
}

export type MomentResolution = {
  ids: string[];
  entries: QualiaEntry[];
  meta: {
    sunTropicalDeg: number;
    sunSiderealDeg: number;
    moonPhase: number;
    moonSiderealDeg: number;
    risingEclipticDeg: number;
    tzolkinSign: string;
    tzolkinTone: number;
    chineseAnimal: string;
    chineseElement: string;
  };
};

/**
 * Resolve the active computed moment entries for an instant.
 * Returns only `nature === "computed"` entries from the moment pool.
 */
export function resolveMoment(jd: number, lat: number, lon: number): MomentResolution {
  const phases = computePhases(jd, {
    lat,
    lon,
    ayanamsa: "lahiri",
    only: ["tropical-year", "lunar-synodic", "lunar-sidereal"],
  });

  const sunTropical = Number(phases.byId["tropical-year"]?.meta?.solarLongitudeDeg
    ?? (phases.byId["tropical-year"]?.phase ?? 0) * 360);
  const ayan = ayanamsa(jd);
  const sunSidereal = norm360(sunTropical - ayan);

  const moonPhase = phases.byId["lunar-synodic"]?.phase ?? 0; // 0 new → 0.5 full
  const moonTropical = Number(
    phases.byId["lunar-sidereal"]?.meta?.eclipticLongitudeDeg
      ?? (phases.byId["lunar-sidereal"]?.phase ?? 0) * 360,
  );
  const moonSidereal = norm360(moonTropical - ayan);

  const rising = risingEclipticLon(jd, lat, lon);

  const instant = dateFromJd(jd);
  // Prefer a zone near the observer so civil DOW / CNY / Tzolk'in use local date.
  let timeZone = "UTC";
  try {
    // coarse: Americas east → America/Chicago for Nashville-class coords
    if (lon >= -100 && lon <= -70 && lat >= 24 && lat <= 50) timeZone = "America/Chicago";
    else if (lon >= 30 && lon <= 36 && lat >= 33 && lat <= 36) timeZone = "Asia/Nicosia";
  } catch {
    /* keep UTC */
  }
  const ctx = buildCycleContext(instant, { lat, lon, timeZone, ayanamsa: "lahiri" });

  const tz = tzolkinPlugin.resolve(ctx);
  const cn = chineseYearPlugin.resolve(ctx);
  const animal = String(cn.meta.animal ?? "Rat");
  const element = String(cn.meta.element ?? "Wood");

  // Local weekday: Luxon-free — use Intl parts (0=Sun … 6=Sat).
  const wdName = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = wdMap[wdName] ?? instant.getUTCDay();

  const wz = WZ[Math.floor(sunTropical / 30) % 12]!;
  const vsz = VSZ[Math.floor(sunSidereal / 30) % 12]!;
  const mp = MP[Math.floor((((moonPhase * 360) + 22.5) % 360) / 45) % 8]!;
  const nk = NK[Math.floor(moonSidereal / (360 / 27)) % 27]!;
  const cz = `cz-${animal.toLowerCase()}`;
  const wx = `wx-${element.toLowerCase()}`;
  const pd = PD[wd]!;
  const tzId = TZ_SIGN[String(tz.meta.sign)] ?? "tz-imix";
  const tn = `tn-${Number(tz.meta.tone)}`;
  const dc = `dc-${String((Math.floor(rising / 10) % 36) + 1).padStart(2, "0")}`;

  const ids = [wz, vsz, mp, nk, cz, wx, pd, tzId, tn, dc];
  const entries: QualiaEntry[] = [];
  for (const id of ids) {
    const e = byId(id);
    if (e && e.nature === "computed") entries.push(e);
  }

  return {
    ids: entries.map(e => e.id),
    entries,
    meta: {
      sunTropicalDeg: sunTropical,
      sunSiderealDeg: sunSidereal,
      moonPhase,
      moonSiderealDeg: moonSidereal,
      risingEclipticDeg: rising,
      tzolkinSign: String(tz.meta.sign),
      tzolkinTone: Number(tz.meta.tone),
      chineseAnimal: animal,
      chineseElement: element,
    },
  };
}
