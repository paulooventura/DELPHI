/**
 * Orrery catalogs (public/orrery/*.json, built by scripts/build-orrery-catalog.mjs).
 * Pure propagation: Kepler for small bodies and extra moons, Hermite interpolation
 * of Horizons samples for spacecraft. Everything returns J2000 ecliptic AU.
 */
import type { OrreryBody, OrreryBodyKind, Vec3 } from "./skyOrrery";

export const GM_SUN_AU3_D2 = 2.9591220828559115e-4;
const DEG = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
const JD_UNIX_EPOCH = 2440587.5;

export const dateToJd = (d: Date) => d.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;
export const jdToDate = (jd: number) => new Date((jd - JD_UNIX_EPOCH) * MS_PER_DAY);

/* ── JSON shapes ─────────────────────────────────────────────────── */

export type SbdbElements = { epoch: number; e: number; q: number; i: number; om: number; w: number; tp: number };
export type SbdbBodyJson = {
  id: string;
  name: string;
  kind: "dwarf" | "asteroid" | "comet";
  des: string;
  el: SbdbElements;
  H: number | null;
  G: number | null;
  M1: number | null;
  K1: number | null;
  diameterKm: number | null;
  gm: number | null;
};
export type MoonJson = {
  id: string;
  name: string;
  kind: "moon";
  parent: string;
  el: { epoch: number; e: number; i: number; om: number; w: number; n: number; ma: number; a: number };
  diameterKm: number;
  massKg: number;
};
export type CraftJson = { id: string; name: string; kind: "spacecraft"; launch: number; rows: number[] };
export type CloudJson = { source: string; epochJd: number; stride: number; rows: number[] };
export type StarsJson = { source: string; rows: Array<number | string> };

export const ORRERY_LAYER_FILES = ["bodies", "moons", "spacecraft", "stars", "asteroids", "kuiper"] as const;
export type OrreryLayerFile = (typeof ORRERY_LAYER_FILES)[number];

