/**
 * Earth-orbit catalog for the orrery's Earth level: compact CelesTrak GP rows,
 * orbit classes, Earth rotation, frames and the satellite measurement card.
 * SGP4 itself runs in a worker (satellite.js); nothing here imports it.
 */
import { GeoMoon, MakeTime, Rotation_EQD_EQJ, SiderealTime } from "astronomy-engine";
import type { Vec3 } from "./skyOrrery";

export const RE_KM = 6371;
export const MU_EARTH_KM3_S2 = 398_600.4418;
const WGS84_A = 6378.137;
const WGS84_F = 1 / 298.257223563;
const DEG = Math.PI / 180;
const OBLIQUITY = 23.4392911 * DEG;

/** [norad, name, objectId, epoch ISO, meanMotion rev/d, ecc, incDeg, raanDeg, argpDeg, maDeg, bstar, ndot, nddot] */
export type GpRow = [number, string, string, string, number, number, number, number, number, number, number, number, number];
export type OrbitSet = { group: string; source: string; fetchedAt: string; rows: GpRow[] };

export type OrbitLayer = "satellites" | "debris";
export const ORBIT_GROUPS: Record<string, OrbitLayer> = {
  active: "satellites",
  "cosmos-1408-debris": "debris",
  "fengyun-1c-debris": "debris",
  "iridium-33-debris": "debris",
  "cosmos-2251-debris": "debris",
};
export const isOrbitGroup = (g: string): boolean => Object.prototype.hasOwnProperty.call(ORBIT_GROUPS, g);

/** Named, always-labelled objects. */
export const NAMED_SATS: Record<number, string> = {
  25544: "ISS",
  48274: "Tiangong",
  20580: "Hubble",
};

const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));

/** CelesTrak OMM JSON → compact rows (shared by the server route and the snapshot script). */
export function compactOmm(list: Array<Record<string, unknown>>): GpRow[] {
  const out: GpRow[] = [];
  for (const o of list) {
    const id = n(o.NORAD_CAT_ID);
    const mm = n(o.MEAN_MOTION);
    if (!id || !(mm > 0) || typeof o.EPOCH !== "string") continue;
    out.push([
      id,
      String(o.OBJECT_NAME ?? id).trim(),
      String(o.OBJECT_ID ?? ""),
      o.EPOCH,
      Number(mm.toFixed(8)),
      Number(n(o.ECCENTRICITY).toFixed(7)),
      Number(n(o.INCLINATION).toFixed(4)),
      Number(n(o.RA_OF_ASC_NODE).toFixed(4)),
      Number(n(o.ARG_OF_PERICENTER).toFixed(4)),
      Number(n(o.MEAN_ANOMALY).toFixed(4)),
      Number(n(o.BSTAR).toPrecision(5)),
      Number(n(o.MEAN_MOTION_DOT).toPrecision(5)),
      Number(n(o.MEAN_MOTION_DDOT).toPrecision(5)),
    ]);
  }
  return out;
}

/** Compact row → OMM object for satellite.js json2satrec. */
export function rowToOmm(r: GpRow) {
  return {
    OBJECT_NAME: r[1],
    OBJECT_ID: r[2],
    EPOCH: r[3],
    MEAN_MOTION: r[4],
    ECCENTRICITY: r[5],
    INCLINATION: r[6],
    RA_OF_ASC_NODE: r[7],
    ARG_OF_PERICENTER: r[8],
    MEAN_ANOMALY: r[9],
    EPHEMERIS_TYPE: 0,
    CLASSIFICATION_TYPE: "U",
    NORAD_CAT_ID: r[0],
    ELEMENT_SET_NO: 999,
    REV_AT_EPOCH: 0,
    BSTAR: r[10],
    MEAN_MOTION_DOT: r[11],
    MEAN_MOTION_DDOT: r[12],
  };
}

export function launchYear(objectId: string): number | null {
  const y = Number(objectId.slice(0, 4));
  return y > 1956 && y < 2100 ? y : null;
}

export type OrbitClass = "LEO" | "MEO" | "GEO" | "HEO";
export type OrbitShape = { periodMin: number; aKm: number; perigeeKm: number; apogeeKm: number; cls: OrbitClass };

export function orbitShape(meanMotionRevDay: number, ecc: number, incDeg: number): OrbitShape {
  const nRad = (meanMotionRevDay * 2 * Math.PI) / 86_400;
  const aKm = Math.cbrt(MU_EARTH_KM3_S2 / (nRad * nRad));
  const perigeeKm = aKm * (1 - ecc) - RE_KM;
  const apogeeKm = aKm * (1 + ecc) - RE_KM;
  const periodMin = 1440 / meanMotionRevDay;
  let cls: OrbitClass;
  if (ecc > 0.25) cls = "HEO";
  else if (Math.abs(periodMin - 1436) < 30 && ecc < 0.02 && incDeg < 20) cls = "GEO";
  else if (apogeeKm < 2000) cls = "LEO";
  else cls = "MEO";
  return { periodMin, aKm, perigeeKm, apogeeKm, cls };
}

export const ORBIT_CLASS_LABEL: Record<OrbitClass, string> = {
  LEO: "Low Earth orbit",
  MEO: "Medium Earth orbit",
  GEO: "Geostationary",
  HEO: "Highly elliptical",
};

