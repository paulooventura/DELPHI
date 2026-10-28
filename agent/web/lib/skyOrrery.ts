/**
 * Sky orrery math — the same bodies Aether shows, seen from outside.
 *
 * Every position is heliocentric on the J2000 mean ecliptic, in AU:
 *  - planets + Pluto: astronomy-engine HelioVector (EQJ → ECL)
 *  - Moon: GeoMoonState around Earth; Galilean moons: JupiterMoons around Jupiter
 *  - asteroids + Halley: the Keplerian catalog the sky already propagates
 * Orbit paths for Sun-bound bodies are sampled positions over one period;
 * moon paths are the osculating ellipse from the live state vector.
 */
import { Body, GeoMoonState, HelioVector, JupiterMoons, MakeTime, type StateVector } from "astronomy-engine";
import { MINOR_BODY_ORBITS, minorBodyHelioEclipticAu } from "./cosmic/minorBodies";
import { SKY_BODIES } from "./skyPositions";

export type Vec3 = { x: number; y: number; z: number };

export type OrreryBodyKind = "star" | "planet" | "dwarf" | "moon" | "asteroid" | "comet" | "spacecraft";

export type OrreryBody = {
  id: string;
  name: string;
  kind: OrreryBodyKind;
  /** Body it circles ("sun" or a planet id); null for the Sun. */
  parent: string | null;
  color: string;
  /** On-screen radius at the solar-system zoom (sizes are not to scale). */
  sizePx: number;
  /** Sidereal rotation period in days; negative = retrograde. */
  rotationDays: number;
  /** Sidereal orbital period in days (0 for the Sun). */
  periodDays: number;
};

export const AU_KM = 149_597_870.7;
const MS_PER_DAY = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const OBLIQUITY_J2000_RAD = (23.4392911 * Math.PI) / 180;
const COS_E = Math.cos(OBLIQUITY_J2000_RAD);
const SIN_E = Math.sin(OBLIQUITY_J2000_RAD);

/** km³/s² → AU³/day² */
const MU_KM_S_TO_AU_DAY = (86_400 * 86_400) / AU_KM ** 3;
export const MU_EARTH_MOON = 403_503.2355 * MU_KM_S_TO_AU_DAY;
export const MU_JUPITER = 126_712_764.8 * MU_KM_S_TO_AU_DAY;

const skyColor = (id: string, fallback: string) =>
  SKY_BODIES.find(b => b.id === id)?.color ?? fallback;