const cache = new Map<string, Promise<unknown>>();
/** Fetch a catalog once per page; failures are retried on the next call. */
export function loadOrreryLayer<T>(name: OrreryLayerFile): Promise<T> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`/orrery/${name}.json`).then(r => {
      if (!r.ok) throw new Error(`${name}.json ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return p as Promise<T>;
}

/* ── Kepler ──────────────────────────────────────────────────────── */

function orient(xp: number, yp: number, iDeg: number, omDeg: number, wDeg: number): Vec3 {
  const O = omDeg * DEG;
  const w = wDeg * DEG;
  const inc = iDeg * DEG;
  const cO = Math.cos(O);
  const sO = Math.sin(O);
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const ci = Math.cos(inc);
  const si = Math.sin(inc);
  return {
    x: (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp,
    y: (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp,
    z: sw * si * xp + cw * si * yp,
  };
}

export function solveEllipticE(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 40; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

function solveHyperbolicH(M: number, e: number): number {
  let H = Math.asinh(M / e);
  for (let k = 0; k < 60; k++) {
    const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
    H -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return H;
}

/** Heliocentric position from perihelion elements (works for e < 1 and e > 1). */
export function perihelionElementsToPos(el: SbdbElements, jd: number, mu = GM_SUN_AU3_D2): Vec3 {
  const e = Math.abs(el.e - 1) < 1e-6 ? 1 + 1e-6 : el.e;
  const dt = jd - el.tp;
  let xp: number;
  let yp: number;
  if (e < 1) {
    const a = el.q / (1 - e);
    const n = Math.sqrt(mu / a ** 3);
    let M = (n * dt) % (2 * Math.PI);
    if (M > Math.PI) M -= 2 * Math.PI;
    if (M < -Math.PI) M += 2 * Math.PI;
    const E = solveEllipticE(M, e);
    xp = a * (Math.cos(E) - e);
    yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  } else {
    const a = el.q / (e - 1);
    const n = Math.sqrt(mu / a ** 3);
    const H = solveHyperbolicH(n * dt, e);
    xp = a * (e - Math.cosh(H));
    yp = a * Math.sqrt(e * e - 1) * Math.sinh(H);
  }
  return orient(xp, yp, el.i, el.om, el.w);
}

export function periodDaysFromPerihelion(el: SbdbElements, mu = GM_SUN_AU3_D2): number | null {
  if (el.e >= 1) return null;
  const a = el.q / (1 - el.e);
  return (2 * Math.PI) / Math.sqrt(mu / a ** 3);
}

/** Next perihelion at or after `jd` (null for orbits that never return). */
export function nextPerihelionJd(el: SbdbElements, jd: number): number | null {
  const P = periodDaysFromPerihelion(el);
  if (!P) return el.tp >= jd ? el.tp : null;
  return el.tp + Math.ceil((jd - el.tp) / P) * P;
}

/** Path of one orbit (or ±span of a hyperbola) for drawing. */
export function perihelionOrbitPath(el: SbdbElements, samples = 160): Vec3[] {
  const out: Vec3[] = [];
  if (el.e < 1) {
    const a = el.q / (1 - el.e);
    const b = a * Math.sqrt(1 - el.e * el.e);
    for (let k = 0; k <= samples; k++) {
      const E = (2 * Math.PI * k) / samples;
      out.push(orient(a * (Math.cos(E) - el.e), b * Math.sin(E), el.i, el.om, el.w));
    }
    return out;
  }
  const a = el.q / (el.e - 1);
  const b = a * Math.sqrt(el.e * el.e - 1);
  for (let k = 0; k <= samples; k++) {
    const H = -3 + (6 * k) / samples;
    out.push(orient(a * (el.e - Math.cosh(H)), b * Math.sinh(H), el.i, el.om, el.w));
  }
  return out;
}

/** Moon offset from its planet using Horizons osculating elements (n in deg/day). */
export function moonOffset(el: MoonJson["el"], jd: number): Vec3 {
  const M = ((((el.ma + el.n * (jd - el.epoch)) % 360) + 360) % 360) * DEG;
  const E = solveEllipticE(M, el.e);
  return orient(el.a * (Math.cos(E) - el.e), el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E), el.i, el.om, el.w);
}

export function moonOrbitPath(el: MoonJson["el"], samples = 96): Vec3[] {
  const out: Vec3[] = [];
  const b = el.a * Math.sqrt(1 - el.e * el.e);
  for (let k = 0; k <= samples; k++) {
    const E = (2 * Math.PI * k) / samples;
    out.push(orient(el.a * (Math.cos(E) - el.e), b * Math.sin(E), el.i, el.om, el.w));
  }
  return out;
}

/** Same math as the GPU cloud shader, for tests and tap-free checks. */
export function cloudRowPosition(rows: number[], index: number, daysSinceEpoch: number, stride = 7): Vec3 {
  const o = index * stride;
  const a = rows[o]! / 1e4;
  const e = rows[o + 1]! / 1e4;
  const n = Math.sqrt(GM_SUN_AU3_D2 / a ** 3);
  const M = (rows[o + 5]! / 100) * DEG + n * daysSinceEpoch;
  const E = solveEllipticE(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), e);
  return orient(
    a * (Math.cos(E) - e),
    a * Math.sqrt(1 - e * e) * Math.sin(E),
    rows[o + 2]! / 100,
    rows[o + 3]! / 100,
    rows[o + 4]! / 100,
  );
}

/* ── Spacecraft ──────────────────────────────────────────────────── */

export type CraftTrack = { jd: Float64Array; xyz: Float64Array };

export function craftTrack(c: CraftJson): CraftTrack {
  const n = c.rows.length / 4;
  const jd = new Float64Array(n);
  const xyz = new Float64Array(n * 3);
  for (let k = 0; k < n; k++) {
    jd[k] = c.rows[k * 4]!;
    xyz[k * 3] = c.rows[k * 4 + 1]!;
    xyz[k * 3 + 1] = c.rows[k * 4 + 2]!;
    xyz[k * 3 + 2] = c.rows[k * 4 + 3]!;
  }
  return { jd, xyz };
}

/** Hermite-interpolated position; linear coast past the last sample; null before launch. */
export function craftPosition(t: CraftTrack, jd: number): Vec3 | null {
  const n = t.jd.length;
  if (n < 2 || jd < t.jd[0]!) return null;
  const P = (k: number): Vec3 => ({ x: t.xyz[k * 3]!, y: t.xyz[k * 3 + 1]!, z: t.xyz[k * 3 + 2]! });
  const vel = (k: number): Vec3 => {
    const a = Math.max(0, k - 1);
    const b = Math.min(n - 1, k + 1);
    const dt = t.jd[b]! - t.jd[a]!;
    const pa = P(a);
    const pb = P(b);
    return { x: (pb.x - pa.x) / dt, y: (pb.y - pa.y) / dt, z: (pb.z - pa.z) / dt };
  };
  if (jd >= t.jd[n - 1]!) {
    const p = P(n - 1);
    const v = vel(n - 1);
    const dt = jd - t.jd[n - 1]!;
    return { x: p.x + v.x * dt, y: p.y + v.y * dt, z: p.z + v.z * dt };
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t.jd[mid]! <= jd) lo = mid;
    else hi = mid;
  }
  const h = t.jd[hi]! - t.jd[lo]!;
  const s = (jd - t.jd[lo]!) / h;
  const p0 = P(lo);
  const p1 = P(hi);
  const m0 = vel(lo);
  const m1 = vel(hi);
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  const h11 = s ** 3 - s ** 2;
  return {
    x: h00 * p0.x + h10 * h * m0.x + h01 * p1.x + h11 * h * m1.x,
    y: h00 * p0.y + h10 * h * m0.y + h01 * p1.y + h11 * h * m1.y,
    z: h00 * p0.z + h10 * h * m0.z + h01 * p1.z + h11 * h * m1.z,
  };
}

/** Flown path up to `jd` (decimated for drawing). */
export function craftPathUntil(t: CraftTrack, jd: number, every = 3): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k < t.jd.length && t.jd[k]! <= jd; k += every) {
    out.push({ x: t.xyz[k * 3]!, y: t.xyz[k * 3 + 1]!, z: t.xyz[k * 3 + 2]! });
  }
  const now = craftPosition(t, jd);
  if (now) out.push(now);
  return out;
}

/* ── Catalog bodies ──────────────────────────────────────────────── */

export type BodyMeta = {
  diameterKm?: number | null;
  massKg?: number | null;
  H?: number | null;
  G?: number | null;
  M1?: number | null;
  K1?: number | null;
  perihelion?: SbdbElements;
  launch?: number;
  designation?: string;
};

export type CatalogBody = OrreryBody & {
  meta: BodyMeta;
  /** Sun-bound: heliocentric position. Moons: offset from the parent planet. */
  position: (jd: number) => Vec3 | null;
  /** Static orbit in the same frame as `position` (spacecraft use their flown path instead). */
  orbit?: Vec3[];
  craft?: CraftTrack;
};

const KIND_COLOR: Record<string, string> = {
  dwarf: "#c9b8a6",
  asteroid: "#b9ad9c",
  comet: "#9fd4f0",
  moon: "#cfc8bc",
  spacecraft: "#7dffc8",
};

const G_KM3_PER_KG_S2 = 6.6743e-20;

export function buildCatalogBodies(
  bodies: SbdbBodyJson[],
  moons: MoonJson[],
  craft: CraftJson[],
): CatalogBody[] {
  const out: CatalogBody[] = [];
  for (const b of bodies) {
    const period = periodDaysFromPerihelion(b.el) ?? 0;
    const kind: OrreryBodyKind = b.kind;
    out.push({
      id: b.id,
      name: b.name,
      kind,
      parent: "sun",
      color: KIND_COLOR[kind]!,
      sizePx: kind === "dwarf" ? 2 : kind === "comet" ? 1.7 : 1.4,
      rotationDays: 0.4,
      periodDays: period,
      meta: {
        diameterKm: b.diameterKm,
        massKg: b.gm ? b.gm / G_KM3_PER_KG_S2 : null,
        H: b.H,
        G: b.G,
        M1: b.M1,
        K1: b.K1,
        perihelion: b.el,
        designation: b.des,
      },
      position: jd => perihelionElementsToPos(b.el, jd),
      orbit: perihelionOrbitPath(b.el),
    });
  }
  for (const m of moons) {
    out.push({
      id: m.id,
      name: m.name,
      kind: "moon",
      parent: m.parent,
      color: KIND_COLOR.moon!,
      sizePx: m.diameterKm > 1000 ? 1.9 : 1.4,
      rotationDays: 360 / m.el.n,
      periodDays: 360 / m.el.n,
      meta: { diameterKm: m.diameterKm, massKg: m.massKg },
      position: jd => moonOffset(m.el, jd),
      orbit: moonOrbitPath(m.el),
    });
  }
  for (const c of craft) {
    const track = craftTrack(c);
    out.push({
      id: c.id,
      name: c.name,
      kind: "spacecraft",
      parent: "sun",
      color: KIND_COLOR.spacecraft!,
      sizePx: 1.8,
      rotationDays: 0,
      periodDays: 0,
      meta: { launch: c.launch },
      position: jd => craftPosition(track, jd),
      craft: track,
    });
  }
  return out;
}

/* ── Stars ───────────────────────────────────────────────────────── */

export type CatalogStar = { raDeg: number; decDeg: number; vmag: number; distLy: number; con: string; name: string };

export function parseStars(json: StarsJson): CatalogStar[] {
  const r = json.rows;
  const out: CatalogStar[] = [];
  for (let k = 0; k + 5 < r.length; k += 6) {
    out.push({
      raDeg: r[k] as number,
      decDeg: r[k + 1] as number,
      vmag: r[k + 2] as number,
      distLy: r[k + 3] as number,
      con: r[k + 4] as string,
      name: r[k + 5] as string,
    });
  }
  return out;
}
