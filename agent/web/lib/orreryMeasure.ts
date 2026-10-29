/**
 * Live measurements for anything the orrery shows: one position index over the
 * built-in bodies and the catalogs, plus the numbers on the measurement card.
 */
import { Body, Illumination, MakeTime } from "astronomy-engine";
import {
  GM_SUN_AU3_D2,
  dateToJd,
  jdToDate,
  nextPerihelionJd,
  type CatalogBody,
  type CatalogStar,
} from "./orreryCatalog";
import {
  AU_KM,
  ORRERY_BODIES,
  helioEcliptic,
  satelliteStates,
  vecLength,
  type OrreryBody,
  type Vec3,
} from "./skyOrrery";

const C_KM_S = 299_792.458;
const LY_AU = 63_241.077;
const KM_S_PER_AU_D = AU_KM / 86_400;
const MU_KM_S_TO_AU_DAY = (86_400 * 86_400) / AU_KM ** 3;

/** System GM (planet + its moons), km³/s² — JPL. */
const PARENT_GM_KM3_S2: Record<string, number> = {
  earth: 403_503.2355,
  mars: 42_828.375,
  jupiter: 126_712_764.8,
  saturn: 37_940_585.2,
  uranus: 5_794_556.4,
  neptune: 6_836_527.1,
  pluto: 975.5,
};

/** Mean diameter (km), mass (kg), absolute magnitude H for built-in bodies. */
const BUILTIN_PHYS: Record<string, { d: number; m?: number; H?: number }> = {
  sun: { d: 1_392_700, m: 1.989e30 },
  mercury: { d: 4879.4, m: 3.301e23 },
  venus: { d: 12_103.6, m: 4.867e24 },
  earth: { d: 12_742, m: 5.972e24 },
  moon: { d: 3474.8, m: 7.342e22 },
  mars: { d: 6779, m: 6.417e23 },
  jupiter: { d: 139_820, m: 1.898e27 },
  io: { d: 3643.2, m: 8.932e22, H: -1.68 },
  europa: { d: 3121.6, m: 4.8e22, H: -1.41 },
  ganymede: { d: 5268.2, m: 1.4819e23, H: -2.09 },
  callisto: { d: 4820.6, m: 1.0759e23, H: -1.05 },
  saturn: { d: 116_460, m: 5.683e26 },
  uranus: { d: 50_724, m: 8.681e25 },
  neptune: { d: 49_244, m: 1.024e26 },
  pluto: { d: 2376.6, m: 1.303e22 },
  ceres: { d: 939.4, m: 9.38e20, H: 3.34 },
  pallas: { d: 512, m: 2.04e20, H: 4.13 },
  juno: { d: 254, m: 2.67e19, H: 5.33 },
  vesta: { d: 525.4, m: 2.59e20, H: 3.2 },
  halley: { d: 11 },
};

const ENGINE_BODY: Record<string, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

const BUILTIN_MOONS = new Set(["moon", "io", "europa", "ganymede", "callisto"]);

export type AnyBody = OrreryBody & Partial<Pick<CatalogBody, "meta" | "position" | "orbit" | "craft">>;

export class OrreryIndex {
  readonly bodies: AnyBody[];
  readonly byId: Map<string, AnyBody>;

  constructor(extra: CatalogBody[] = []) {
    const seen = new Set(ORRERY_BODIES.map(b => b.id));
    this.bodies = [...ORRERY_BODIES, ...extra.filter(b => !seen.has(b.id))];
    this.byId = new Map(this.bodies.map(b => [b.id, b]));
  }

  /** Offset from the parent planet (moons only), AU. */
  relAt(id: string, jd: number): Vec3 | null {
    const b = this.byId.get(id);
    if (!b || !b.parent || b.parent === "sun") return null;
    if (BUILTIN_MOONS.has(id)) return satelliteStates(jdToDate(jd))[id]?.pos ?? null;
    return b.position?.(jd) ?? null;
  }

  helioAt(id: string, jd: number): Vec3 | null {
    const b = this.byId.get(id);
    if (!b) return null;
    if (b.parent && b.parent !== "sun") {
      const parent = this.helioAt(b.parent, jd);
      const rel = this.relAt(id, jd);
      return parent && rel ? { x: parent.x + rel.x, y: parent.y + rel.y, z: parent.z + rel.z } : null;
    }
    if (b.position) return b.position(jd);
    return helioEcliptic(id, jdToDate(jd));
  }
}

export type Osculating = { a: number; e: number; iDeg: number; q: number; Q: number | null; periodDays: number | null };