const PLANET_BODY: Record<string, Body> = {
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

const MINOR_SPIN_DAYS: Record<string, number> = {
  ceres: 0.3781,
  pallas: 0.3305,
  juno: 0.3004,
  vesta: 0.2226,
  halley: 2.2,
};

export const ORRERY_BODIES: OrreryBody[] = [
  { id: "sun", name: "Sun", kind: "star", parent: null, color: skyColor("sun", "#fff8e8"), sizePx: 10, rotationDays: 25.38, periodDays: 0 },
  { id: "mercury", name: "Mercury", kind: "planet", parent: "sun", color: skyColor("mercury", "#c8c4b8"), sizePx: 2.6, rotationDays: 58.646, periodDays: 87.969 },
  { id: "venus", name: "Venus", kind: "planet", parent: "sun", color: skyColor("venus", "#e8d5a0"), sizePx: 3.8, rotationDays: -243.025, periodDays: 224.701 },
  { id: "earth", name: "Earth", kind: "planet", parent: "sun", color: "#6fa8ff", sizePx: 4, rotationDays: 0.99726968, periodDays: 365.256 },
  { id: "moon", name: "Moon", kind: "moon", parent: "earth", color: skyColor("moon", "#e8eef8"), sizePx: 2.2, rotationDays: 27.321661, periodDays: 27.321661 },
  { id: "mars", name: "Mars", kind: "planet", parent: "sun", color: skyColor("mars", "#e07050"), sizePx: 3.2, rotationDays: 1.02595676, periodDays: 686.98 },
  { id: "jupiter", name: "Jupiter", kind: "planet", parent: "sun", color: skyColor("jupiter", "#d4c4a8"), sizePx: 6.5, rotationDays: 0.41354, periodDays: 4332.59 },
  { id: "io", name: "Io", kind: "moon", parent: "jupiter", color: "#e8d27a", sizePx: 1.7, rotationDays: 1.769138, periodDays: 1.769138 },
  { id: "europa", name: "Europa", kind: "moon", parent: "jupiter", color: "#d8cdb8", sizePx: 1.6, rotationDays: 3.551181, periodDays: 3.551181 },
  { id: "ganymede", name: "Ganymede", kind: "moon", parent: "jupiter", color: "#b8aa98", sizePx: 2, rotationDays: 7.154553, periodDays: 7.154553 },
  { id: "callisto", name: "Callisto", kind: "moon", parent: "jupiter", color: "#8f8478", sizePx: 1.9, rotationDays: 16.689017, periodDays: 16.689017 },
  { id: "saturn", name: "Saturn", kind: "planet", parent: "sun", color: skyColor("saturn", "#c9b896"), sizePx: 6, rotationDays: 0.44401, periodDays: 10759.22 },
  { id: "uranus", name: "Uranus", kind: "planet", parent: "sun", color: skyColor("uranus", "#9ec8d8"), sizePx: 4.5, rotationDays: -0.71833, periodDays: 30688.5 },
  { id: "neptune", name: "Neptune", kind: "planet", parent: "sun", color: skyColor("neptune", "#6a9fd8"), sizePx: 4.4, rotationDays: 0.67125, periodDays: 60182 },
  { id: "pluto", name: "Pluto", kind: "dwarf", parent: "sun", color: skyColor("pluto", "#b0a898"), sizePx: 2, rotationDays: -6.38723, periodDays: 90560 },
  ...MINOR_BODY_ORBITS.map(m => ({
    id: m.id,
    name: m.name,
    kind: (m.id === "ceres" ? "dwarf" : m.kind) as OrreryBodyKind,
    parent: "sun",
    color: m.color,
    sizePx: m.kind === "comet" ? 1.7 : 1.4,
    rotationDays: MINOR_SPIN_DAYS[m.id] ?? 0.4,
    periodDays: m.periodDays,
  })),
];

export const ORRERY_BODY_BY_ID: Record<string, OrreryBody> = Object.fromEntries(
  ORRERY_BODIES.map(b => [b.id, b]),
);

/** J2000 equatorial (EQJ) → J2000 mean ecliptic. */
export function eqjToEcliptic(v: Vec3): Vec3 {
  return {
    x: v.x,
    y: v.y * COS_E + v.z * SIN_E,
    z: -v.y * SIN_E + v.z * COS_E,
  };
}

const vecOf = (v: { x: number; y: number; z: number }): Vec3 => ({ x: v.x, y: v.y, z: v.z });
const velOf = (s: StateVector): Vec3 => ({ x: s.vx, y: s.vy, z: s.vz });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vecLength = (v: Vec3) => Math.hypot(v.x, v.y, v.z);

/** Heliocentric ecliptic position (AU) of a Sun-bound body. */
export function helioEcliptic(id: string, date: Date): Vec3 {
  if (id === "sun") return { x: 0, y: 0, z: 0 };
  const planet = PLANET_BODY[id];
  if (planet !== undefined) return eqjToEcliptic(vecOf(HelioVector(planet, MakeTime(date))));
  const minor = minorBodyHelioEclipticAu(id, date);
  if (minor) return { x: minor[0], y: minor[1], z: minor[2] };
  throw new Error(`No heliocentric orbit for ${id}`);
}

export type SatelliteState = { parent: string; pos: Vec3; vel: Vec3; mu: number };

/** Moon + Galilean moons relative to their planet (ecliptic AU, AU/day). */
export function satelliteStates(date: Date): Record<string, SatelliteState> {
  const time = MakeTime(date);
  const moon = GeoMoonState(time);
  const jm = JupiterMoons(time);
  const jup = (s: StateVector): SatelliteState => ({
    parent: "jupiter" as const,
    pos: eqjToEcliptic(vecOf(s)),
    vel: eqjToEcliptic(velOf(s)),
    mu: MU_JUPITER,
  });
  return {
    moon: {
      parent: "earth",
      pos: eqjToEcliptic(vecOf(moon)),
      vel: eqjToEcliptic(velOf(moon)),
      mu: MU_EARTH_MOON,
    },
    io: jup(jm.io),
    europa: jup(jm.europa),
    ganymede: jup(jm.ganymede),
    callisto: jup(jm.callisto),
  };
}

export type OrreryFrame = {
  date: Date;
  /** True heliocentric ecliptic positions (AU) for every body. */
  helio: Record<string, Vec3>;
  satellites: Record<string, SatelliteState>;
};

export function orreryFrame(date: Date): OrreryFrame {
  const helio: Record<string, Vec3> = {};
  for (const b of ORRERY_BODIES) {
    if (b.parent === "sun" || b.parent === null) helio[b.id] = helioEcliptic(b.id, date);
  }
  const satellites = satelliteStates(date);
  for (const [id, s] of Object.entries(satellites)) helio[id] = add(helio[s.parent]!, s.pos);
  return { date, helio, satellites };
}

/** One full orbit of a Sun-bound body, sampled from real positions around `center`. */
export function sampleHelioOrbit(id: string, center: Date, samples = 128): Vec3[] {
  const body = ORRERY_BODY_BY_ID[id];
  if (!body || body.parent !== "sun") return [];
  const span = body.periodDays * MS_PER_DAY;
  const start = center.getTime() - span / 2;
  const out: Vec3[] = [];
  for (let i = 0; i <= samples; i++) {
    out.push(helioEcliptic(id, new Date(start + (span * i) / samples)));
  }
  return out;
}

/** Osculating Kepler ellipse through a state vector (positions relative to the parent). */
export function osculatingOrbit(pos: Vec3, vel: Vec3, mu: number, samples = 96): Vec3[] {
  const r = vecLength(pos);
  const v2 = vel.x ** 2 + vel.y ** 2 + vel.z ** 2;
  const h = {
    x: pos.y * vel.z - pos.z * vel.y,
    y: pos.z * vel.x - pos.x * vel.z,
    z: pos.x * vel.y - pos.y * vel.x,
  };
  const hLen = vecLength(h);
  const rv = pos.x * vel.x + pos.y * vel.y + pos.z * vel.z;
  const ev = {
    x: ((v2 - mu / r) * pos.x - rv * vel.x) / mu,
    y: ((v2 - mu / r) * pos.y - rv * vel.y) / mu,
    z: ((v2 - mu / r) * pos.z - rv * vel.z) / mu,
  };
  let e = vecLength(ev);
  const a = 1 / (2 / r - v2 / mu);
  if (!(a > 0) || e >= 0.99 || hLen === 0) {
    e = 0;
  }
  const P = e > 1e-6 ? { x: ev.x / e, y: ev.y / e, z: ev.z / e } : { x: pos.x / r, y: pos.y / r, z: pos.z / r };
  const hn = { x: h.x / hLen, y: h.y / hLen, z: h.z / hLen };
  const Q = {
    x: hn.y * P.z - hn.z * P.y,
    y: hn.z * P.x - hn.x * P.z,
    z: hn.x * P.y - hn.y * P.x,
  };
  const p = e > 0 ? a * (1 - e * e) : r;
  const out: Vec3[] = [];
  for (let i = 0; i <= samples; i++) {
    const nu = (2 * Math.PI * i) / samples;
    const rr = p / (1 + e * Math.cos(nu));
    const c = Math.cos(nu) * rr;
    const s = Math.sin(nu) * rr;
    out.push({ x: c * P.x + s * Q.x, y: c * P.y + s * Q.y, z: c * P.z + s * Q.z });
  }
  return out;
}

/* ── Log-scale scene ─────────────────────────────────────────────── */

export const LOG_R0_AU = 0.1;

/** Heliocentric distance → log-scene radius (monotonic, 0 at the Sun). */
export function logRadiusAu(rAu: number): number {
  return Math.log10(1 + rAu / LOG_R0_AU);
}

export function logRadiusToAu(L: number): number {
  return (10 ** L - 1) * LOG_R0_AU;
}

/** Keep direction, compress distance from the Sun. */
export function toLogScene(p: Vec3): Vec3 {
  const r = vecLength(p);
  if (r < 1e-12) return { x: 0, y: 0, z: 0 };
  const k = logRadiusAu(r) / r;
  return { x: p.x * k, y: p.y * k, z: p.z * k };
}

/** Moon offsets from their planet, compressed so they clear the planet's dot. */
export function satelliteLogOffset(rel: Vec3): Vec3 {
  const d = vecLength(rel);
  if (d < 1e-12) return { x: 0, y: 0, z: 0 };
  const L = 0.035 + 0.06 * Math.log10(1 + d / 0.0005);
  return { x: (rel.x * L) / d, y: (rel.y * L) / d, z: (rel.z * L) / d };
}

/** Axial spin angle (radians, 0–2π) at a date. */
export function spinAngle(body: OrreryBody, date: Date): number {
  const days = (date.getTime() - J2000_MS) / MS_PER_DAY;
  const turns = days / body.rotationDays;
  const frac = turns - Math.floor(turns);
  return frac * 2 * Math.PI;
}

/* ── Galaxy scale shot ───────────────────────────────────────────── */

export const GALAXY = {
  /** Sun → Sgr A* (ly). */
  sunRadiusLy: 26_000,
  /** One galactic year (years). */
  galacticYearYears: 230e6,
  discRadiusLy: 50_000,
  andromedaLy: 2.537e6,
  andromedaRadiusLy: 110_000,
  andromedaClosingKmS: 110,
  andromedaMergerGyr: 4.5,
  /** Andromeda in galactic coordinates (deg). */
  andromedaL: 121.17,
  andromedaB: -21.57,
} as const;

const C_KM_S = 299_792.458;

/** Sun's angle around the galactic centre after `years` (clockwise seen from the north pole). */
export function sunGalacticAngle(years: number): number {
  return Math.PI - (2 * Math.PI * years) / GALAXY.galacticYearYears;
}

export function sunGalacticPosition(years: number): Vec3 {
  const a = sunGalacticAngle(years);
  return { x: GALAXY.sunRadiusLy * Math.cos(a), y: GALAXY.sunRadiusLy * Math.sin(a), z: 0 };
}

/** Straight-line closing at today's radial speed (ly). */
export function andromedaDistanceLy(years: number): number {
  return Math.max(0, GALAXY.andromedaLy - (years * GALAXY.andromedaClosingKmS) / C_KM_S);
}

/** Unit vector from the Sun toward Andromeda in the galaxy frame (+x = toward Sgr A*). */
export function andromedaDirection(): Vec3 {
  const l = (GALAXY.andromedaL * Math.PI) / 180;
  const b = (GALAXY.andromedaB * Math.PI) / 180;
  return { x: Math.cos(b) * Math.cos(l), y: Math.cos(b) * Math.sin(l), z: Math.sin(b) };
}

export type GalaxyStar = { x: number; y: number; z: number; a: number };

/** Deterministic four-arm spiral of points for the Milky Way backdrop. */
export function galaxyStarField(count = 900, seed = 7): GalaxyStar[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  const pitch = Math.tan((12 * Math.PI) / 180);
  const out: GalaxyStar[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 5 === 0) {
      const r = Math.abs(gauss()) * 7000;
      const t = rand() * Math.PI * 2;
      out.push({ x: r * Math.cos(t), y: r * 0.6 * Math.sin(t), z: gauss() * 1500, a: 0.5 + rand() * 0.4 });
      continue;
    }
    const r = 3000 + Math.pow(rand(), 0.8) * (GALAXY.discRadiusLy - 3000);
    const arm = i % 4;
    const theta = (arm * Math.PI) / 2 - Math.log(r / 3000) / pitch + gauss() * 0.35;
    const spread = 1 + gauss() * 0.08;
    out.push({
      x: r * spread * Math.cos(theta),
      y: r * spread * Math.sin(theta),
      z: gauss() * 400 * (1 - r / GALAXY.discRadiusLy),
      a: 0.25 + rand() * 0.5,
    });
  }
  return out;
}
