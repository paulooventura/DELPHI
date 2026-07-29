/**
 * resolveMoment — what's active *now* (computed entries only).
 *
 * Given (jd, lat, lon), returns the moment-pool qualia ids for the traditions
 * that can be resolved from ephemeris + civil calendars. Never cast, never birth.
 *
 * v5 also resolves sub-day quality rings (planetary hour, chinese shí, muhūrta)
 * plus pawukon / pancawara / manzil / numerology — so consecutive snapshots differ
 * through the day from real cycles, not churn.
 */

import { muhurtaPhase } from "../cosmic/math";
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

/** Chaldean order for planetary hours. */
const CHALDEAN = [
  "saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon",
] as const;

/** Weekday (0=Sun … 6=Sat) → first hour's planet index in CHALDEAN. */
const DAY_RULER_IDX = [3, 6, 2, 5, 1, 4, 0] as const;

const SHI_BRANCH = [
  "zi", "chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai",
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

/**
 * Pawukon day-0 epoch (JD noon scale, floor(jd+0.5)).
 * Convention anchor for a stable 210-day count until a Balinese cultural office verifies.
 */
const PAWUKON_EPOCH_JD = 2451545; // 2000-01-01

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

function reduceDigits(n: number): number {
  let x = Math.abs(Math.floor(n));
  while (x > 9) {
    let s = 0;
    while (x > 0) {
      s += x % 10;
      x = Math.floor(x / 10);
    }
    x = s;
  }
  return x;
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
  const y = Math.cos(θ);
  const x = -(Math.sin(θ) * Math.cos(eps) + Math.tan(φ) * Math.sin(eps));
  return norm360((Math.atan2(y, x) * 180) / Math.PI);
}

function localParts(instant: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(instant);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "0";
  const wdMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    weekday: wdMap[get("weekday")] ?? instant.getUTCDay(),
  };
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
    planetaryHour: string;
    chineseShi: string;
    muhurta: number;
    wuku: number;
    pancawara: number;
    manzil: number;
    numerology: number;
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
  let timeZone = "UTC";
  try {
    if (lon >= -100 && lon <= -70 && lat >= 24 && lat <= 50) timeZone = "America/Chicago";
    else if (lon >= 30 && lon <= 36 && lat >= 33 && lat <= 36) timeZone = "Asia/Nicosia";
  } catch {
    /* keep UTC */
  }
  const ctx = buildCycleContext(instant, { lat, lon, timeZone, ayanamsa: "lahiri" });
  const local = localParts(instant, timeZone);

  const tz = tzolkinPlugin.resolve(ctx);
  const cn = chineseYearPlugin.resolve(ctx);
  const animal = String(cn.meta.animal ?? "Rat");
  const element = String(cn.meta.element ?? "Wood");

  const wz = WZ[Math.floor(sunTropical / 30) % 12]!;
  const vsz = VSZ[Math.floor(sunSidereal / 30) % 12]!;
  const mp = MP[Math.floor((((moonPhase * 360) + 22.5) % 360) / 45) % 8]!;
  const nk = NK[Math.floor(moonSidereal / (360 / 27)) % 27]!;
  const cz = `cz-${animal.toLowerCase()}`;
  const wx = `wx-${element.toLowerCase()}`;
  const pd = PD[local.weekday]!;
  const tzId = TZ_SIGN[String(tz.meta.sign)] ?? "tz-imix";
  const tn = `tn-${Number(tz.meta.tone)}`;
  const dc = `dc-${String((Math.floor(rising / 10) % 36) + 1).padStart(2, "0")}`;

  // Arabic manzil — Moon's sidereal station (28).
  const manzilNum = (Math.floor(moonSidereal / (360 / 28)) % 28) + 1;
  const mz = `mz-${String(manzilNum).padStart(2, "0")}`;

  // Pawukon 210-day cycle → wuku (30×7d) + pancawara (5).
  const civilDay = Math.floor(jd + 0.5);
  const pawukon = ((civilDay - PAWUKON_EPOCH_JD) % 210 + 210) % 210;
  const wukuNum = Math.floor(pawukon / 7) + 1; // 1–30
  const pancaNum = (pawukon % 5) + 1; // 1–5
  const wk = `wk-${String(wukuNum).padStart(2, "0")}`;
  const pc = `pc-${pancaNum}`;

  // Chinese shí — 12 double-hours; Zi straddles 23:00–01:00.
  const shiIndex = Math.floor(((local.hour + 1) % 24) / 2) % 12;
  const shi = `shi-${SHI_BRANCH[shiIndex]!}`;

  // Planetary hour — equal-hour Chaldean cascade (unequal hours when sunrise lands later).
  const planetIdx = (DAY_RULER_IDX[local.weekday]! + local.hour) % 7;
  const ph = `ph-${CHALDEAN[planetIdx]!}`;

  // Vedic muhūrta — 30 × ~48 min from local midnight (sunrise-relative when available upstream).
  const muh = muhurtaPhase(instant);
  const muhId = `muh-${String(muh.index + 1).padStart(2, "0")}`;

  // Numerology — reduced civil date digits (0–9).
  const numDigit = reduceDigits(local.year * 10000 + local.month * 100 + local.day);
  const num = `num-${numDigit}`;

  const ids = [
    wz, vsz, mp, nk, cz, wx, pd, tzId, tn, dc,
    mz, wk, pc, shi, ph, muhId, num,
  ];
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
      planetaryHour: CHALDEAN[planetIdx]!,
      chineseShi: SHI_BRANCH[shiIndex]!,
      muhurta: muh.index + 1,
      wuku: wukuNum,
      pancawara: pancaNum,
      manzil: manzilNum,
      numerology: numDigit,
    },
  };
}