/** Osculating elements from a state vector (AU, AU/day) about a body of GM `mu`. */
export function osculatingElements(r: Vec3, v: Vec3, mu: number): Osculating {
  const rl = vecLength(r);
  const v2 = v.x ** 2 + v.y ** 2 + v.z ** 2;
  const h = { x: r.y * v.z - r.z * v.y, y: r.z * v.x - r.x * v.z, z: r.x * v.y - r.y * v.x };
  const rv = r.x * v.x + r.y * v.y + r.z * v.z;
  const ev = {
    x: ((v2 - mu / rl) * r.x - rv * v.x) / mu,
    y: ((v2 - mu / rl) * r.y - rv * v.y) / mu,
    z: ((v2 - mu / rl) * r.z - rv * v.z) / mu,
  };
  const e = vecLength(ev);
  const a = 1 / (2 / rl - v2 / mu);
  const iDeg = (Math.acos(Math.max(-1, Math.min(1, h.z / vecLength(h)))) * 180) / Math.PI;
  const bound = a > 0 && e < 1;
  return {
    a,
    e,
    iDeg,
    q: bound ? a * (1 - e) : vecLength(h) ** 2 / mu / (1 + e),
    Q: bound ? a * (1 + e) : null,
    periodDays: bound ? 2 * Math.PI * Math.sqrt(a ** 3 / mu) : null,
  };
}

export type Measurement = {
  id: string;
  name: string;
  kind: string;
  parentName: string | null;
  distSunAu: number;
  distEarthAu: number;
  lightTimeSec: number;
  speedKmS: number;
  distParentKm: number | null;
  speedParentKmS: number | null;
  periodDays: number | null;
  e: number | null;
  iDeg: number | null;
  qAu: number | null;
  QAu: number | null;
  diameterKm: number | null;
  massKg: number | null;
  magnitude: number | null;
  nextPerihelion: Date | null;
  perihelionReturns: boolean;
  launch: number | null;
};

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

function hgMagnitude(H: number, G: number, r: number, delta: number, phaseRad: number): number {
  const t = Math.tan(phaseRad / 2);
  const p1 = Math.exp(-3.33 * t ** 0.63);
  const p2 = Math.exp(-1.87 * t ** 1.22);
  return H + 5 * Math.log10(r * delta) - 2.5 * Math.log10((1 - G) * p1 + G * p2);
}