/** Point colour class for the GPU: 0 LEO, 1 Starlink, 2 MEO/GNSS, 3 GEO, 4 HEO, 5 debris, 6 named. */
export function pointClass(r: GpRow, layer: OrbitLayer): number {
  if (NAMED_SATS[r[0]]) return 6;
  if (layer === "debris") return 5;
  if (/^STARLINK/.test(r[1])) return 1;
  const s = orbitShape(r[4], r[5], r[6]);
  return s.cls === "LEO" ? 0 : s.cls === "MEO" ? 2 : s.cls === "GEO" ? 3 : 4;
}

/** Earth-level radius compression (Earth radii): LEO clears the globe, GEO and the Moon still fit. */
export function earthLogRadius(rRe: number): number {
  return rRe <= 1 ? rRe : 1 + 0.85 * Math.log10(1 + (rRe - 1) / 0.06);
}

/** Greenwich apparent sidereal angle, degrees. */
export function earthRotationDeg(date: Date): number {
  return SiderealTime(MakeTime(date)) * 15;
}

/** Row-major 3×3 so that out = M · in. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export function mulMat3(m: Mat3, v: Vec3): Vec3 {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  };
}

/** TEME (≈ true equator of date) → J2000 equatorial. */
export function temeToEqj(date: Date): Mat3 {
  const r = Rotation_EQD_EQJ(MakeTime(date)).rot;
  return [r[0]![0]!, r[1]![0]!, r[2]![0]!, r[0]![1]!, r[1]![1]!, r[2]![1]!, r[0]![2]!, r[1]![2]!, r[2]![2]!];
}

/** TEME → J2000 ecliptic (the orrery's frame). */
export function temeToEcliptic(date: Date): Mat3 {
  const m = temeToEqj(date);
  const c = Math.cos(OBLIQUITY);
  const s = Math.sin(OBLIQUITY);
  return [
    m[0], m[1], m[2],
    c * m[3] + s * m[6], c * m[4] + s * m[7], c * m[5] + s * m[8],
    -s * m[3] + c * m[6], -s * m[4] + c * m[7], -s * m[5] + c * m[8],
  ];
}

/** Earth-fixed unit vector (lon, lat) → TEME, given the sidereal angle. */
export function fixedToTeme(lonDeg: number, latDeg: number, rotDeg: number): Vec3 {
  const l = (lonDeg + rotDeg) * DEG;
  const p = latDeg * DEG;
  return { x: Math.cos(p) * Math.cos(l), y: Math.cos(p) * Math.sin(l), z: Math.sin(p) };
}

/** WGS84 geodetic latitude, longitude (deg) and height (km) of a TEME position. */
export function temeToGeodetic(rKm: Vec3, date: Date): { latDeg: number; lonDeg: number; altKm: number } {
  const th = earthRotationDeg(date) * DEG;
  const x = rKm.x * Math.cos(th) + rKm.y * Math.sin(th);
  const y = -rKm.x * Math.sin(th) + rKm.y * Math.cos(th);
  const z = rKm.z;
  const e2 = WGS84_F * (2 - WGS84_F);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - e2));
  let h = 0;
  for (let k = 0; k < 6; k++) {
    const sl = Math.sin(lat);
    const N = WGS84_A / Math.sqrt(1 - e2 * sl * sl);
    h = p / Math.cos(lat) - N;
    lat = Math.atan2(z, p * (1 - (e2 * N) / (N + h)));
  }
  return { latDeg: lat / DEG, lonDeg: (Math.atan2(y, x) / DEG + 540) % 360 - 180, altKm: h };
}

/** Geocentric Moon, km, J2000 equatorial. */
export function moonEqjKm(date: Date): Vec3 {
  const v = GeoMoon(MakeTime(date));
  const AU = 149_597_870.7;
  return { x: v.x * AU, y: v.y * AU, z: v.z * AU };
}

export type SatMeasure = {
  name: string;
  norad: number;
  objectId: string;
  launch: number | null;
  altKm: number;
  speedKmS: number;
  periodMin: number;
  incDeg: number;
  ecc: number;
  perigeeKm: number;
  apogeeKm: number;
  cls: OrbitClass;
  centreKm: number;
  moonKm: number;
  epoch: Date;
};

export function measureSat(row: GpRow, posKm: Vec3, velKmS: Vec3, date: Date): SatMeasure {
  const shape = orbitShape(row[4], row[5], row[6]);
  const eqj = mulMat3(temeToEqj(date), posKm);
  const moon = moonEqjKm(date);
  return {
    name: row[1],
    norad: row[0],
    objectId: row[2],
    launch: launchYear(row[2]),
    altKm: temeToGeodetic(posKm, date).altKm,
    speedKmS: Math.hypot(velKmS.x, velKmS.y, velKmS.z),
    periodMin: shape.periodMin,
    incDeg: row[6],
    ecc: row[5],
    perigeeKm: shape.perigeeKm,
    apogeeKm: shape.apogeeKm,
    cls: shape.cls,
    centreKm: Math.hypot(posKm.x, posKm.y, posKm.z),
    moonKm: Math.hypot(eqj.x - moon.x, eqj.y - moon.y, eqj.z - moon.z),
    epoch: new Date(row[3].endsWith("Z") ? row[3] : `${row[3]}Z`),
  };
}

/** Second-order extrapolation of a state over dt seconds (matches the GPU shader). */
export function extrapolate(p: Vec3, v: Vec3, dt: number): Vec3 {
  const r = Math.hypot(p.x, p.y, p.z) || 1;
  const k = (-MU_EARTH_KM3_S2 / (r * r * r)) * 0.5 * dt * dt;
  return { x: p.x + v.x * dt + p.x * k, y: p.y + v.y * dt + p.y * k, z: p.z + v.z * dt + p.z * k };
}
