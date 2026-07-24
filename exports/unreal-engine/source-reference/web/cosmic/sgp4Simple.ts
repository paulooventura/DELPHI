/**
 * Lightweight TLE parser + simplified SGP4-class orbital propagation.
 * Suitable for real-time sky overlays (LEO); not for conjunction analysis.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MU = 398600.4418; // km³/s²
const EARTH_OMEGA = 7.292115e-5; // rad/s
const MINUTES_PER_DAY = 1440;

export type ParsedTLE = {
  name: string;
  noradId: number;
  inclinationDeg: number;
  raanDeg: number;
  eccentricity: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  meanMotionRevPerDay: number;
  epoch: Date;
  bstar: number;
};

export type EciState = {
  xKm: number;
  yKm: number;
  zKm: number;
  vxKmS: number;
  vyKmS: number;
  vzKmS: number;
};

export type GeodeticState = {
  latDeg: number;
  lonDeg: number;
  altKm: number;
};

function parseFloatField(s: string): number {
  return Number.parseFloat(s.trim()) || 0;
}

function parseExpField(s: string): number {
  const t = s.trim().replace(/\s+/g, "");
  if (!t) return 0;
  const m = t.match(/^([+-]?\d+)([+-]\d)$/);
  if (m) return Number.parseFloat(`${m[1]}e${m[2]}`);
  return Number.parseFloat(t) || 0;
}

/** Parse CelesTrak-style TLE pair into orbital elements. */
export function parseTLE(name: string, line1: string, line2: string): ParsedTLE {
  const epochYear = Number.parseInt(line1.slice(18, 20), 10);
  const epochDay = parseFloatField(line1.slice(20, 32));
  const fullYear = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;
  const epochMs = Date.UTC(fullYear, 0, 1) + (epochDay - 1) * 86400000;

  const eccRaw = line2.slice(26, 33).trim();
  const eccentricity = eccRaw.startsWith(".") ? Number.parseFloat(`0${eccRaw}`) : parseFloatField(eccRaw);

  return {
    name: name.trim(),
    noradId: Number.parseInt(line2.slice(2, 7).trim(), 10),
    inclinationDeg: parseFloatField(line2.slice(8, 16)),
    raanDeg: parseFloatField(line2.slice(17, 25)),
    eccentricity,
    argPerigeeDeg: parseFloatField(line2.slice(34, 42)),
    meanAnomalyDeg: parseFloatField(line2.slice(43, 51)),
    meanMotionRevPerDay: parseFloatField(line2.slice(52, 63)),
    epoch: new Date(epochMs),
    bstar: parseExpField(line1.slice(53, 61)),
  };
}

function gmstRad(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const gmst =
    280.46061837
    + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T;
  return ((gmst % 360) + 360) % 360 * RAD;
}

function eciToGeodetic(x: number, y: number, z: number, date: Date): GeodeticState {
  const theta = gmstRad(date);
  const xE = x * Math.cos(theta) + y * Math.sin(theta);
  const yE = -x * Math.sin(theta) + y * Math.cos(theta);
  const zE = z;
  const lonDeg = Math.atan2(yE, xE) * DEG;
  const p = Math.sqrt(xE * xE + yE * yE);
  let latDeg = Math.atan2(zE, p) * DEG;
  let altKm = 0;
  for (let i = 0; i < 4; i++) {
    const lat = latDeg * RAD;
    const sinLat = Math.sin(lat);
    const n = 6378.137 / Math.sqrt(1 - 0.00669438 * sinLat * sinLat);
    altKm = p / Math.cos(lat) - n;
    latDeg = Math.atan2(zE, p * (1 - 0.00669438 * n / (n + altKm))) * DEG;
  }
  return { latDeg, lonDeg: ((lonDeg % 360) + 360) % 360, altKm };
}

/** Simplified SGP4 propagation — Keplerian + secular drag decay. */
export function propagateTLE(tle: ParsedTLE, date: Date): GeodeticState {
  const dtMin = (date.getTime() - tle.epoch.getTime()) / 60000;
  const n0 = (tle.meanMotionRevPerDay * 2 * Math.PI) / MINUTES_PER_DAY; // rad/min
  const a0 = (MU / ((n0 / 60) ** 2)) ** (1 / 3);

  const dragFactor = 1 - tle.bstar * dtMin * 1e-4;
  const a = a0 * Math.max(0.85, dragFactor);
  const n = Math.sqrt(MU / a ** 3) * 60; // rad/min

  const M = (tle.meanAnomalyDeg * RAD + n * dtMin) % (2 * Math.PI);
  const e = Math.min(0.25, tle.eccentricity);
  let E = M;
  for (let i = 0; i < 8; i++) {
    E = M + e * Math.sin(E);
  }
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
  const r = a * (1 - e * Math.cos(E));

  const u = nu + tle.argPerigeeDeg * RAD;
  const i = tle.inclinationDeg * RAD;
  const raan = tle.raanDeg * RAD - EARTH_OMEGA * (dtMin * 60);

  const xOrb = r * (Math.cos(raan) * Math.cos(u) - Math.sin(raan) * Math.sin(u) * Math.cos(i));
  const yOrb = r * (Math.sin(raan) * Math.cos(u) + Math.cos(raan) * Math.sin(u) * Math.cos(i));
  const zOrb = r * Math.sin(u) * Math.sin(i);

  const omega = EARTH_OMEGA;
  const vx = -omega * yOrb;
  const vy = omega * xOrb;
  const vz = 0;

  return eciToGeodetic(xOrb, yOrb, zOrb, date);
}

/** Sample orbital ground track for trail rendering. */
export function sampleOrbitTrail(
  tle: ParsedTLE,
  date: Date,
  steps = 12,
  stepMin = 2,
): GeodeticState[] {
  const pts: GeodeticState[] = [];
  for (let i = steps; i >= 0; i--) {
    const t = new Date(date.getTime() - i * stepMin * 60000);
    pts.push(propagateTLE(tle, t));
  }
  return pts;
}