/** Live numbers for one body; null if it has no position now (e.g. a spacecraft before launch). */
export function measureBody(index: OrreryIndex, id: string, date: Date): Measurement | null {
  const b = index.byId.get(id);
  if (!b) return null;
  const jd = dateToJd(date);
  const p = index.helioAt(id, jd);
  const earth = index.helioAt("earth", jd);
  if (!p || !earth) return null;
  const dt = 1 / 144;
  const p0 = index.helioAt(id, jd - dt);
  const p1 = index.helioAt(id, jd + dt);
  const v = p0 && p1 ? { x: (p1.x - p0.x) / (2 * dt), y: (p1.y - p0.y) / (2 * dt), z: (p1.z - p0.z) / (2 * dt) } : null;
  const distSunAu = vecLength(p);
  const toEarth = sub(p, earth);
  const distEarthAu = id === "earth" ? 0 : vecLength(toEarth);

  const isMoon = Boolean(b.parent && b.parent !== "sun");
  let rel: Vec3 | null = null;
  let relV: Vec3 | null = null;
  if (isMoon) {
    rel = index.relAt(id, jd);
    const r0 = index.relAt(id, jd - dt);
    const r1 = index.relAt(id, jd + dt);
    if (r0 && r1) relV = { x: (r1.x - r0.x) / (2 * dt), y: (r1.y - r0.y) / (2 * dt), z: (r1.z - r0.z) / (2 * dt) };
  }

  let orbit: Osculating | null = null;
  if (b.kind !== "star" && b.kind !== "spacecraft") {
    if (isMoon && rel && relV) {
      const gm = PARENT_GM_KM3_S2[b.parent!];
      if (gm) orbit = osculatingElements(rel, relV, gm * MU_KM_S_TO_AU_DAY);
    } else if (v && distSunAu > 0) {
      orbit = osculatingElements(p, v, GM_SUN_AU3_D2);
    }
  }
  const peri = b.meta?.perihelion;
  if (peri && orbit) {
    orbit = {
      ...orbit,
      e: peri.e,
      iDeg: peri.i,
      q: peri.q,
      Q: peri.e < 1 ? (peri.q / (1 - peri.e)) * (1 + peri.e) : null,
    };
  }

  const phys = BUILTIN_PHYS[id];
  let magnitude: number | null = null;
  const engine = ENGINE_BODY[id];
  if (engine !== undefined) {
    try {
      magnitude = Illumination(engine, MakeTime(date)).mag;
    } catch {
      magnitude = null;
    }
  } else if (id !== "earth" && distEarthAu > 0) {
    const H = b.meta?.H ?? phys?.H ?? null;
    if (b.meta?.M1 != null) {
      magnitude = b.meta.M1 + 5 * Math.log10(distEarthAu) + (b.meta.K1 ?? 10) * Math.log10(distSunAu);
    } else if (H != null) {
      const cosPhase = (distSunAu ** 2 + distEarthAu ** 2 - vecLength(earth) ** 2) / (2 * distSunAu * distEarthAu);
      magnitude = hgMagnitude(H, b.meta?.G ?? 0.15, distSunAu, distEarthAu, Math.acos(Math.max(-1, Math.min(1, cosPhase))));
    }
  }

  let nextPeri: Date | null = null;
  let returns = false;
  if (peri && (b.kind === "comet" || b.kind === "asteroid" || b.kind === "centaur" || b.kind === "dwarf")) {
    const n = nextPerihelionJd(peri, jd);
    returns = peri.e < 1;
    nextPeri = n != null ? jdToDate(n) : jdToDate(peri.tp);
  }

  return {
    id,
    name: b.name,
    kind: b.kind,
    parentName: isMoon ? (index.byId.get(b.parent!)?.name ?? b.parent!) : null,
    distSunAu,
    distEarthAu,
    lightTimeSec: (distEarthAu * AU_KM) / C_KM_S,
    speedKmS: v ? vecLength(v) * KM_S_PER_AU_D : 0,
    distParentKm: rel ? vecLength(rel) * AU_KM : null,
    speedParentKmS: relV ? vecLength(relV) * KM_S_PER_AU_D : null,
    periodDays: orbit?.periodDays ?? (b.periodDays > 0 ? b.periodDays : null),
    e: orbit?.e ?? null,
    iDeg: orbit?.iDeg ?? null,
    qAu: orbit?.q ?? null,
    QAu: orbit?.Q ?? null,
    diameterKm: b.meta?.diameterKm ?? phys?.d ?? null,
    massKg: b.meta?.massKg ?? phys?.m ?? null,
    magnitude,
    nextPerihelion: nextPeri,
    perihelionReturns: returns,
    launch: b.meta?.launch ?? null,
  };
}

/** Heliocentric position of a star (AU), J2000 ecliptic. */
export function starHelioAu(star: CatalogStar, dir: Vec3): Vec3 | null {
  if (!(star.distLy > 0)) return null;
  const k = star.distLy * LY_AU;
  return { x: dir.x * k, y: dir.y * k, z: dir.z * k };
}

export function distanceBetween(a: Vec3, b: Vec3): { au: number; km: number; lightTimeSec: number } {
  const au = vecLength(sub(a, b));
  return { au, km: au * AU_KM, lightTimeSec: (au * AU_KM) / C_KM_S };
}

/* ── Formatting ──────────────────────────────────────────────────── */

export function formatKm(km: number): string {
  if (km >= 1e9) return `${(km / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })} billion km`;
  if (km >= 1e6) return `${(km / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} million km`;
  return `${Math.round(km).toLocaleString()} km`;
}

export function formatAu(au: number): string {
  if (au >= LY_AU * 0.1) return `${(au / LY_AU).toLocaleString(undefined, { maximumFractionDigits: 2 })} ly`;
  if (au >= 100) return `${au.toLocaleString(undefined, { maximumFractionDigits: 1 })} AU`;
  return `${au.toLocaleString(undefined, { maximumFractionDigits: au < 0.1 ? 5 : 3 })} AU`;
}

export function formatLightTime(sec: number): string {
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 2 : 1)} s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`;
  if (sec < 86_400 * 2) return `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min`;
  const days = sec / 86_400;
  if (days < 730) return `${days.toFixed(1)} days`;
  return `${(days / 365.25).toLocaleString(undefined, { maximumFractionDigits: 1 })} years`;
}

export function formatPeriod(days: number): string {
  if (days < 2) return `${(days * 24).toFixed(1)} h`;
  if (days < 400) return `${days.toFixed(days < 30 ? 2 : 1)} days`;
  return `${(days / 365.25).toLocaleString(undefined, { maximumFractionDigits: 2 })} years`;
}

export function formatMass(kg: number): string {
  const exp = Math.floor(Math.log10(kg));
  return `${(kg / 10 ** exp).toFixed(2)} × 10^${exp} kg`;
}
