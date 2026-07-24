import { SKY_BODIES, bodyEquatorHorizon, raDecToAltAz } from "../skyPositions";
import { eclipticToEquatorial, julianDay } from "./math";

export type CelestialBodyId =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto";

export type CelestialBody = {
  id: CelestialBodyId;
  name: string;
  alt: number;
  az: number;
  raHours: number;
  decDeg: number;
  magnitude: number;
  color: string;
  major: boolean;
};

/** Major solar-system bodies — astronomy-engine topocentric alt/az. */
export function computeCelestialBodies(
  date: Date,
  latDeg: number,
  lonDeg: number,
  altM = 0,
): CelestialBody[] {
  return SKY_BODIES.map(({ id, body, name, magnitude, color }) => {
    const pos = bodyEquatorHorizon(body, date, latDeg, lonDeg, altM);
    return {
      id,
      name,
      alt: pos.alt,
      az: pos.az,
      raHours: pos.raHours,
      decDeg: pos.decDeg,
      magnitude,
      color,
      major: true,
    };
  });
}

/** Sample the ecliptic great circle (β = 0) for guide-line rendering. */
export function sampleEclipticPath(
  date: Date,
  latDeg: number,
  lonDeg: number,
  stepDeg = 10,
  altM = 0,
): Array<{ alt: number; az: number }> {
  const jd = julianDay(date);
  const pts: Array<{ alt: number; az: number }> = [];
  for (let lon = 0; lon <= 360; lon += stepDeg) {
    const eq = eclipticToEquatorial(lon, 0, jd);
    pts.push(raDecToAltAz(date, latDeg, lonDeg, eq.raHours, eq.decDeg, altM));
  }
  return pts;
}

/** Local meridian arcs (N→zenith and S→zenith). */
export function sampleMeridianArcs(): Array<Array<{ alt: number; az: number }>> {
  const north: Array<{ alt: number; az: number }> = [];
  const south: Array<{ alt: number; az: number }> = [];
  for (let alt = -89; alt <= 89; alt += 4) {
    north.push({ alt, az: 0 });
    south.push({ alt, az: 180 });
  }
  return [north, south];
}

/** Angular separation on the celestial sphere (degrees). */
export function angularSeparationDeg(
  az1: number,
  alt1: number,
  az2: number,
  alt2: number,
): number {
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const a1 = alt1 * RAD;
  const a2 = alt2 * RAD;
  const dAz = (az2 - az1) * RAD;
  const cosD = Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(dAz);
  return Math.acos(Math.max(-1, Math.min(1, cosD))) * DEG;
}
