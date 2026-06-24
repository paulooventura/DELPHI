import { celestialToAltAz, moonPosition } from "../starmap";
import { eclipticToEquatorial, julianDay, sunDeclinationDeg, sunRightAscensionHours } from "./math";

export type CelestialBodyId =
  | "sun"
  | "moon"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn";

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

/** Low-precision heliocentric → geocentric ecliptic (Meeus-style mean elements). */
function planetEcliptic(name: CelestialBodyId, jd: number): { lonDeg: number; latDeg: number; rAu: number } {
  const T = (jd - 2451545.0) / 36525;
  const L: Record<CelestialBodyId, number> = {
    sun: 0,
    moon: 0,
    venus: (181.979801 - 0.0000004263 * (jd - 2451545)) % 360,
    mars: (355.433 + 0.524071 * (jd - 2451545)) % 360,
    jupiter: (34.351519 + 0.083099 * (jd - 2451545)) % 360,
    saturn: (50.077444 + 0.033444 * (jd - 2451545)) % 360,
  };
  const lonDeg = ((L[name] ?? 0) + 360) % 360;
  const latDeg = name === "moon" ? 0 : Math.sin((lonDeg * 0.017 + T) * 2) * 1.2;
  const rAu =
    name === "venus" ? 0.72
    : name === "mars" ? 1.52
    : name === "jupiter" ? 5.2
    : name === "saturn" ? 9.5
    : 1;
  return { lonDeg, latDeg, rAu };
}

function sunEquatorial(jd: number): { raHours: number; decDeg: number } {
  return { raHours: sunRightAscensionHours(jd), decDeg: sunDeclinationDeg(jd) };
}

function bodyFromRaDec(
  id: CelestialBodyId,
  name: string,
  raHours: number,
  decDeg: number,
  latDeg: number,
  lonDeg: number,
  date: Date,
  magnitude: number,
  color: string,
): CelestialBody {
  const { alt, az } = celestialToAltAz(raHours, decDeg, latDeg, lonDeg, date);
  return { id, name, alt, az, raHours, decDeg, magnitude, color, major: true };
}

/** Major solar-system bodies for target-lock and sky rendering. */
export function computeCelestialBodies(
  date: Date,
  latDeg: number,
  lonDeg: number,
): CelestialBody[] {
  const jd = julianDay(date);
  const sun = sunEquatorial(jd);
  const bodies: CelestialBody[] = [
    bodyFromRaDec("sun", "Sun", sun.raHours, sun.decDeg, latDeg, lonDeg, date, -26.7, "#fff8e8"),
  ];

  const moon = moonPosition(latDeg, lonDeg, date);
  if (moon) {
    bodies.push({
      id: "moon",
      name: "Moon",
      alt: moon.alt,
      az: moon.az,
      raHours: moon.ra,
      decDeg: moon.dec,
      magnitude: -12.6,
      color: "#e8eef8",
      major: true,
    });
  }

  for (const id of ["venus", "mars", "jupiter", "saturn"] as CelestialBodyId[]) {
    const ecl = planetEcliptic(id, jd);
    const eq = eclipticToEquatorial(ecl.lonDeg, ecl.latDeg, jd);
    const colors: Record<string, string> = {
      venus: "#e8d5a0",
      mars: "#e07050",
      jupiter: "#d4c4a8",
      saturn: "#c9b896",
    };
    const mags: Record<string, number> = {
      venus: -4.2,
      mars: 0.5,
      jupiter: -2.0,
      saturn: 0.8,
    };
    bodies.push(bodyFromRaDec(
      id,
      id.charAt(0).toUpperCase() + id.slice(1),
      eq.raHours,
      eq.decDeg,
      latDeg,
      lonDeg,
      date,
      mags[id] ?? 2,
      colors[id] ?? "#d5e8ff",
    ));
  }

  return bodies;
}

/** Sample the ecliptic great circle (β = 0) for guide-line rendering. */
export function sampleEclipticPath(
  date: Date,
  latDeg: number,
  lonDeg: number,
  stepDeg = 10,
): Array<{ alt: number; az: number }> {
  const jd = julianDay(date);
  const pts: Array<{ alt: number; az: number }> = [];
  for (let lon = 0; lon <= 360; lon += stepDeg) {
    const eq = eclipticToEquatorial(lon, 0, jd);
    pts.push(celestialToAltAz(eq.raHours, eq.decDeg, latDeg, lonDeg, date));
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
