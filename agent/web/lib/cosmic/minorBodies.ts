/**
 * Keplerian propagation for bright asteroids & periodic comets.
 * Heliocentric ecliptic → geocentric equatorial → topocentric alt/az.
 */
import { Body, HelioVector, MakeTime } from "astronomy-engine";
import { julianDay, normalizeDeg, obliquityDeg } from "./math";
import { raDecToAltAz } from "../skyPositions";

export type MinorBodyKind = "asteroid" | "comet";

export type MinorBody = {
  id: string;
  name: string;
  kind: MinorBodyKind;
  alt: number;
  az: number;
  raHours: number;
  decDeg: number;
  magnitude: number;
  color: string;
};

type OrbitalElements = {
  id: string;
  name: string;
  kind: MinorBodyKind;
  a: number;
  e: number;
  i: number;
  om: number;
  w: number;
  M0: number;
  epoch: number;
  magnitude: number;
  color: string;
};

const RAD = Math.PI / 180;

/** J2000 / recent epoch elements (JPL Small-Body Database). */
const MINOR_CATALOG: OrbitalElements[] = [
  {
    id: "ceres",
    name: "Ceres",
    kind: "asteroid",
    a: 2.7653949,
    e: 0.0791382,
    i: 10.58671,
    om: 80.3016,
    w: 73.5977,
    M0: 113.4109,
    epoch: 2451545.0,
    magnitude: 7.1,
    color: "#b8a898",
  },
  {
    id: "pallas",
    name: "Pallas",
    kind: "asteroid",
    a: 2.7723822,
    e: 0.230562,
    i: 34.8409,
    om: 173.0968,
    w: 310.633,
    M0: 78.4127,
    epoch: 2451545.0,
    magnitude: 7.8,
    color: "#a8a0b0",
  },
  {
    id: "juno",
    name: "Juno",
    kind: "asteroid",
    a: 2.668376,
    e: 0.255842,
    i: 12.9816,
    om: 169.858,
    w: 248.138,
    M0: 36.364,
    epoch: 2451545.0,
    magnitude: 8.5,
    color: "#c0b0a0",
  },
  {
    id: "vesta",
    name: "Vesta",
    kind: "asteroid",
    a: 2.361786,
    e: 0.08874,
    i: 7.1404,
    om: 103.851,
    w: 151.525,
    M0: 205.788,
    epoch: 2451545.0,
    magnitude: 6.5,
    color: "#d8d0c0",
  },
  {
    id: "halley",
    name: "Halley",
    kind: "comet",
    a: 17.834,
    e: 0.96658,
    i: 162.26,
    om: 58.42,
    w: 111.33,
    M0: 0.0,
    epoch: 2451545.0,
    magnitude: 10.0,
    color: "#88c8e8",
  },
];

function solveKepler(Mrad: number, e: number): number {
  let E = Mrad;
  for (let k = 0; k < 30; k++) {
    E = Mrad + e * Math.sin(E);
  }
  return E;
}

function helioEclipticAu(jd: number, el: OrbitalElements): [number, number, number] {
  const n = 360 / (el.a ** 1.5 * 365.25);
  const M = normalizeDeg(el.M0 + n * (jd - el.epoch)) * RAD;
  const E = solveKepler(M, el.e);
  const v = 2 * Math.atan2(
    Math.sqrt(1 + el.e) * Math.sin(E / 2),
    Math.sqrt(1 - el.e) * Math.cos(E / 2),
  );
  const r = el.a * (1 - el.e * Math.cos(E));
  const xp = r * Math.cos(v);
  const yp = r * Math.sin(v);

  const Ω = el.om * RAD;
  const ω = el.w * RAD;
  const inc = el.i * RAD;
  const cosΩ = Math.cos(Ω);
  const sinΩ = Math.sin(Ω);
  const cosω = Math.cos(ω);
  const sinω = Math.sin(ω);
  const cosi = Math.cos(inc);
  const sini = Math.sin(inc);

  const x =
    (cosΩ * cosω - sinΩ * sinω * cosi) * xp +
    (-cosΩ * sinω - sinΩ * cosω * cosi) * yp;
  const y =
    (sinΩ * cosω + cosΩ * sinω * cosi) * xp +
    (-sinΩ * sinω + cosΩ * cosω * cosi) * yp;
  const z = sini * sinω * xp + sini * cosω * yp;
  return [x, y, z];
}

function eclipticToEquatorial(x: number, y: number, z: number, jd: number): [number, number, number] {
  const eps = obliquityDeg(jd) * RAD;
  const cosE = Math.cos(eps);
  const sinE = Math.sin(eps);
  return [x, y * cosE - z * sinE, y * sinE + z * cosE];
}

function equatorialToRaDec(x: number, y: number, z: number): { raHours: number; decDeg: number; distAu: number } {
  const dist = Math.hypot(x, y, z);
  if (dist < 1e-12) return { raHours: 0, decDeg: 0, distAu: 0 };
  const decDeg = Math.asin(clamp(z / dist, -1, 1)) * (180 / Math.PI);
  let raDeg = Math.atan2(y, x) * (180 / Math.PI);
  if (raDeg < 0) raDeg += 360;
  return { raHours: raDeg / 15, decDeg, distAu: dist };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function geoEquatorialAu(date: Date, helio: [number, number, number]): [number, number, number] {
  const time = MakeTime(date);
  const earth = HelioVector(Body.Earth, time);
  return [
    helio[0] - earth.x,
    helio[1] - earth.y,
    helio[2] - earth.z,
  ];
}

/** Topocentric alt/az for catalogued minor bodies at observer. */
export function computeMinorBodies(
  date: Date,
  latDeg: number,
  lonDeg: number,
  altM = 0,
): MinorBody[] {
  const jd = julianDay(date);
  const out: MinorBody[] = [];

  for (const el of MINOR_CATALOG) {
    const helio = helioEclipticAu(jd, el);
    const geo = geoEquatorialAu(date, helio);
    const eq = equatorialToRaDec(...geo);
    const hor = raDecToAltAz(date, latDeg, lonDeg, eq.raHours, eq.decDeg, altM);
    out.push({
      id: el.id,
      name: el.name,
      kind: el.kind,
      alt: hor.alt,
      az: hor.az,
      raHours: eq.raHours,
      decDeg: eq.decDeg,
      magnitude: el.magnitude,
      color: el.color,
    });
  }

  return out;
}
