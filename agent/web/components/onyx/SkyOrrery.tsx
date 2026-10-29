"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BRIGHT_STARS } from "../../lib/brightStars";
import { CONSTELLATION_FIGURES } from "../../lib/constellationLines";
import {
  CONSTELLATION_NAMES,
  buildCatalogBodies,
  craftPathUntil,
  dateToJd,
  loadOrreryLayer,
  parseStars,
  type CatalogStar,
  type CloudJson,
  type CraftJson,
  type MoonJson,
  type SbdbBodyJson,
  type StarsJson,
} from "../../lib/orreryCatalog";
import {
  OrreryIndex,
  distanceBetween,
  formatAu,
  formatKm,
  formatLightTime,
  formatMass,
  formatPeriod,
  measureBody,
  starHelioAu,
  type AnyBody,
} from "../../lib/orreryMeasure";
import {
  AU_KM,
  GALAXY,
  ORRERY_BODIES,
  andromedaDirection,
  andromedaDistanceLy,
  eqjToEcliptic,
  galaxyStarField,
  orreryFrame,
  osculatingOrbit,
  sampleHelioOrbit,
  satelliteLogOffset,
  spinAngle,
  sunGalacticAngle,
  sunGalacticPosition,
  toLogScene,
  vecLength,
  type OrreryBody,
  type OrreryFrame,
  type Vec3,
} from "../../lib/skyOrrery";
import {
  NAMED_SATS,
  ORBIT_CLASS_LABEL,
  ORBIT_GROUPS,
  RE_KM,
  earthLogRadius,
  earthRotationDeg,
  extrapolate,
  measureSat,
  moonEqjKm,
  mulMat3,
  orbitShape,
  pointClass,
  temeToEcliptic,
  temeToGeodetic,
  type GpRow,
  type Mat3,
} from "../../lib/orbits";
import { ORRERY_SPEEDS, advanceCosmicClock, type OrrerySpeedId } from "../../lib/timeEngine";
import { createOrreryGl, type OrreryGl } from "./orreryGl";
import { pulseHaptic } from "../../lib/haptics";
import { OrreryShellTools } from "./OrreryShellTools";
import type { SatWorkerIn, SatWorkerOut } from "./satWorker";
import type { MapSat } from "./EarthMap";

/** MapLibre and the map layers load only when the world map first opens. */
const EarthMap = dynamic(() => import("./EarthMap"), { ssr: false });
/** Closest the globe camera comes (Earth radii); pinching past it opens the world map. */
const EARTH_MIN_DIST = 1.55;

type LevelId = "globe" | "earth" | "inner" | "system" | "galaxy";
type ScaleMode = "log" | "true";
/** "earth" is the close-up globe level, in Earth radii with Earth at the origin. */
type SceneKind = "solar" | "galaxy" | "earth";

const LEVELS: Array<{
  id: LevelId;
  label: string;
  focus: string | null;
  frame: Record<ScaleMode, number>;
  pitchDeg: number;
}> = [
  { id: "globe", label: "Earth", focus: "earth", frame: { log: 3.45, true: 8 }, pitchDeg: 16 },
  { id: "earth", label: "Earth · Moon", focus: "earth", frame: { log: 0.16, true: 0.0034 }, pitchDeg: 34 },
  { id: "inner", label: "Inner planets", focus: "sun", frame: { log: 1.32, true: 1.75 }, pitchDeg: 30 },
  { id: "system", label: "Solar system", focus: "sun", frame: { log: 2.8, true: 42 }, pitchDeg: 26 },
  { id: "galaxy", label: "Galaxy", focus: null, frame: { log: 72_000, true: 1_500_000 }, pitchDeg: 40 },
];
const LEVEL_BY_ID = Object.fromEntries(LEVELS.map(l => [l.id, l])) as Record<LevelId, (typeof LEVELS)[number]>;

const DEEP_SPEEDS = [
  { id: "myr", label: "1 Myr/s", yearsPerSec: 1e6 },
  { id: "tenmyr", label: "10 Myr/s", yearsPerSec: 1e7 },
] as const;
type DeepSpeedId = (typeof DEEP_SPEEDS)[number]["id"];

const EARTH_SPEEDS = [
  { id: "live", label: "Live", secPerSec: 1 },
  { id: "min", label: "1 min/s", secPerSec: 60 },
  { id: "five", label: "5 min/s", secPerSec: 300 },
] as const;
type EarthSpeedId = (typeof EARTH_SPEEDS)[number]["id"];
/** Orbit elements stay meaningful for a few days either side of their epoch. */
const EARTH_SCRUB_H = 72;
const DEBRIS_LABEL: Record<string, string> = {
  "cosmos-1408-debris": "Cosmos 1408 debris · 2021 test",
  "fengyun-1c-debris": "Fengyun-1C debris · 2007 test",
  "iridium-33-debris": "Iridium 33 debris · 2009 collision",
  "cosmos-2251-debris": "Cosmos 2251 debris · 2009 collision",
};
const SAT_LEGEND: Array<[string, string]> = [
  ["LEO", "rgb(199, 222, 255)"],
  ["Starlink", "rgb(153, 178, 255)"],
  ["GPS · MEO", "rgb(140, 255, 194)"],
  ["GEO", "rgb(255, 209, 128)"],
  ["Molniya · HEO", "rgb(255, 143, 199)"],
  ["Debris", "rgb(242, 133, 107)"],
];

type LayerId =
  | "planets"
  | "moons"
  | "dwarfs"
  | "comets"
  | "asteroids"
  | "centaurs"
  | "kuiper"
  | "spacecraft"
  | "satellites"
  | "debris"
  | "stars";
const LAYERS: Array<{ id: LayerId; label: string }> = [
  { id: "planets", label: "Planets" },
  { id: "moons", label: "Moons" },
  { id: "dwarfs", label: "Dwarf planets" },
  { id: "comets", label: "Comets" },
  { id: "asteroids", label: "Asteroids" },
  { id: "centaurs", label: "Centaurs" },
  { id: "kuiper", label: "Kuiper belt" },
  { id: "spacecraft", label: "Spacecraft" },
  { id: "satellites", label: "Satellites" },
  { id: "debris", label: "Debris" },
  { id: "stars", label: "Stars" },
];
const ALL_LAYERS = Object.fromEntries(LAYERS.map(l => [l.id, true])) as Record<LayerId, boolean>;

type Sel = { type: "body"; id: string } | { type: "star"; i: number } | { type: "sat"; i: number };
type SatData = {
  rows: GpRow[];
  /** 1 = debris group. */
  layer: Uint8Array;
  cls: Uint8Array;
  group: string[];
  named: Map<number, number>;
  fetchedAt: string;
  source: string;
};
type SatState = { t: number; pos: Float32Array; vel: Float32Array };
type CardRow = [string, string];
type Card = { key: string; title: string; sub: string; rows: CardRow[] };
type MeasureOut = { a: string; b: string; km: string; au: string; light: string; rawKm: number } | null;
type StarEntry = CatalogStar & { d: Vec3 };

const MAX_LABELS = 25;
const FOV_HALF = (20 * Math.PI) / 180;
/** Camera distance that fits a sphere of radius 1 on the short screen side. */
const DIST_PER_FRAME = 1.08 / Math.tan(FOV_HALF);
const YEAR_MS = 365.2422 * 86_400_000;
const SCRUB_YEARS = 200;
const DEEP_SCRUB_MYR = 1000;
const ORBIT_STALE_MS = 30 * YEAR_MS;
const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
/** True-scale framing around planets that carry moons (AU). */
const MOON_HOSTS: Record<string, number> = {
  jupiter: 0.016,
  saturn: 0.03,
  uranus: 0.006,
  neptune: 0.006,
  mars: 0.0004,
  pluto: 0.0004,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});
const addV = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scaleV = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

type Cam = {
  yaw: number;
  goalYaw: number | null;
  pitch: number;
  goalPitch: number | null;
  dist: number;
  goalDist: number;
  target: Vec3;
  from: Vec3;
  blend: number;
  focus: string | null;
  scene: SceneKind;
  fade: number;
  fadeDir: -1 | 0 | 1;
  nextScene: SceneKind;
};

type Projected = { x: number; y: number; depth: number };

function makeProjector(cam: Cam, w: number, h: number) {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const F = Math.min(w, h) / 2 / Math.tan(FOV_HALF);
  const near = cam.dist * 0.02;
  const rotate = (dx: number, dy: number, dz: number) => {
    const x1 = dx * cy + dy * sy;
    const y1 = -dx * sy + dy * cy;
    return { sx: x1, up: y1 * sp + dz * cp, fwd: y1 * cp - dz * sp };
  };
  const project = (p: Vec3): Projected | null => {
    const r = rotate(p.x - cam.target.x, p.y - cam.target.y, p.z - cam.target.z);
    const depth = r.fwd + cam.dist;
    if (depth < near) return null;
    return { x: w / 2 + (F * r.sx) / depth, y: h / 2 - (F * r.up) / depth, depth };
  };
  /** Direction only (fixed stars at infinity). */
  const projectDir = (d: Vec3): { x: number; y: number } | null => {
    const r = rotate(d.x, d.y, d.z);
    if (r.fwd <= 0.05) return null;
    return { x: w / 2 + (F * r.sx) / r.fwd, y: h / 2 - (F * r.up) / r.fwd };
  };
  /** Screen-space direction of a 3D vector, ignoring perspective. */
  const screenDir = (d: Vec3) => {
    const r = rotate(d.x, d.y, d.z);
    const len = Math.hypot(r.sx, r.up) || 1;
    return { x: r.sx / len, y: -r.up / len };
  };
  return { project, projectDir, screenDir, F };
}

const raDecDir = (raH: number, decDeg: number): Vec3 => {
  const ra = (raH * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return eqjToEcliptic({ x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) });
};
const STAR_DIRS: Array<{ d: Vec3; mag: number }> = BRIGHT_STARS.map(s => ({ d: raDecDir(s.ra, s.dec), mag: s.mag }));
const CONSTELLATION_SEGMENTS: Array<[Vec3, Vec3]> = CONSTELLATION_FIGURES.flatMap(c =>
  c.lines.map(([a, b]) => [raDecDir(a[0], a[1]), raDecDir(b[0], b[1])] as [Vec3, Vec3]),
);

/* ── world: every body's position this frame ── */

type World = { helio: Map<string, Vec3>; rel: Map<string, Vec3>; parent: Map<string, string> };

function buildWorld(f: OrreryFrame, bodies: AnyBody[], jd: number): World {
  const helio = new Map<string, Vec3>();
  const rel = new Map<string, Vec3>();
  const parent = new Map<string, string>();
  for (const b of bodies) {
    if (b.position) {
      const p = b.position(jd);
      if (!p) continue;
      if (b.parent && b.parent !== "sun") {
        const ph = helio.get(b.parent);
        if (!ph) continue;
        rel.set(b.id, p);
        parent.set(b.id, b.parent);
        helio.set(b.id, addV(ph, p));
      } else {
        helio.set(b.id, p);
      }
      continue;
    }
    const h = f.helio[b.id];
    if (!h) continue;
    helio.set(b.id, h);
    const sat = f.satellites[b.id];
    if (sat) {
      rel.set(b.id, sat.pos);
      parent.set(b.id, sat.parent);
    }
  }
  return { helio, rel, parent };
}

function scenePos(W: World, id: string, mode: ScaleMode): Vec3 {
  const helio = W.helio.get(id) ?? ZERO;
  if (mode === "true") return helio;
  const rel = W.rel.get(id);
  if (rel) return addV(toLogScene(W.helio.get(W.parent.get(id) ?? "") ?? ZERO), satelliteLogOffset(rel));
  return toLogScene(helio);
}

function layerOf(b: OrreryBody): LayerId | null {
  switch (b.kind) {
    case "planet":
      return "planets";
    case "moon":
      return "moons";
    case "dwarf":
      return "dwarfs";
    case "comet":
      return "comets";
    case "asteroid":
      return "asteroids";
    case "centaur":
      return "centaurs";
    case "spacecraft":
      return "spacecraft";
    default:
      return null;
  }
}

/** Label priority: planets > dwarfs > big moons > famous comets / asteroids > spacecraft > the rest. */
function importance(b: AnyBody): number {
  switch (b.kind) {
    case "star":
      return 0;
    case "planet":
      return 1;
    case "dwarf":
      return 2;
    case "moon":
      return (b.meta?.diameterKm ?? 3000) >= 1000 ? 3 : 6;
    case "comet":
    case "asteroid":
    case "centaur":
      return 4;
    case "spacecraft":
      return 5;
    default:
      return 7;
  }
}

function presetDist(level: LevelId, focus: string | null, mode: ScaleMode, kind?: string): number {
  const lv = LEVEL_BY_ID[level];
  if (lv.id === "galaxy" || !focus || focus === lv.focus || focus === "sun") {
    return lv.frame[mode] * DIST_PER_FRAME;
  }
  if (focus === "earth") return LEVEL_BY_ID.earth.frame[mode] * DIST_PER_FRAME;
  const host = MOON_HOSTS[focus];
  if (host !== undefined) return (mode === "log" ? 0.17 : host) * DIST_PER_FRAME;
  if (kind === "moon") return (mode === "log" ? 0.07 : 0.004) * DIST_PER_FRAME;
  if (kind === "spacecraft") return (mode === "log" ? 0.3 : 4) * DIST_PER_FRAME;
  return (mode === "log" ? 0.12 : 0.01) * DIST_PER_FRAME;
}

function formatScale(units: number, mode: ScaleMode, scene: SceneKind): string {
  if (scene === "galaxy") {
    if (units >= 1e6) return `${(units / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })} million ly`;
    return `${Math.round(units).toLocaleString()} ly`;
  }
  if (mode === "log") return "";
  if (units < 0.05) return `${Math.round((units * AU_KM) / 1000).toLocaleString()} thousand km`;
  return `${units.toLocaleString(undefined, { maximumFractionDigits: 2 })} AU`;
}

function niceLength(target: number): number {
  const p = 10 ** Math.floor(Math.log10(target));
  for (const m of [1, 2, 5, 10]) if (m * p >= target) return m * p;
  return 10 * p;
}

/* ── measurement card ── */

const KIND_LABEL: Record<string, string> = {
  star: "Our star",
  planet: "Planet",
  dwarf: "Dwarf planet",
  comet: "Comet",
  asteroid: "Asteroid",
  centaur: "Centaur · between Jupiter and Neptune",
  spacecraft: "Spacecraft",
};

const dateLabel = (d: Date) => d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const dateTimeLabel = (d: Date) =>
  d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const minutesLabel = (min: number) => (min < 120 ? `${min.toFixed(1)} min` : `${(min / 60).toFixed(min < 600 ? 1 : 0)} h`);
const kmS = (v: number) => `${v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 2 : 1 })} km/s`;

function bodyCard(index: OrreryIndex, id: string, date: Date): Card | null {
  const b = index.byId.get(id);
  if (!b) return null;
  const m = measureBody(index, id, date);
  if (!m) {
    const launch = b.meta?.launch;
    return { key: id, title: b.name, sub: KIND_LABEL[b.kind] ?? b.kind, rows: [["Launched", launch ? String(launch) : "—"], ["Status", "not launched yet at this date"]] };
  }
  const rows: CardRow[] = [];
  const moonOf = m.parentName;
  if (id !== "sun") rows.push(["From the Sun", `${formatAu(m.distSunAu)} · ${formatKm(m.distSunAu * AU_KM)}`]);
  if (id !== "earth") {
    rows.push(["From Earth", `${formatAu(m.distEarthAu)} · ${formatKm(m.distEarthAu * AU_KM)}`]);
    rows.push(["Light-time", formatLightTime(m.lightTimeSec)]);
  }
  if (moonOf && m.distParentKm != null) {
    if (b.parent !== "earth") rows.push([`From ${moonOf}`, formatKm(m.distParentKm)]);
    if (m.speedParentKmS != null) rows.push([`Speed around ${moonOf}`, kmS(m.speedParentKmS)]);
  }
  if (id !== "sun") rows.push([moonOf ? "Speed around the Sun" : "Speed", kmS(m.speedKmS)]);
  if (m.periodDays) rows.push(["Orbit", formatPeriod(m.periodDays)]);
  if (m.e != null && m.iDeg != null) rows.push(["Eccentricity · tilt", `${m.e.toFixed(3)} · ${m.iDeg.toFixed(1)}°`]);
  if (m.qAu != null) {
    const f = (au: number) => (moonOf ? formatKm(au * AU_KM) : formatAu(au));
    rows.push(["Closest · farthest", m.QAu != null ? `${f(m.qAu)} – ${f(m.QAu)}` : `${f(m.qAu)} · open orbit`]);
  }
  rows.push(["Diameter", m.diameterKm ? `${Math.round(m.diameterKm).toLocaleString()} km` : "—"]);
  rows.push(["Mass", m.massKg ? formatMass(m.massKg) : "—"]);
  rows.push(["Brightness", m.magnitude != null && Number.isFinite(m.magnitude) ? `mag ${m.magnitude.toFixed(1)}` : "—"]);
  if (b.kind === "comet" && m.nextPerihelion) {
    rows.push(
      m.perihelionReturns
        ? ["Next perihelion", dateLabel(m.nextPerihelion)]
        : ["Perihelion", `${dateLabel(m.nextPerihelion)} · not returning`],
    );
  }
  if (m.launch) rows.push(["Launched", String(m.launch)]);
  const sub = moonOf ? `Moon of ${moonOf}` : (KIND_LABEL[b.kind] ?? b.kind);
  return { key: id, title: b.name, sub, rows };
}

function starName(s: CatalogStar): string {
  return s.name || `A star in ${CONSTELLATION_NAMES[s.con] ?? s.con}`;
}

function starCard(s: CatalogStar, i: number): Card {
  const ly = s.distLy > 0 ? s.distLy : 0;
  return {
    key: `star-${i}`,
    title: starName(s),
    sub: "Star",
    rows: [
      ["Distance", ly ? `${ly.toLocaleString(undefined, { maximumFractionDigits: ly < 100 ? 1 : 0 })} light-years` : "—"],
      ["Light left it", ly ? `${Math.round(ly).toLocaleString()} years ago` : "—"],
      ["Brightness", `mag ${s.vmag.toFixed(2)}`],
      ["Constellation", CONSTELLATION_NAMES[s.con] ?? (s.con || "—")],
    ],
  };
}

/* ── drawing helpers ── */

function drawBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  body: OrreryBody,
  light: { x: number; y: number },
  spin: number | null,
  dpr: number,
) {
  if (body.kind === "star") {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
    glow.addColorStop(0, "rgba(255, 244, 214, 0.95)");
    glow.addColorStop(0.22, "rgba(255, 214, 150, 0.45)");
    glow.addColorStop(1, "rgba(255, 190, 120, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff6e2";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (body.kind === "spacecraft") {
    const s = Math.max(2.4 * dpr, r * 1.2);
    ctx.strokeStyle = body.color;
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.stroke();
    return;
  }
  if (body.id === "saturn") {
    ctx.strokeStyle = "rgba(222, 206, 170, 0.55)";
    ctx.lineWidth = Math.max(1, r * 0.35);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 2.2, r * 0.75, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  }
  const lx = x + light.x * r * 0.5;
  const ly = y + light.y * r * 0.5;
  const shade = ctx.createRadialGradient(lx, ly, r * 0.1, x, y, r * 1.05);
  shade.addColorStop(0, body.color);
  shade.addColorStop(0.65, body.color);
  shade.addColorStop(1, "rgba(8, 8, 18, 0.95)");
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (spin !== null && r >= 3 * dpr) {
    const off = Math.sin(spin) * r * 0.86;
    const facing = Math.cos(spin);
    if (facing > 0) {
      const half = Math.sqrt(Math.max(0, r * r - off * off)) * 0.92;
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.42 * facing).toFixed(3)})`;
      ctx.lineWidth = Math.max(0.6, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(x + off, y - half);
      ctx.lineTo(x + off, y + half);
      ctx.stroke();
    }
  }
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  placed: Array<[number, number, number, number]>,
  text: string,
  x: number,
  y: number,
  alpha: number,
  dpr: number,
  color = "236, 232, 255",
): boolean {
  const w = ctx.measureText(text).width;
  const h = 11 * dpr;
  x = clamp(x, w / 2 + 6 * dpr, ctx.canvas.width - w / 2 - 6 * dpr);
  y = clamp(y, h + 2 * dpr, ctx.canvas.height - 4 * dpr);
  const rect: [number, number, number, number] = [x - w / 2 - 2, y - h, x + w / 2 + 2, y + 2];
  for (const p of placed) {
    if (rect[0] < p[2] && rect[2] > p[0] && rect[1] < p[3] && rect[3] > p[1]) return false;
  }
  placed.push(rect);
  ctx.lineJoin = "round";
  ctx.lineWidth = 3 * dpr;
  ctx.strokeStyle = `rgba(3, 3, 8, ${(0.8 * alpha).toFixed(3)})`;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = `rgba(${color}, ${alpha.toFixed(3)})`;
  ctx.fillText(text, x, y);
  return true;
}

export function SkyOrrery({ onClose, rise = false }: { onClose: () => void; rise?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const [reduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const [level, setLevel] = useState<LevelId>("inner");
  const [mode, setMode] = useState<ScaleMode>("log");
  const [speedId, setSpeedId] = useState<OrrerySpeedId>(reduceMotion ? "day" : "month");
  const [deepSpeedId, setDeepSpeedId] = useState<DeepSpeedId>("tenmyr");
  const [earthSpeedId, setEarthSpeedId] = useState<EarthSpeedId>(reduceMotion ? "live" : "min");
  const [orbitInfo, setOrbitInfo] = useState<{ fetchedAt: string; source: string } | null>(null);
  const [satNamed, setSatNamed] = useState<Array<{ name: string; i: number }>>([]);
  const [playing, setPlaying] = useState(true);
  const [following, setFollowing] = useState<string | null>(null);
  const [readout, setReadout] = useState({ date: "", offset: 0, deep: "", deepMyr: 0 });
  const [index, setIndex] = useState(() => new OrreryIndex());
  const [starNames, setStarNames] = useState<Array<{ name: string; i: number }>>([]);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>(ALL_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [selected, setSelected] = useState<Sel | null>(null);
  const [measure, setMeasure] = useState<{ on: boolean; a: Sel | null; b: Sel | null }>({ on: false, a: null, b: null });
  const [card, setCard] = useState<Card | null>(null);
  const [measureOut, setMeasureOut] = useState<MeasureOut>(null);
  const [query, setQuery] = useState("");
  const [mapOpen, setMapOpen] = useState<{ center: [number, number]; sats: MapSat[] } | null>(null);
  const mapOpenRef = useRef(false);
  const openMapRef = useRef<() => void>(() => {});

  const simMsRef = useRef(0);
  const deepYearsRef = useRef(0);
  const levelRef = useRef(level);
  const modeRef = useRef(mode);
  const speedRef = useRef(speedId);
  const deepSpeedRef = useRef(deepSpeedId);
  const earthSpeedRef = useRef(earthSpeedId);
  const satRef = useRef<SatData | null>(null);
  const satStateRef = useRef<SatState | null>(null);
  const playingRef = useRef(playing);
  const indexRef = useRef(index);
  const layersRef = useRef(layers);
  const selectedRef = useRef(selected);
  const measureRef = useRef(measure);
  const starsRef = useRef<StarEntry[]>([]);
  useEffect(() => {
    levelRef.current = level;
    modeRef.current = mode;
    speedRef.current = speedId;
    deepSpeedRef.current = deepSpeedId;
    earthSpeedRef.current = earthSpeedId;
    playingRef.current = playing;
    indexRef.current = index;
    layersRef.current = layers;
    selectedRef.current = selected;
    measureRef.current = measure;
  }, [level, mode, speedId, deepSpeedId, earthSpeedId, playing, index, layers, selected, measure]);

  // A pull-back entry starts edge-on and close, as if rising off the horizon into space.
  const rising = rise && !reduceMotion;
  const camRef = useRef<Cam>({
    yaw: -0.5,
    goalYaw: null,
    pitch: rising ? 0.03 : (LEVEL_BY_ID.inner.pitchDeg * Math.PI) / 180,
    goalPitch: rising ? (LEVEL_BY_ID.inner.pitchDeg * Math.PI) / 180 : null,
    dist: presetDist("inner", "sun", "log") * (rising ? 0.3 : 2.4),
    goalDist: presetDist("inner", "sun", "log"),
    target: ZERO,
    from: ZERO,
    blend: 1,
    focus: "sun",
    scene: "solar",
    fade: reduceMotion ? 1 : 0,
    fadeDir: reduceMotion ? 0 : 1,
    nextScene: "solar",
  });
  const autoLevelRef = useRef<(next: LevelId) => void>(() => {});

  /* ── catalogs: small bodies first, the dense layers after the first frames ── */
  useEffect(() => {
    let alive = true;
    Promise.all([
      loadOrreryLayer<{ bodies: SbdbBodyJson[] }>("bodies"),
      loadOrreryLayer<{ moons: MoonJson[] }>("moons"),
      loadOrreryLayer<{ craft: CraftJson[] }>("spacecraft"),
    ])
      .then(([b, m, c]) => {
        if (!alive) return;
        setIndex(new OrreryIndex(buildCatalogBodies(b.bodies, m.moons, c.craft)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const applyLevel = useCallback(
    (next: LevelId, scaleMode: ScaleMode) => {
      const cam = camRef.current;
      const lv = LEVEL_BY_ID[next];
      const scene: SceneKind = next === "galaxy" ? "galaxy" : next === "globe" ? "earth" : "solar";
      cam.goalPitch = (lv.pitchDeg * Math.PI) / 180;
      cam.focus = lv.focus;
      cam.goalDist = presetDist(next, lv.focus, scaleMode);
      setFollowing(null);
      if (scene !== cam.scene) {
        cam.nextScene = scene;
        if (reduceMotion) {
          cam.scene = scene;
          cam.dist = cam.goalDist;
          cam.blend = 1;
        } else {
          cam.fadeDir = -1;
        }
        return;
      }
      cam.from = cam.target;
      cam.blend = reduceMotion ? 1 : 0;
      if (reduceMotion) cam.dist = cam.goalDist;
    },
    [reduceMotion],
  );

  const chooseLevel = (next: LevelId) => {
    levelRef.current = next;
    setLevel(next);
    applyLevel(next, modeRef.current);
  };

  const chooseMode = (next: ScaleMode) => {
    if (next === modeRef.current) return;
    modeRef.current = next;
    setMode(next);
    const cam = camRef.current;
    cam.goalDist = presetDist(levelRef.current, cam.focus, next, indexRef.current.byId.get(cam.focus ?? "")?.kind);
    cam.dist = cam.goalDist;
    cam.blend = 1;
  };

  const focusBody = (id: string) => {
    const cam = camRef.current;
    if (cam.scene !== "solar" || levelRef.current === "galaxy") {
      levelRef.current = "system";
      setLevel("system");
      applyLevel("system", modeRef.current);
    }
    cam.from = cam.target;
    cam.blend = reduceMotion ? 1 : 0;
    cam.focus = id;
    if (id !== "sun") {
      cam.goalDist = presetDist(levelRef.current, id, modeRef.current, indexRef.current.byId.get(id)?.kind);
    }
    if (reduceMotion) cam.dist = cam.goalDist;
    setFollowing(id === "sun" ? null : id);
  };

  const enableLayerFor = (sel: Sel) => {
    const layer =
      sel.type === "star"
        ? "stars"
        : sel.type === "sat"
          ? satRef.current?.layer[sel.i]
            ? "debris"
            : "satellites"
          : layerOf(indexRef.current.byId.get(sel.id) ?? ORRERY_BODIES[0]!);
    if (layer && !layersRef.current[layer]) {
      const next = { ...layersRef.current, [layer]: true };
      layersRef.current = next;
      setLayers(next);
    }
  };

  /** Tap or search result: in Measure mode fill A then B, otherwise fly there and show the card. */
  const pick = (sel: Sel, fly: boolean) => {
    void pulseHaptic("tick");
    const m = measureRef.current;
    if (m.on) {
      const next = !m.a || m.b ? { on: true, a: sel, b: null } : { ...m, b: sel };
      measureRef.current = next;
      setMeasure(next);
      return;
    }
    selectedRef.current = sel;
    setSelected(sel);
    if (sel.type === "body") {
      if (fly || camRef.current.scene === "solar") focusBody(sel.id);
    } else if (sel.type === "sat") {
      if (camRef.current.scene !== "earth") chooseLevel("globe");
    } else if (fly) {
      const s = starsRef.current[sel.i];
      if (!s) return;
      const cam = camRef.current;
      cam.goalYaw = Math.atan2(-s.d.x, s.d.y);
      cam.goalPitch = clamp(Math.atan2(-s.d.z, Math.hypot(s.d.x, s.d.y)), -1.45, 1.52);
    }
  };
  const pickRef = useRef<(sel: Sel, fly: boolean) => void>(() => {});
  useEffect(() => {
    pickRef.current = pick;
    autoLevelRef.current = next => {
      if (levelRef.current === next) return;
      levelRef.current = next;
      setLevel(next);
      applyLevel(next, modeRef.current);
    };
  });

  const closeMap = () => {
    mapOpenRef.current = false;
    setMapOpen(null);
    if (rootRef.current) delete rootRef.current.dataset.map;
    const cam = camRef.current;
    if (cam.scene === "earth") {
      cam.goalDist = Math.max(cam.goalDist, 2.3);
      if (reduceMotion) cam.dist = cam.goalDist;
    }
  };
  const closeMapRef = useRef(closeMap);
  useEffect(() => {
    closeMapRef.current = closeMap;
  });

  const releaseFocus = () => {
    applyLevel(levelRef.current, modeRef.current);
  };

  const resetNow = () => {
    simMsRef.current = Date.now();
    deepYearsRef.current = 0;
  };

  const toggleLayer = (id: LayerId) => {
    const next = { ...layersRef.current, [id]: !layersRef.current[id] };
    layersRef.current = next;
    setLayers(next);
  };

  const toggleMeasure = () => {
    const next = measureRef.current.on ? { on: false, a: null, b: null } : { on: true, a: null, b: null };
    measureRef.current = next;
    setMeasure(next);
    if (!next.on) setMeasureOut(null);
  };

  const searchNames = useMemo(() => {
    const out = new Map<string, Sel>();
    for (const b of index.bodies) out.set(b.name, { type: "body", id: b.id });
    for (const s of starNames) if (!out.has(s.name)) out.set(s.name, { type: "star", i: s.i });
    for (const s of satNamed) out.set(s.name, { type: "sat", i: s.i });
    return out;
  }, [index, starNames, satNamed]);

  /** Any tracked object by NORAD number or name prefix (too many for the list). */
  const findSat = (q: string): Sel | null => {
    const data = satRef.current;
    if (!data) return null;
    const id = /^\d+$/.test(q) ? Number(q) : 0;
    let prefix = -1;
    for (let i = 0; i < data.rows.length; i++) {
      const r = data.rows[i]!;
      if (id ? r[0] === id : r[1].toLowerCase() === q) return { type: "sat", i };
      if (!id && prefix < 0 && r[1].toLowerCase().startsWith(q)) prefix = i;
    }
    return prefix >= 0 ? { type: "sat", i: prefix } : null;
  };

  const find = (text: string): boolean => {
    const q = text.trim().toLowerCase();
    if (!q) return false;
    let hit: Sel | null = null;
    let exact = false;
    for (const [name, sel] of searchNames) {
      const n = name.toLowerCase();
      if (n === q) {
        hit = sel;
        exact = true;
        break;
      }
      if (!hit && n.startsWith(q)) hit = sel;
    }
    if (!hit || (!exact && hit.type !== "sat" && levelRef.current === "globe")) hit = findSat(q) ?? hit;
    if (!hit) return false;
    enableLayerFor(hit);
    pick(hit, true);
    return true;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      const el = document.activeElement;
      if (el instanceof HTMLInputElement) {
        el.blur();
        return;
      }
      if (mapOpenRef.current) closeMapRef.current();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const glCanvas = glCanvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root || !glCanvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let gl: OrreryGl | null = null;
    try {
      gl = createOrreryGl(glCanvas);
    } catch {
      gl = null;
    }
    root.dataset.gl = gl ? "1" : "0";
    let alive = true;
    let starsOnGpu = false;
    const cloudEpoch: Record<string, number> = {};
    const counts: Record<string, number> = {};
    const writeCounts = () => (root.dataset.counts = JSON.stringify(counts));

    const loadDense = async () => {
      try {
        const starJson = await loadOrreryLayer<StarsJson>("stars");
        if (!alive) return;
        const entries: StarEntry[] = parseStars(starJson).map(s => ({ ...s, d: raDecDir(s.raDeg / 15, s.decDeg) }));
        starsRef.current = entries;
        counts.stars = entries.length;
        if (gl) {
          gl.setStars(
            entries.map(s => s.d),
            entries.map(s => s.vmag),
          );
          starsOnGpu = true;
        }
        setStarNames(entries.flatMap((s, i) => (s.name ? [{ name: s.name, i }] : [])));
        writeCounts();
        if (!gl) return;
        for (const name of ["asteroids", "centaurs", "kuiper"] as const) {
          const cloud = await loadOrreryLayer<CloudJson>(name);
          if (!alive) return;
          counts[name] = gl.setCloud(name, cloud);
          cloudEpoch[name] = cloud.epochJd;
          writeCounts();
        }
      } catch {
        /* layers stay off; the orrery still works with the built-in sky */
      }
    };
    const denseTimer = window.setTimeout(loadDense, 350);

    /* ── Earth level: SGP4 worker + land mask, loaded the first time the globe opens ── */
    let worker: Worker | null = null;
    let tickPending = false;
    let pathPending = false;
    let satPath: { i: number; t: number; pts: Float32Array } | null = null;
    const earthView: { M: Mat3; spin: number; sun: Vec3 } = { M: [1, 0, 0, 0, 1, 0, 0, 0, 1], spin: 0, sun: { x: 1, y: 0, z: 0 } };
    const startEarth = () => {
      if (worker || !alive) return;
      const img = new Image();
      img.onload = () => alive && gl?.setLand(img);
      img.src = "/orrery/earth-land.png";
      try {
        worker = new Worker(new URL("./satWorker.ts", import.meta.url), { type: "module" });
      } catch {
        worker = null;
        return;
      }
      worker.onmessage = (e: MessageEvent<SatWorkerOut>) => {
        const msg = e.data;
        if (msg.type === "meta") {
          const n = msg.rows.length;
          const layer = new Uint8Array(n);
          const cls = new Uint8Array(n);
          const group: string[] = new Array(n);
          const named = new Map<number, number>();
          for (const s of msg.sets) {
            const debris = ORBIT_GROUPS[s.group] === "debris";
            for (let k = s.start; k < s.start + s.count; k++) {
              const r = msg.rows[k]!;
              layer[k] = debris ? 1 : 0;
              cls[k] = pointClass(r, debris ? "debris" : "satellites");
              group[k] = s.group;
              if (NAMED_SATS[r[0]] && !named.has(r[0])) named.set(r[0], k);
            }
          }
          const main = msg.sets.find(s => s.group === "active") ?? msg.sets[0];
          satRef.current = {
            rows: msg.rows,
            layer,
            cls,
            group,
            named,
            fetchedAt: main?.fetchedAt ?? "",
            source: main?.source ?? "",
          };
          gl?.setSatClasses(cls);
          setOrbitInfo(main ? { fetchedAt: main.fetchedAt, source: main.source } : null);
          setSatNamed([...named].map(([id, i]) => ({ name: NAMED_SATS[id]!, i })));
          return;
        }
        if (msg.type === "state") {
          tickPending = false;
          satStateRef.current = { t: msg.t, pos: msg.pos, vel: msg.vel };
          gl?.setSatState(msg.pos, msg.vel);
          const data = satRef.current;
          if (data) {
            const c = { satellites: 0, debris: 0, leo: 0, starlink: 0, meo: 0, geo: 0, heo: 0, named: 0 };
            const keys = ["leo", "starlink", "meo", "geo", "heo", "debris", "named"] as const;
            for (let i = 0; i < data.rows.length; i++) {
              if (!msg.pos[i * 3] && !msg.pos[i * 3 + 1]) continue;
              if (data.layer[i]) c.debris++;
              else c.satellites++;
              const k = keys[data.cls[i]!]!;
              if (k !== "debris") c[k]++;
            }
            root.dataset.sats = JSON.stringify(c);
            root.dataset.sgp4Ms = msg.ms.toFixed(1);
          }
          return;
        }
        pathPending = false;
        satPath = { i: msg.i, t: simMsRef.current, pts: msg.pts };
      };
      const init: SatWorkerIn = { type: "init", groups: Object.keys(ORBIT_GROUPS) };
      worker.postMessage(init);
    };
    const satPosKm = (i: number, ms: number): Vec3 | null => {
      const st = satStateRef.current;
      if (!st || i * 3 + 2 >= st.pos.length) return null;
      const p = { x: st.pos[i * 3]!, y: st.pos[i * 3 + 1]!, z: st.pos[i * 3 + 2]! };
      if (!p.x && !p.y && !p.z) return null;
      const v = { x: st.vel[i * 3]!, y: st.vel[i * 3 + 1]!, z: st.vel[i * 3 + 2]! };
      return extrapolate(p, v, (ms - st.t) / 1000);
    };
    const satVelKm = (i: number): Vec3 => {
      const st = satStateRef.current!;
      return { x: st.vel[i * 3]!, y: st.vel[i * 3 + 1]!, z: st.vel[i * 3 + 2]! };
    };
    /** Geocentric km (TEME) → Earth scene (Earth radii, ecliptic axes, log-compressed). */
    const earthScene = (pKm: Vec3, teme = true): Vec3 => {
      const r = Math.hypot(pKm.x, pKm.y, pKm.z) || 1;
      const u = teme ? mulMat3(earthView.M, pKm) : pKm;
      const s = modeRef.current === "log" ? earthLogRadius(r / RE_KM) : r / RE_KM;
      return scaleV(u, s / r);
    };
    const earthCamera = (cam: Cam): Vec3 => {
      const cp = Math.cos(cam.pitch);
      return { x: cam.dist * Math.sin(cam.yaw) * cp, y: -cam.dist * Math.cos(cam.yaw) * cp, z: cam.dist * Math.sin(cam.pitch) };
    };
    /** True if the globe hides p from the camera. */
    const behindEarth = (C: Vec3, p: Vec3) => {
      const d = { x: p.x - C.x, y: p.y - C.y, z: p.z - C.z };
      const L = Math.hypot(d.x, d.y, d.z) || 1;
      const b = (C.x * d.x + C.y * d.y + C.z * d.z) / L;
      const disc = b * b - (C.x * C.x + C.y * C.y + C.z * C.z - 1);
      if (disc <= 0) return false;
      const t0 = -b - Math.sqrt(disc);
      return t0 > 0 && t0 < L;
    };
    /** Opens the world map over the point of Earth the camera is looking down on. */
    openMapRef.current = () => {
      if (mapOpenRef.current) return;
      const cam = camRef.current;
      let center: [number, number] = [0, 20];
      if (cam.scene === "earth") {
        const c = earthCamera(cam);
        const M = earthView.M;
        // earthView.M is a rotation (TEME → ecliptic); its transpose takes the camera back to TEME.
        const teme = { x: M[0] * c.x + M[3] * c.y + M[6] * c.z, y: M[1] * c.x + M[4] * c.y + M[7] * c.z, z: M[2] * c.x + M[5] * c.y + M[8] * c.z };
        const g = temeToGeodetic(scaleV(teme, RE_KM / (Math.hypot(teme.x, teme.y, teme.z) || 1)), new Date(simMsRef.current));
        center = [g.lonDeg, clamp(g.latDeg, -70, 70)];
      }
      const data = satRef.current;
      const sats: MapSat[] = [];
      if (data) {
        for (const [id, i] of data.named) sats.push({ name: NAMED_SATS[id]!, row: data.rows[i]! });
        const s = selectedRef.current;
        if (s?.type === "sat" && !NAMED_SATS[data.rows[s.i]?.[0] ?? 0] && data.rows[s.i]) sats.push({ name: data.rows[s.i]![1], row: data.rows[s.i]! });
      }
      mapOpenRef.current = true;
      root.dataset.map = "1";
      setMapOpen({ center, sats });
    };
    const satVisible = (i: number) => {
      const data = satRef.current;
      if (!data) return false;
      return data.layer[i] ? layersRef.current.debris : layersRef.current.satellites;
    };

    if (!simMsRef.current) simMsRef.current = Date.now();
    const fontFamily = getComputedStyle(canvas).fontFamily || "system-ui, sans-serif";
    const galaxyStars = galaxyStarField(1400);
    const orbitCache = new Map<string, { center: number; true: Vec3[]; log: Vec3[] }>();
    const catalogOrbitLog = new Map<string, Vec3[]>();
    const helioBodies = ORRERY_BODIES.filter(b => b.parent === "sun");
    let hits: Array<{ id: string; x: number; y: number; r: number }> = [];
    let raf = 0;
    let enteredScene: SceneKind = camRef.current.scene;
    let last = performance.now();
    let lastReadout = 0;

    const clampDist = (cam: Cam, d: number, fromUser: boolean) => {
      const m = modeRef.current;
      // A pinch or wheel still going while scenes cross-fade must not drag the new scene's framing.
      if (fromUser && cam.fadeDir !== 0) return cam.goalDist;
      // After a level switch the new level's framing (set by applyLevel) stands.
      const switchTo = (next: LevelId) => {
        autoLevelRef.current(next);
        return cam.goalDist;
      };
      if (cam.scene === "earth") {
        const max = (m === "log" ? 4.8 : 75) * DIST_PER_FRAME;
        if (fromUser && d > max * 0.9) return switchTo("earth");
        if (fromUser && d < EARTH_MIN_DIST * 0.96) {
          openMapRef.current();
          return EARTH_MIN_DIST;
        }
        return clamp(d, EARTH_MIN_DIST, max);
      }
      if (cam.scene === "solar") {
        const sys = LEVEL_BY_ID.system.frame[m] * DIST_PER_FRAME;
        const min = (m === "log" ? 0.02 : 0.0004) * DIST_PER_FRAME;
        if (fromUser && d > sys * 3.2) return switchTo("galaxy");
        if (fromUser && cam.focus === "earth" && d < (m === "log" ? 0.03 : 0.0006) * DIST_PER_FRAME) return switchTo("globe");
        return clamp(d, min, sys * 5);
      }
      const g = LEVEL_BY_ID.galaxy.frame[m] * DIST_PER_FRAME;
      if (fromUser && d < g * 0.12) return switchTo("system");
      return clamp(d, g * 0.08, g * 4);
    };

    /* ── input: drag to orbit, pinch / wheel to zoom, tap to pick ── */
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; dist: number; scene: SceneKind } | null = null;
    let moved = 0;
    let multi = false;
    const pairDistance = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        moved = 0;
        multi = false;
      }
      if (pointers.size === 2) {
        multi = true;
        pinch = { d: pairDistance(), dist: camRef.current.goalDist, scene: camRef.current.scene };
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const cam = camRef.current;
      if (pointers.size === 1 && !multi) {
        cam.yaw -= dx * 0.006;
        cam.pitch = clamp(cam.pitch + dy * 0.006, -1.45, 1.52);
        cam.goalPitch = null;
        cam.goalYaw = null;
        moved += Math.abs(dx) + Math.abs(dy);
      } else if (pointers.size === 2 && pinch && pinch.d > 0) {
        const d = pairDistance();
        if (d > 0 && pinch.scene !== cam.scene) pinch = { d, dist: cam.goalDist, scene: cam.scene };
        if (d > 0) cam.goalDist = clampDist(cam, (pinch.dist * pinch.d) / d, true);
      }
    };
    const pickStarAt = (px: number, py: number, dpr: number): number | null => {
      const stars = starsRef.current;
      if (!stars.length || !layersRef.current.stars) return null;
      const { projectDir } = makeProjector(camRef.current, canvas.width, canvas.height);
      let best: { i: number; score: number } | null = null;
      const reach = 14 * dpr;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]!;
        const p = projectDir(s.d);
        if (!p) continue;
        const d = Math.hypot(px - p.x, py - p.y);
        if (d > reach) continue;
        const score = d - (6.5 - s.vmag) * 2 * dpr;
        if (!best || score < best.score) best = { i, score };
      }
      return best?.i ?? null;
    };
    const pickSatAt = (px: number, py: number, dpr: number): number | null => {
      const data = satRef.current;
      if (!data || !satStateRef.current) return null;
      const cam = camRef.current;
      const { project } = makeProjector(cam, canvas.width, canvas.height);
      const C = earthCamera(cam);
      const reach = 12 * dpr;
      let best: { i: number; d: number } | null = null;
      for (let i = 0; i < data.rows.length; i++) {
        if (!satVisible(i)) continue;
        const p = satPosKm(i, simMsRef.current);
        if (!p) continue;
        const w = earthScene(p);
        const s = project(w);
        if (!s) continue;
        const d = Math.hypot(px - s.x, py - s.y);
        if (d > reach || (best && d >= best.d) || behindEarth(C, w)) continue;
        best = { i, d };
      }
      return best?.i ?? null;
    };
    const onUp = (e: PointerEvent) => {
      const wasTap = pointers.size === 1 && !multi && moved < 8;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (!wasTap) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, rect.width);
      const px = (e.clientX - rect.left) * dpr;
      const py = (e.clientY - rect.top) * dpr;
      let best: { id: string; d: number } | null = null;
      for (const h of hits) {
        const d = Math.hypot(px - h.x, py - h.y);
        if (d <= Math.max(h.r + 8 * dpr, 16 * dpr) && (!best || d < best.d)) best = { id: h.id, d };
      }
      if (best) {
        const sat = best.id.startsWith("sat:") ? Number(best.id.slice(4)) : -1;
        pickRef.current(sat >= 0 ? { type: "sat", i: sat } : { type: "body", id: best.id }, false);
        return;
      }
      if (camRef.current.scene === "earth") {
        const sat = pickSatAt(px, py, dpr);
        if (sat !== null) {
          pickRef.current({ type: "sat", i: sat }, false);
          return;
        }
        const cam = camRef.current;
        const { project, F } = makeProjector(cam, canvas.width, canvas.height);
        const c = project(ZERO);
        if (c && Math.hypot(px - c.x, py - c.y) < F / Math.sqrt(cam.dist * cam.dist - 1)) {
          pickRef.current({ type: "body", id: "earth" }, false);
          return;
        }
      }
      const star = pickStarAt(px, py, dpr);
      if (star !== null) pickRef.current({ type: "star", i: star }, false);
    };
    const onCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinch = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const cam = camRef.current;
      cam.goalDist = clampDist(cam, cam.goalDist * Math.exp(e.deltaY * unit * 0.0012), true);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const fitCanvas = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return dpr;
    };

    const refreshOneOrbit = (simMs: number) => {
      for (const b of helioBodies) {
        const c = orbitCache.get(b.id);
        if (c && Math.abs(c.center - simMs) < ORBIT_STALE_MS) continue;
        const pts = sampleHelioOrbit(b.id, new Date(simMs), b.periodDays > 2000 ? 160 : 120);
        orbitCache.set(b.id, { center: simMs, true: pts, log: pts.map(toLogScene) });
        return;
      }
    };

    // Fading trails for the built-in bodies: Sun-bound ones store heliocentric
    // points, moons store offsets from their planet so the trail rides along.
    const trails = new Map<string, Array<{ t: number; p: Vec3 }>>();
    const recordTrails = (f: OrreryFrame, simMs: number) => {
      for (const b of ORRERY_BODIES) {
        if (!b.parent) continue;
        const periodMs = b.periodDays * 86_400_000;
        const list = trails.get(b.id) ?? [];
        const lastPt = list[list.length - 1];
        if (lastPt && (simMs < lastPt.t || simMs - lastPt.t > periodMs * 0.3)) list.length = 0;
        const tail = list[list.length - 1];
        if (!tail || simMs - tail.t >= periodMs / 90) {
          const sat = f.satellites[b.id];
          list.push({ t: simMs, p: sat ? sat.pos : (f.helio[b.id] ?? ZERO) });
        }
        while (list.length && simMs - list[0]!.t > periodMs * 0.25) list.shift();
        trails.set(b.id, list);
      }
    };
    const drawTrail = (
      body: OrreryBody,
      W: World,
      f: OrreryFrame,
      m: ScaleMode,
      project: (p: Vec3) => Projected | null,
      dpr: number,
      alpha: number,
    ) => {
      const list = trails.get(body.id);
      if (!list || list.length < 2) return;
      const sat = f.satellites[body.id];
      const parentScene = sat ? scenePos(W, sat.parent, m) : null;
      const toScene = (p: Vec3) =>
        parentScene
          ? addV(parentScene, m === "log" ? satelliteLogOffset(p) : p)
          : m === "log"
            ? toLogScene(p)
            : p;
      const pts = [...list.map(q => project(toScene(q.p))), project(scenePos(W, body.id, m))];
      ctx.strokeStyle = body.color;
      ctx.lineWidth = 1.6 * dpr;
      ctx.lineCap = "round";
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        if (!a || !b) continue;
        ctx.globalAlpha = alpha * (i / pts.length) * 0.75;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
    };

    const strokePath = (
      pts: Vec3[],
      project: (p: Vec3) => Projected | null,
      style: string,
      width: number,
      dash: number[] | null,
    ) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.setLineDash(dash ?? []);
      ctx.beginPath();
      let pen = false;
      for (const p of pts) {
        const s = project(p);
        if (!s) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(s.x, s.y);
        else ctx.moveTo(s.x, s.y);
        pen = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawStars = (projectDir: (d: Vec3) => { x: number; y: number } | null, alpha: number, dpr: number) => {
      if (!layersRef.current.stars) return;
      ctx.strokeStyle = `rgba(200, 190, 255, ${(0.13 * alpha).toFixed(3)})`;
      ctx.lineWidth = 0.7 * dpr;
      ctx.beginPath();
      for (const [a, b] of CONSTELLATION_SEGMENTS) {
        const pa = projectDir(a);
        const pb = projectDir(b);
        if (!pa || !pb) continue;
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
      }
      ctx.stroke();
      if (starsOnGpu) return;
      for (const s of STAR_DIRS) {
        const p = projectDir(s.d);
        if (!p) continue;
        const a = clamp(0.75 - s.mag * 0.18, 0.18, 0.8) * alpha;
        ctx.fillStyle = `rgba(226, 222, 255, ${a.toFixed(3)})`;
        ctx.fillRect(p.x, p.y, 1.2 * dpr, 1.2 * dpr);
      }
    };

    const selId = (s: Sel | null) => (s && s.type === "body" ? s.id : null);

    const drawSolar = (
      f: OrreryFrame,
      W: World,
      bodies: AnyBody[],
      cam: Cam,
      w: number,
      h: number,
      dpr: number,
      alpha: number,
      daysPerSec: number,
    ) => {
      const m = modeRef.current;
      const L = layersRef.current;
      const { project, projectDir, screenDir } = makeProjector(cam, w, h);
      ctx.globalAlpha = alpha;
      drawStars(projectDir, 1, dpr);

      const focusId = cam.focus ?? "sun";
      const meas = measureRef.current;
      const forced = new Set(
        [focusId, selId(selectedRef.current), selId(meas.a), selId(meas.b)].filter((x): x is string => Boolean(x)),
      );
      const shown = (b: AnyBody) => {
        const layer = layerOf(b);
        return W.helio.has(b.id) && (!layer || L[layer]);
      };

      // Bodies well outside the framed region fade so the close views stay readable.
      const frameR = cam.dist / DIST_PER_FRAME;
      const focusParent = indexRef.current.byId.get(focusId)?.parent ?? "sun";
      const keep = new Set([focusId, focusParent, "sun"]);
      const vis = new Map<string, number>();
      for (const b of bodies) {
        if (!shown(b)) continue;
        if (keep.has(b.id) || forced.has(b.id) || (b.parent && b.parent !== "sun" && keep.has(b.parent))) {
          vis.set(b.id, 1);
          continue;
        }
        const p = scenePos(W, b.id, m);
        const d = Math.hypot(p.x - cam.target.x, p.y - cam.target.y, p.z - cam.target.z) / frameR;
        vis.set(b.id, clamp((1.7 - d) / 0.55, 0, 1));
      }

      for (const b of helioBodies) {
        const c = orbitCache.get(b.id);
        const v = vis.get(b.id) ?? 0;
        if (!c || v <= 0.02) continue;
        const minor = b.kind === "asteroid" || b.kind === "comet";
        ctx.globalAlpha = alpha * v * (minor && !forced.has(b.id) ? 0.6 : 1);
        strokePath(
          m === "log" ? c.log : c.true,
          project,
          minor ? "rgba(170, 160, 220, 0.16)" : "rgba(169, 156, 255, 0.28)",
          (minor ? 0.7 : 1) * dpr,
          b.kind === "comet" ? [4 * dpr, 4 * dpr] : null,
        );
      }

      // Catalog orbits: dwarf planets faintly, anything picked brightly.
      for (const b of bodies) {
        if (!b.orbit || b.parent !== "sun") continue;
        const v = vis.get(b.id) ?? 0;
        const picked = forced.has(b.id);
        if (v <= 0.02 || (!picked && b.kind !== "dwarf")) continue;
        let pts = b.orbit;
        if (m === "log") {
          pts = catalogOrbitLog.get(b.id) ?? b.orbit.map(toLogScene);
          catalogOrbitLog.set(b.id, pts);
        }
        ctx.globalAlpha = alpha * v;
        strokePath(
          pts,
          project,
          picked ? "rgba(190, 220, 255, 0.45)" : "rgba(170, 160, 220, 0.14)",
          (picked ? 1 : 0.7) * dpr,
          b.kind === "comet" ? [4 * dpr, 4 * dpr] : null,
        );
      }

      // Spacecraft: the path actually flown, up to the shown date.
      if (L.spacecraft) {
        const jd = dateToJd(f.date);
        for (const b of bodies) {
          if (!b.craft || !W.helio.has(b.id)) continue;
          const v = vis.get(b.id) ?? 0;
          if (v <= 0.02) continue;
          const pts = craftPathUntil(b.craft, jd, 4);
          ctx.globalAlpha = alpha * Math.max(0.35, v);
          strokePath(m === "log" ? pts.map(toLogScene) : pts, project, "rgba(125, 255, 200, 0.32)", 0.9 * dpr, null);
        }
      }
      ctx.globalAlpha = alpha;

      // Moons appear only once they separate from their planet on screen.
      const moonSeparated = new Map<string, boolean>();
      for (const b of bodies) {
        const rel = W.rel.get(b.id);
        if (!rel || !vis.get(b.id)) continue;
        const parentScene = scenePos(W, b.parent!, m);
        const pp = project(parentScene);
        const sp = project(scenePos(W, b.id, m));
        const sep = pp && sp ? Math.hypot(pp.x - sp.x, pp.y - sp.y) : 0;
        const ok = sep >= 5 * dpr || forced.has(b.id);
        moonSeparated.set(b.id, ok);
        if (!ok) continue;
        let relPath: Vec3[];
        const sat = f.satellites[b.id];
        if (sat) relPath = osculatingOrbit(sat.pos, sat.vel, sat.mu, 72);
        else if (b.orbit) relPath = b.orbit;
        else continue;
        const pts = relPath.map(r => addV(parentScene, m === "log" ? satelliteLogOffset(r) : r));
        ctx.globalAlpha = alpha * (vis.get(b.id) ?? 1);
        strokePath(pts, project, "rgba(200, 196, 240, 0.26)", 0.8 * dpr, null);
      }
      ctx.globalAlpha = alpha;

      for (const b of ORRERY_BODIES) {
        const v = vis.get(b.id) ?? 0;
        if (!b.parent || v <= 0.02 || moonSeparated.get(b.id) === false) continue;
        drawTrail(b, W, f, m, project, dpr, alpha * v);
      }

      const sysDist = LEVEL_BY_ID.system.frame[m] * DIST_PER_FRAME;
      const zoomMul = clamp((sysDist / cam.dist) ** 0.3, 1, 3.4);
      const sunScene = scenePos(W, "sun", m);
      const drawn: Array<{ body: AnyBody; s: Projected; r: number; pos: Vec3 }> = [];
      for (const b of bodies) {
        if ((vis.get(b.id) ?? 0) <= 0.02 || moonSeparated.get(b.id) === false) continue;
        const pos = scenePos(W, b.id, m);
        const s = project(pos);
        if (!s) continue;
        const persp = clamp(cam.dist / s.depth, 0.6, 1.8);
        drawn.push({ body: b, s, r: b.sizePx * zoomMul * persp * dpr, pos });
      }
      drawn.sort((a, b) => b.s.depth - a.s.depth);
      hits = [];
      for (const d of drawn) {
        const toSun = { x: sunScene.x - d.pos.x, y: sunScene.y - d.pos.y, z: sunScene.z - d.pos.z };
        const light = d.body.kind === "star" ? { x: 0, y: 0 } : screenDir(toSun);
        const rot = Math.abs(d.body.rotationDays);
        const spin = !rot || (playingRef.current && daysPerSec / rot > 1.2) ? null : spinAngle(d.body, f.date);
        if (d.body.kind === "comet") {
          const rSun = vecLength(W.helio.get(d.body.id) ?? ZERO);
          const len = clamp(36 / Math.max(0.3, rSun), 0, 42) * dpr;
          if (len > 2) {
            ctx.strokeStyle = "rgba(160, 210, 240, 0.45)";
            ctx.lineWidth = 1.2 * dpr;
            ctx.beginPath();
            ctx.moveTo(d.s.x, d.s.y);
            ctx.lineTo(d.s.x - light.x * len, d.s.y - light.y * len);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = alpha * (vis.get(d.body.id) ?? 1);
        drawBody(ctx, d.s.x, d.s.y, d.r, d.body, light, spin, dpr);
        if (forced.has(d.body.id) && d.body.id !== focusId) {
          ctx.strokeStyle = "rgba(125, 255, 200, 0.75)";
          ctx.lineWidth = 1 * dpr;
          ctx.beginPath();
          ctx.arc(d.s.x, d.s.y, d.r + 5 * dpr, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = alpha;
        hits.push({ id: d.body.id, x: d.s.x, y: d.s.y, r: d.r });
      }

      // Measure A–B: a line between two worlds.
      const ma = selId(meas.a);
      const mb = selId(meas.b);
      if (meas.on && ma && mb && W.helio.has(ma) && W.helio.has(mb)) {
        const pa = project(scenePos(W, ma, m));
        const pb = project(scenePos(W, mb, m));
        if (pa && pb) {
          ctx.strokeStyle = "rgba(125, 255, 200, 0.8)";
          ctx.lineWidth = 1.2 * dpr;
          ctx.setLineDash([5 * dpr, 4 * dpr]);
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      ctx.font = `${10 * dpr}px ${fontFamily}`;
      ctx.textAlign = "center";
      const placed: Array<[number, number, number, number]> = [];
      const order = [...drawn].sort(
        (a, b) =>
          Number(forced.has(b.body.id)) - Number(forced.has(a.body.id)) ||
          importance(a.body) - importance(b.body) ||
          a.s.depth - b.s.depth,
      );
      let labels = 0;
      for (const d of order) {
        if (labels >= MAX_LABELS) break;
        const v = vis.get(d.body.id) ?? 1;
        const must = forced.has(d.body.id);
        if ((!must && v < 0.5) || d.s.x < 0 || d.s.x > w || d.s.y < 0 || d.s.y > h) continue;
        const minor = importance(d.body) >= 4;
        const a = (must ? 0.95 : minor ? 0.5 : 0.82) * v;
        const color = d.body.kind === "spacecraft" ? "170, 255, 220" : undefined;
        if (drawLabel(ctx, placed, d.body.name, d.s.x, d.s.y - d.r - 5 * dpr, a, dpr, color)) labels++;
      }

      const byId = new Map(drawn.map(d => [d.body.id, d]));
      const fmt = (p?: { s: Projected }) => (p ? `${(p.s.x / dpr).toFixed(1)},${(p.s.y / dpr).toFixed(1)}` : "");
      root.dataset.earthPx = fmt(byId.get("earth"));
      root.dataset.moonPx = fmt(byId.get("moon"));
      root.dataset.sunPx = fmt(byId.get("sun"));
      root.dataset.labels = String(labels);
      root.dataset.drawn = String(drawn.length);
      ctx.globalAlpha = 1;
    };

    const drawGalaxy = (cam: Cam, w: number, h: number, dpr: number, alpha: number) => {
      const m = modeRef.current;
      const { project, projectDir, F } = makeProjector(cam, w, h);
      ctx.globalAlpha = alpha;
      drawStars(projectDir, 0.6, dpr);
      for (const s of galaxyStars) {
        const p = project(s);
        if (!p) continue;
        ctx.fillStyle = `rgba(214, 206, 255, ${s.a.toFixed(3)})`;
        const size = clamp((F / p.depth) * 320, 0.7, 2.4) * dpr;
        ctx.fillRect(p.x, p.y, size, size);
      }
      const core = project(ZERO);
      if (core) {
        const rr = (F / core.depth) * 9000;
        const g = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, Math.max(2, rr));
        g.addColorStop(0, "rgba(255, 236, 210, 0.55)");
        g.addColorStop(1, "rgba(160, 140, 255, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(core.x, core.y, Math.max(2, rr), 0, Math.PI * 2);
        ctx.fill();
      }
      const ring: Vec3[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        ring.push({ x: GALAXY.sunRadiusLy * Math.cos(a), y: GALAXY.sunRadiusLy * Math.sin(a), z: 0 });
      }
      strokePath(ring, project, "rgba(255, 214, 140, 0.35)", 0.9 * dpr, [3 * dpr, 5 * dpr]);

      const years = deepYearsRef.current;
      const sunAngle = sunGalacticAngle(years);
      const behind: Array<Projected | null> = [];
      for (let i = 24; i >= 0; i--) {
        const a = sunAngle + (i / 24) * (Math.PI / 4);
        behind.push(project({ x: GALAXY.sunRadiusLy * Math.cos(a), y: GALAXY.sunRadiusLy * Math.sin(a), z: 0 }));
      }
      ctx.strokeStyle = "#ffd98a";
      ctx.lineWidth = 2 * dpr;
      ctx.lineCap = "round";
      for (let i = 1; i < behind.length; i++) {
        const p0 = behind[i - 1];
        const p1 = behind[i];
        if (!p0 || !p1) continue;
        ctx.globalAlpha = alpha * (i / behind.length) * 0.8;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
      const sunPos = sunGalacticPosition(years);
      const sun = project(sunPos);
      const dLy = andromedaDistanceLy(years);
      const and = project(andromedaShown(m, years));

      ctx.font = `${10 * dpr}px ${fontFamily}`;
      ctx.textAlign = "center";
      const placed: Array<[number, number, number, number]> = [];
      const line = 13 * dpr;
      if (core) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(core.x, core.y, 2 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Labels sit on the side away from their neighbour so the three groups never stack.
      const sunAboveCore = Boolean(sun && core && sun.y < core.y);
      if (sun) {
        ctx.fillStyle = "#ffd98a";
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, 3.2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        const y0 = sunAboveCore ? sun.y - 9 * dpr - line : sun.y + 16 * dpr;
        if (drawLabel(ctx, placed, "Sun + every planet · 26,000 ly out", sun.x, y0, 0.9, dpr)) {
          drawLabel(ctx, placed, "one lap ≈ 230 million years", sun.x, y0 + line, 0.6, dpr);
        }
      }
      if (core) {
        const y = sunAboveCore ? core.y + 18 * dpr : core.y - 10 * dpr;
        drawLabel(ctx, placed, "Sgr A* · the black hole at the centre", core.x, y, 0.85, dpr);
      }
      if (and) {
        const radiusLy = m === "log" ? 12_000 : GALAXY.andromedaRadiusLy;
        const rx = Math.max(3 * dpr, (F / and.depth) * radiusLy);
        const g = ctx.createRadialGradient(and.x, and.y, 0, and.x, and.y, rx);
        g.addColorStop(0, "rgba(255, 240, 220, 0.75)");
        g.addColorStop(0.3, "rgba(200, 180, 255, 0.3)");
        g.addColorStop(1, "rgba(160, 140, 255, 0)");
        ctx.save();
        ctx.translate(and.x, and.y);
        ctx.scale(1, 0.38);
        ctx.rotate(0.6);
        ctx.translate(-and.x, -and.y);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(and.x, and.y, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const mly = (dLy / 1e6).toFixed(2);
        const below = !sun || and.y >= sun.y;
        const y0 = below ? and.y + 18 * dpr : and.y - 12 * dpr - 2 * line;
        if (drawLabel(ctx, placed, `Andromeda · ${mly} million ly`, and.x, y0, 0.9, dpr)) {
          drawLabel(
            ctx,
            placed,
            m === "log" ? "closing at 110 km/s · pulled in to fit" : "closing at 110 km/s · true distance",
            and.x,
            y0 + line,
            0.6,
            dpr,
          );
          drawLabel(ctx, placed, "merger in ~4.5 billion years", and.x, y0 + 2 * line, 0.5, dpr);
        }
        root.dataset.andromedaPx = `${(and.x / dpr).toFixed(1)},${(and.y / dpr).toFixed(1)}`;
      }
      hits = [];
      ctx.globalAlpha = 1;
    };

    const moonBody = ORRERY_BODIES.find(b => b.id === "moon");
    let moonRing: { center: number; pts: Vec3[] } | null = null;
    const moonEclKm = (date: Date) => eqjToEcliptic(moonEqjKm(date));

    const drawEarthScene = (cam: Cam, w: number, h: number, dpr: number, alpha: number, date: Date) => {
      const L = layersRef.current;
      const simMs = date.getTime();
      const { project, projectDir, screenDir } = makeProjector(cam, w, h);
      const C = earthCamera(cam);
      const shown = (p: Vec3) => (behindEarth(C, p) ? null : project(p));
      ctx.globalAlpha = alpha;
      drawStars(projectDir, 0.8, dpr);
      ctx.font = `${10 * dpr}px ${fontFamily}`;
      ctx.textAlign = "center";
      const placed: Array<[number, number, number, number]> = [];
      let labels = 0;
      const label = (text: string, x: number, y: number, a: number, color?: string) => {
        if (labels < MAX_LABELS && drawLabel(ctx, placed, text, x, y, a, dpr, color)) labels++;
      };
      hits = [];

      // Reference shells in the equatorial plane: the GEO ring and the GPS orbit height.
      if (L.satellites) {
        for (const ring of [
          { km: RE_KM + 35_786, text: "GEO ring · 35,786 km", style: "rgba(255, 214, 140, 0.3)", dash: null as number[] | null },
          { km: RE_KM + 20_200, text: "GPS · 20,200 km", style: "rgba(140, 255, 200, 0.2)", dash: [3 * dpr, 5 * dpr] },
        ]) {
          const pts: Vec3[] = [];
          for (let k = 0; k <= 128; k++) {
            const a = (k / 128) * Math.PI * 2;
            pts.push(earthScene({ x: ring.km * Math.cos(a), y: ring.km * Math.sin(a), z: 0 }));
          }
          strokePath(pts, shown, ring.style, 0.9 * dpr, ring.dash);
          let low: Projected | null = null;
          for (const p of pts) {
            const s = shown(p);
            if (s && (!low || s.y > low.y)) low = s;
          }
          if (low) label(ring.text, low.x, low.y + 13 * dpr, 0.55, ring.dash ? "160, 255, 210" : "255, 220, 160");
        }
      }

      // The Moon at the outer edge, with a faint month of its path.
      if (!moonRing || Math.abs(moonRing.center - simMs) > 2 * 86_400_000) {
        const pts: Vec3[] = [];
        for (let k = 0; k <= 56; k++) pts.push(moonEclKm(new Date(simMs + ((k - 28) / 56) * 27.32 * 86_400_000)));
        moonRing = { center: simMs, pts };
      }
      strokePath(moonRing.pts.map(p => earthScene(p, false)), shown, "rgba(200, 196, 240, 0.18)", 0.8 * dpr, [2 * dpr, 6 * dpr]);
      const moonKm = moonEclKm(date);
      const moonPos = earthScene(moonKm, false);
      const moonS = shown(moonPos);
      if (moonS && moonBody) {
        const r = clamp((cam.dist / moonS.depth) * 5.5, 3.5, 9) * dpr;
        drawBody(ctx, moonS.x, moonS.y, r, moonBody, screenDir(earthView.sun), null, dpr);
        hits.push({ id: "moon", x: moonS.x, y: moonS.y, r });
        const km = Math.round(Math.hypot(moonKm.x, moonKm.y, moonKm.z) / 100) * 100;
        label(`Moon · ${km.toLocaleString()} km`, moonS.x, moonS.y - r - 5 * dpr, 0.85);
      }
      const earthS = project(ZERO);

      // Named stations and telescopes, the selected object, Measure A and B.
      const data = satRef.current;
      const sel = selectedRef.current;
      const meas = measureRef.current;
      const picked = new Set<number>();
      for (const s of [sel, meas.a, meas.b]) if (s?.type === "sat") picked.add(s.i);
      if (data && sel?.type === "sat" && satPath?.i === sel.i) {
        const pts: Vec3[] = [];
        for (let k = 0; k + 2 < satPath.pts.length; k += 3) {
          const p = { x: satPath.pts[k]!, y: satPath.pts[k + 1]!, z: satPath.pts[k + 2]! };
          if (p.x || p.y || p.z) pts.push(earthScene(p));
        }
        strokePath(pts, shown, "rgba(190, 220, 255, 0.5)", 1 * dpr, null);
      }
      let issPx = "";
      if (data) {
        const marks: Array<{ i: number; name: string; must: boolean }> = [];
        for (const i of picked) marks.push({ i, name: data.rows[i]![1], must: true });
        if (L.satellites) {
          for (const [id, i] of data.named) if (!picked.has(i)) marks.push({ i, name: NAMED_SATS[id]!, must: false });
        }
        for (const m of marks) {
          const p = satPosKm(m.i, simMs);
          if (!p) continue;
          const s = shown(earthScene(p));
          if (!s) continue;
          if (data.rows[m.i]![0] === 25544) issPx = `${(s.x / dpr).toFixed(1)},${(s.y / dpr).toFixed(1)}`;
          ctx.strokeStyle = m.must ? "rgba(125, 255, 200, 0.85)" : "rgba(255, 255, 255, 0.55)";
          ctx.lineWidth = 1 * dpr;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 5 * dpr, 0, Math.PI * 2);
          ctx.stroke();
          hits.push({ id: `sat:${m.i}`, x: s.x, y: s.y, r: 5 * dpr });
          label(m.name, s.x, s.y - 9 * dpr, m.must ? 0.95 : 0.8, m.must ? "170, 255, 220" : undefined);
        }
      }
      root.dataset.issPx = issPx;

      // Measure A–B inside the Earth level.
      const posOf = (s: Sel | null): Vec3 | null => {
        if (!s) return null;
        if (s.type === "sat") {
          const p = satPosKm(s.i, simMs);
          return p ? earthScene(p) : null;
        }
        if (s.type === "body" && s.id === "moon") return moonPos;
        if (s.type === "body" && s.id === "earth") return ZERO;
        return null;
      };
      const pa = meas.on ? posOf(meas.a) : null;
      const pb = meas.on ? posOf(meas.b) : null;
      if (pa && pb) {
        const a = project(pa);
        const b = project(pb);
        if (a && b) {
          ctx.strokeStyle = "rgba(125, 255, 200, 0.8)";
          ctx.lineWidth = 1.2 * dpr;
          ctx.setLineDash([5 * dpr, 4 * dpr]);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // A small key for the point colours.
      if (data && (L.satellites || L.debris)) {
        ctx.font = `${9 * dpr}px ${fontFamily}`;
        ctx.textAlign = "left";
        let y = 96 * dpr;
        for (const [name, color] of SAT_LEGEND) {
          if (name === "Debris" ? !L.debris : !L.satellites) continue;
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(19 * dpr, y - 3 * dpr, 2.2 * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(236, 232, 255, 0.7)";
          ctx.fillText(name, 26 * dpr, y);
          y += 13 * dpr;
        }
        ctx.globalAlpha = alpha;
      }

      const fmt = (s: Projected | null) => (s ? `${(s.x / dpr).toFixed(1)},${(s.y / dpr).toFixed(1)}` : "");
      root.dataset.earthPx = fmt(earthS);
      root.dataset.globeR = (makeProjector(cam, w, h).F / Math.sqrt(Math.max(1e-6, cam.dist * cam.dist - 1)) / dpr).toFixed(1);
      root.dataset.moonPx = fmt(moonS);
      root.dataset.labels = String(labels);
      ctx.globalAlpha = 1;
    };

    const drawScaleBar = (cam: Cam, w: number, h: number, dpr: number, alpha: number) => {
      const m = modeRef.current;
      if (cam.scene !== "galaxy" && m === "log") {
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = "rgba(236, 232, 255, 0.7)";
        ctx.font = `${9 * dpr}px ${fontFamily}`;
        ctx.textAlign = "left";
        const text = cam.scene === "earth" ? "Earth to scale · heights above it log-compressed" : "log distances · sizes not to scale";
        ctx.fillText(text, 16 * dpr, 76 * dpr);
        ctx.globalAlpha = 1;
        return "log";
      }
      const F = Math.min(w, h) / 2 / Math.tan(FOV_HALF);
      const earthKm = cam.scene === "earth";
      const unitsPerPx = (cam.dist / F) * (earthKm ? RE_KM : 1);
      const len = niceLength(unitsPerPx * 80 * dpr);
      const px = len / unitsPerPx;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(236, 232, 255, 0.6)";
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(16 * dpr, 82 * dpr);
      ctx.lineTo(16 * dpr + px, 82 * dpr);
      ctx.stroke();
      ctx.fillStyle = "rgba(236, 232, 255, 0.7)";
      ctx.font = `${9 * dpr}px ${fontFamily}`;
      ctx.textAlign = "left";
      const label = earthKm ? `${len.toLocaleString()} km` : formatScale(len, m, cam.scene);
      ctx.fillText(label, 16 * dpr, 76 * dpr);
      ctx.globalAlpha = 1;
      return label;
    };

    const selPosition = (sel: Sel, jd: number, date: Date): Vec3 | null => {
      if (sel.type === "body") return indexRef.current.helioAt(sel.id, jd);
      if (sel.type === "sat") {
        const p = satPosKm(sel.i, date.getTime());
        const e = indexRef.current.helioAt("earth", jd);
        return p && e ? addV(e, scaleV(mulMat3(temeToEcliptic(date), p), 1 / AU_KM)) : null;
      }
      const s = starsRef.current[sel.i];
      return s ? starHelioAu(s, s.d) : null;
    };
    const selName = (sel: Sel) =>
      sel.type === "body"
        ? (indexRef.current.byId.get(sel.id)?.name ?? sel.id)
        : sel.type === "sat"
          ? (satRef.current?.rows[sel.i]?.[1] ?? "satellite")
          : starsRef.current[sel.i]
            ? starName(starsRef.current[sel.i]!)
            : "star";

    const satCard = (i: number, date: Date): Card | null => {
      const data = satRef.current;
      const row = data?.rows[i];
      if (!data || !row) return null;
      const debris = data.layer[i] === 1;
      const p = satPosKm(i, date.getTime());
      const sub = debris
        ? (DEBRIS_LABEL[data.group[i] ?? ""] ?? "Debris")
        : `${ORBIT_CLASS_LABEL[orbitShape(row[4], row[5], row[6]).cls]}${/^STARLINK/.test(row[1]) ? " · Starlink" : ""}`;
      const age: CardRow = ["Orbit data", data.fetchedAt ? `from ${dateTimeLabel(new Date(data.fetchedAt))}` : "—"];
      if (!p) return { key: `sat-${i}`, title: row[1], sub, rows: [["Status", "no position at this time"], ["NORAD id", String(row[0])], age] };
      const m = measureSat(row, p, satVelKm(i), date);
      return {
        key: `sat-${i}`,
        title: row[1],
        sub,
        rows: [
          ["Altitude", `${Math.round(m.altKm).toLocaleString()} km`],
          ["Speed", kmS(m.speedKmS)],
          ["Orbit", minutesLabel(m.periodMin)],
          ["Inclination", `${m.incDeg.toFixed(1)}°`],
          ["Lowest · highest", `${Math.round(m.perigeeKm).toLocaleString()} – ${Math.round(m.apogeeKm).toLocaleString()} km`],
          ["From Earth's centre", formatKm(m.centreKm)],
          ["From the Moon", formatKm(m.moonKm)],
          ["NORAD id", String(m.norad)],
          ["International id", m.objectId || "—"],
          ["Launched", m.launch ? String(m.launch) : "—"],
          age,
        ],
      };
    };

    const updatePanels = (date: Date) => {
      const sel = selectedRef.current;
      let c: Card | null = null;
      if (sel?.type === "body") c = bodyCard(indexRef.current, sel.id, date);
      else if (sel?.type === "sat") c = satCard(sel.i, date);
      else if (sel?.type === "star" && starsRef.current[sel.i]) c = starCard(starsRef.current[sel.i]!, sel.i);
      setCard(c);
      root.dataset.selected = c?.title ?? "";
      const meas = measureRef.current;
      if (meas.on && meas.a && meas.b) {
        const jd = dateToJd(date);
        const pa = selPosition(meas.a, jd, date);
        const pb = selPosition(meas.b, jd, date);
        if (pa && pb) {
          const d = distanceBetween(pa, pb);
          setMeasureOut({
            a: selName(meas.a),
            b: selName(meas.b),
            km: formatKm(d.km),
            au: formatAu(d.au),
            light: formatLightTime(d.lightTimeSec),
            rawKm: d.km,
          });
          root.dataset.measureKm = String(Math.round(d.km));
          return;
        }
      }
      setMeasureOut(null);
      root.dataset.measureKm = "";
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // The world map covers the stage; the orrery rests underneath until it closes.
      if (mapOpenRef.current) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const cam = camRef.current;
      const speed = ORRERY_SPEEDS.find(s => s.id === speedRef.current) ?? ORRERY_SPEEDS[0];
      const deep = DEEP_SPEEDS.find(s => s.id === deepSpeedRef.current) ?? DEEP_SPEEDS[0];
      const earthSpeed = EARTH_SPEEDS.find(s => s.id === earthSpeedRef.current) ?? EARTH_SPEEDS[0];
      if (playingRef.current) {
        if (cam.scene === "earth") {
          const span = EARTH_SCRUB_H * 3_600_000;
          simMsRef.current = clamp(simMsRef.current + earthSpeed.secPerSec * 1000 * dt, Date.now() - span, Date.now() + span);
        } else if (cam.scene === "solar") {
          simMsRef.current = clamp(
            advanceCosmicClock(simMsRef.current, speed.daysPerSec, dt),
            Date.now() - SCRUB_YEARS * YEAR_MS,
            Date.now() + SCRUB_YEARS * YEAR_MS,
          );
        } else {
          deepYearsRef.current = Math.min(DEEP_SCRUB_MYR * 1e6, deepYearsRef.current + deep.yearsPerSec * dt);
        }
      }
      const date = new Date(simMsRef.current);
      const jd = dateToJd(date);
      const f = orreryFrame(date);
      const bodies = indexRef.current.bodies;
      const W = buildWorld(f, bodies, jd);
      refreshOneOrbit(simMsRef.current);
      recordTrails(f, simMsRef.current);

      if (cam.fadeDir < 0) {
        cam.fade -= dt / 0.35;
        if (cam.fade <= 0) {
          cam.fade = 0;
          cam.fadeDir = 1;
          const toGalaxy = cam.nextScene === "galaxy";
          const fromEarth = cam.scene === "earth";
          cam.scene = cam.nextScene;
          cam.dist = cam.goalDist * (toGalaxy ? 0.25 : cam.scene === "earth" ? 2.2 : fromEarth ? 0.3 : 4);
          cam.blend = 1;
        }
      } else if (cam.fadeDir > 0) {
        cam.fade = Math.min(1, cam.fade + dt / 0.55);
        if (cam.fade >= 1) cam.fadeDir = 0;
      }

      const m = modeRef.current;
      const inEarth = cam.scene === "earth";
      if (inEarth && enteredScene !== "earth") {
        // Orbit elements are only good near their epoch: the globe always opens close to now,
        // turned so the day side and the terminator both show.
        if (Math.abs(simMsRef.current - Date.now()) > EARTH_SCRUB_H * 3_600_000) simMsRef.current = Date.now();
        const e = W.helio.get("earth");
        if (e) {
          const az = Math.atan2(-e.y, -e.x) + 0.9;
          const yaw = Math.atan2(Math.cos(az), -Math.sin(az));
          if (reduceMotion) cam.yaw = yaw;
          else cam.goalYaw = yaw;
        }
        startEarth();
      }
      enteredScene = cam.scene;
      if (inEarth) {
        const e = W.helio.get("earth") ?? { x: 1, y: 0, z: 0 };
        const r = vecLength(e) || 1;
        earthView.M = temeToEcliptic(date);
        earthView.spin = (earthRotationDeg(date) * Math.PI) / 180;
        earthView.sun = { x: -e.x / r, y: -e.y / r, z: -e.z / r };
        const st = satStateRef.current;
        if (worker && satRef.current && !tickPending) {
          const lead = earthSpeed.secPerSec * 1000 * (playingRef.current ? 0.3 : 0);
          const limit = earthSpeed.secPerSec * 1000 * 0.6 + 1500;
          if (!st || Math.abs(simMsRef.current - st.t) > limit) {
            tickPending = true;
            const tick: SatWorkerIn = { type: "tick", t: simMsRef.current + lead };
            worker.postMessage(tick);
          }
        }
        const sel = selectedRef.current;
        if (worker && sel?.type === "sat" && !pathPending && (satPath?.i !== sel.i || Math.abs(simMsRef.current - satPath.t) > 6 * 3_600_000)) {
          pathPending = true;
          const req: SatWorkerIn = { type: "path", i: sel.i, t: simMsRef.current, n: 160 };
          worker.postMessage(req);
        }
      }
      const focusPos =
        cam.scene === "galaxy"
          ? scaleV(andromedaShown(m, deepYearsRef.current), 0.42)
          : inEarth
            ? ZERO
            : scenePos(W, W.helio.has(cam.focus ?? "sun") ? (cam.focus ?? "sun") : "sun", m);
      if (cam.blend < 1) {
        cam.blend = Math.min(1, cam.blend + dt / 0.9);
        cam.target = lerpV(cam.from, focusPos, ease(cam.blend));
      } else {
        cam.target = focusPos;
      }
      const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 4.5);
      cam.dist = Math.exp(lerp(Math.log(cam.dist), Math.log(cam.goalDist), k));
      if (cam.goalPitch !== null) {
        cam.pitch = lerp(cam.pitch, cam.goalPitch, k);
        if (Math.abs(cam.pitch - cam.goalPitch) < 0.002) cam.goalPitch = null;
      }
      if (cam.goalYaw !== null) {
        const dy = wrapAngle(cam.goalYaw - cam.yaw);
        cam.yaw += dy * k;
        if (Math.abs(dy) < 0.002) cam.goalYaw = null;
      }

      const dpr = fitCanvas();
      const w = canvas.width;
      const h = canvas.height;
      const alpha = reduceMotion ? 1 : ease(cam.fade);
      if (gl) {
        const L = layersRef.current;
        const solar = cam.scene === "solar";
        const frameR = cam.dist / DIST_PER_FRAME;
        const inner = LEVEL_BY_ID.inner.frame[m];
        const sys = LEVEL_BY_ID.system.frame[m];
        const days = (id: string) => jd - (cloudEpoch[id] ?? jd);
        gl.frame(
          {
            yaw: cam.yaw,
            pitch: cam.pitch,
            dist: cam.dist,
            target: cam.target,
            F: Math.min(w, h) / 2 / Math.tan(FOV_HALF),
            w,
            h,
            dpr,
            log: m === "log",
          },
          L.stars ? alpha * (solar ? 1 : inEarth ? 0.8 : 0.6) : 0,
          {
            asteroids: {
              alpha: solar && L.asteroids ? alpha * 0.38 * clamp((frameR / inner - 0.25) / 0.5, 0, 1) : 0,
              color: [0.86, 0.78, 0.62],
              size: 1.1,
              days: days("asteroids"),
            },
            centaurs: {
              alpha: solar && L.centaurs ? alpha * 0.75 * clamp((frameR / sys - 0.15) / 0.35, 0, 1) : 0,
              color: [1, 0.74, 0.5],
              size: 1.5,
              days: days("centaurs"),
            },
            kuiper: {
              alpha: solar && L.kuiper ? alpha * 0.6 * clamp((frameR / sys - 0.2) / 0.4, 0, 1) : 0,
              color: [0.62, 0.76, 1],
              size: 1.2,
              days: days("kuiper"),
            },
          },
          inEarth
            ? {
                alpha,
                m: earthView.M,
                spin: earthView.spin,
                sun: earthView.sun,
                dt: satStateRef.current ? (simMsRef.current - satStateRef.current.t) / 1000 : 0,
                satellites: L.satellites ? 1 : 0,
                debris: L.debris ? 1 : 0,
              }
            : undefined,
        );
        ctx.clearRect(0, 0, w, h);
      } else {
        ctx.fillStyle = "#030308";
        ctx.fillRect(0, 0, w, h);
      }
      if (cam.scene === "solar") drawSolar(f, W, bodies, cam, w, h, dpr, alpha, speed.daysPerSec);
      else if (inEarth) drawEarthScene(cam, w, h, dpr, alpha, date);
      else drawGalaxy(cam, w, h, dpr, alpha);
      const scaleLabel = drawScaleBar(cam, w, h, dpr, alpha);

      if (now - lastReadout > 250) {
        lastReadout = now;
        root.dataset.simMs = String(Math.round(simMsRef.current));
        root.dataset.scene = cam.scene;
        root.dataset.scale = scaleLabel;
        root.dataset.focus = cam.focus ?? "";
        const offset = (simMsRef.current - Date.now()) / YEAR_MS;
        const lap = (((Math.PI - sunGalacticAngle(deepYearsRef.current)) / (2 * Math.PI)) * 100) % 100;
        setReadout({
          date: cam.scene === "earth" ? dateTimeLabel(date) : dateLabel(date),
          offset,
          deep: `+${(deepYearsRef.current / 1e6).toFixed(1)} Myr · Sun's lap ${lap.toFixed(0)}%`,
          deepMyr: Math.round(deepYearsRef.current / 1e6),
        });
        updatePanels(date);
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      alive = false;
      window.clearTimeout(denseTimer);
      stop();
      worker?.terminate();
      gl?.dispose();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [reduceMotion]);

  const galaxy = level === "galaxy";
  const globe = level === "globe";
  const followName = following ? index.byId.get(following)?.name : null;
  const offsetHours = readout.offset * 8765.81;
  const offsetLabel = globe
    ? Math.abs(offsetHours) < 0.02
      ? "now"
      : `${offsetHours > 0 ? "+" : "−"}${Math.abs(offsetHours).toFixed(Math.abs(offsetHours) < 10 ? 1 : 0)} h`
    : Math.abs(readout.offset) < 0.01
      ? "now"
      : `${readout.offset > 0 ? "+" : "−"}${Math.abs(readout.offset).toFixed(Math.abs(readout.offset) < 10 ? 2 : 1)} yr`;
  const closeCard = () => {
    selectedRef.current = null;
    setSelected(null);
    setCard(null);
  };

  return (
    <div
      ref={rootRef}
      className={`onyx-orr${rising ? " onyx-orr-rise" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Orrery: the solar system and galaxy in motion"
      onWheel={e => e.stopPropagation()}
    >
      <canvas ref={glCanvasRef} className="onyx-orr-gl" aria-hidden />
      <canvas ref={canvasRef} className="onyx-orr-canvas" aria-hidden />

      {mapOpen ? (
        <EarthMap center={mapOpen.center} sats={mapOpen.sats} reduceMotion={reduceMotion} onClose={closeMap} />
      ) : (
      <>
      <header className="onyx-orr-head">
        <button type="button" className="onyx-orr-back" onClick={onClose} aria-label="Back to the sky">
          ‹
        </button>
        <p className="onyx-orr-title">
          Orrery
          {followName ? <span className="onyx-orr-sub"> · following {followName}</span> : null}
          {globe ? <span className="onyx-orr-sub"> · Earth and what circles it</span> : null}
        </p>
        <div className="onyx-orr-scale" role="group" aria-label="Distance scale">
          <button
            type="button"
            className={`onyx-orr-chip${mode === "log" ? " on" : ""}`}
            aria-pressed={mode === "log"}
            onClick={() => chooseMode("log")}
          >
            Log
          </button>
          <button
            type="button"
            className={`onyx-orr-chip${mode === "true" ? " on" : ""}`}
            aria-pressed={mode === "true"}
            onClick={() => chooseMode("true")}
          >
            True
          </button>
        </div>
      </header>

      {card && !measure.on && !galaxy ? (
        <section className="onyx-orr-card" aria-label={`Measurements: ${card.title}`}>
          <header>
            <div>
              <h2>{card.title}</h2>
              <p>{card.sub}</p>
            </div>
            <button type="button" className="onyx-orr-card-x" onClick={closeCard} aria-label="Close measurements">
              ×
            </button>
          </header>
          <dl>
            {card.rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {measure.on ? (
        <section className="onyx-orr-card onyx-orr-measure" aria-label="Measure between two objects" aria-live="polite">
          <header>
            <div>
              <h2>Measure</h2>
              <p>
                {!measure.a ? "Tap or find object A" : !measure.b ? "Now tap or find object B" : "Tap again to start over"}
              </p>
            </div>
            <button type="button" className="onyx-orr-card-x" onClick={toggleMeasure} aria-label="Leave Measure">
              ×
            </button>
          </header>
          {measureOut ? (
            <dl>
              <div>
                <dt>A → B</dt>
                <dd>
                  {measureOut.a} → {measureOut.b}
                </dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>{measureOut.km}</dd>
              </div>
              <div>
                <dt>In AU</dt>
                <dd>{measureOut.au}</dd>
              </div>
              <div>
                <dt>Light-time</dt>
                <dd>{measureOut.light}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      ) : null}

      <div className="onyx-orr-panel">
        <div className="onyx-orr-row onyx-orr-tools">
          <button
            type="button"
            className={`onyx-orr-chip${layersOpen ? " on" : ""}`}
            aria-expanded={layersOpen}
            onClick={() => setLayersOpen(o => !o)}
          >
            Layers
          </button>
          <button type="button" className={`onyx-orr-chip${measure.on ? " on" : ""}`} aria-pressed={measure.on} onClick={toggleMeasure}>
            Measure
          </button>
          <OrreryShellTools focus={card?.title ?? followName ?? null} />
          <form
            className="onyx-orr-find"
            role="search"
            onSubmit={e => {
              e.preventDefault();
              if (find(query)) (document.activeElement as HTMLElement | null)?.blur();
            }}
          >
            <input
              type="search"
              list="onyx-orr-names"
              value={query}
              placeholder={globe ? "Find ISS, Hubble, Starlink…" : "Find Titan, Halley, Voyager 1…"}
              aria-label="Find an object and fly to it"
              autoComplete="off"
              enterKeyHint="go"
              onKeyDown={e => e.stopPropagation()}
              onChange={e => {
                setQuery(e.target.value);
                if (searchNames.has(e.target.value)) find(e.target.value);
              }}
            />
          </form>
          <datalist id="onyx-orr-names">
            {[...searchNames.keys()].map(n => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        {layersOpen ? (
          <div className="onyx-orr-row onyx-orr-layers" role="group" aria-label="Layers">
            {LAYERS.map(l => (
              <button
                key={l.id}
                type="button"
                className={`onyx-orr-chip${layers[l.id] ? " on" : ""}`}
                aria-pressed={layers[l.id]}
                data-layer={l.id}
                onClick={() => toggleLayer(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="onyx-orr-row onyx-orr-time">
          <button
            type="button"
            className="onyx-orr-chip"
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <span className="onyx-orr-date" aria-live="off">
            {galaxy ? readout.deep : `${readout.date} · ${offsetLabel}`}
          </span>
          <button type="button" className="onyx-orr-chip ghost" onClick={resetNow}>
            Now
          </button>
          {followName ? (
            <button type="button" className="onyx-orr-chip ghost" onClick={releaseFocus}>
              Unfollow
            </button>
          ) : null}
        </div>
        {galaxy ? (
          <input
            className="onyx-orr-scrub"
            type="range"
            min={0}
            max={DEEP_SCRUB_MYR}
            step={1}
            value={readout.deepMyr}
            aria-label="Deep time, millions of years from now"
            onChange={e => {
              deepYearsRef.current = Number(e.target.value) * 1e6;
            }}
          />
        ) : globe ? (
          <input
            className="onyx-orr-scrub"
            type="range"
            min={-EARTH_SCRUB_H}
            max={EARTH_SCRUB_H}
            step={0.1}
            value={clamp(offsetHours, -EARTH_SCRUB_H, EARTH_SCRUB_H)}
            aria-label="Scrub time, hours from now"
            onChange={e => {
              simMsRef.current = Date.now() + Number(e.target.value) * 3_600_000;
            }}
          />
        ) : (
          <input
            className="onyx-orr-scrub"
            type="range"
            min={-SCRUB_YEARS}
            max={SCRUB_YEARS}
            step={0.05}
            value={clamp(readout.offset, -SCRUB_YEARS, SCRUB_YEARS)}
            aria-label="Scrub time, years from today"
            onChange={e => {
              simMsRef.current = Date.now() + Number(e.target.value) * YEAR_MS;
            }}
          />
        )}
        <div className="onyx-orr-row" role="group" aria-label="Speed">
          {galaxy
            ? DEEP_SPEEDS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`onyx-orr-chip${deepSpeedId === s.id ? " on" : ""}`}
                  aria-pressed={deepSpeedId === s.id}
                  onClick={() => setDeepSpeedId(s.id)}
                >
                  {s.label}
                </button>
              ))
            : globe
              ? EARTH_SPEEDS.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`onyx-orr-chip${earthSpeedId === s.id ? " on" : ""}`}
                    aria-pressed={earthSpeedId === s.id}
                    onClick={() => setEarthSpeedId(s.id)}
                  >
                    {s.label}
                  </button>
                ))
              : ORRERY_SPEEDS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`onyx-orr-chip${speedId === s.id ? " on" : ""}`}
                  aria-pressed={speedId === s.id}
                  onClick={() => setSpeedId(s.id)}
                >
                  {s.label}
                </button>
              ))}
        </div>
        <div className="onyx-orr-row" role="group" aria-label="Zoom level">
          {LEVELS.map(l => (
            <button
              key={l.id}
              type="button"
              className={`onyx-orr-chip${level === l.id ? " on" : ""}`}
              aria-pressed={level === l.id}
              onClick={() => chooseLevel(l.id)}
            >
              {l.label}
            </button>
          ))}
          {globe ? (
            <button type="button" className="onyx-orr-chip" data-level="map" onClick={() => openMapRef.current()}>
              World map
            </button>
          ) : null}
        </div>
        <p className="onyx-orr-hint">
          {globe
            ? "drag to turn · pinch in for the world map · tap a satellite to measure it"
            : level === "earth"
              ? "pinch into Earth to see its satellites · tap anything to measure it"
              : "drag to turn · pinch to zoom · tap anything to measure it"}
        </p>
        <p className="onyx-orr-credit">
          {globe
            ? `Orbit data: CelesTrak${orbitInfo ? ` · from ${dateTimeLabel(new Date(orbitInfo.fetchedAt))}` : ""} · SGP4 via satellite.js · Natural Earth`
            : "Data: NASA/JPL Horizons & Small-Body Database · Yale Bright Star Catalogue · astronomy-engine"}
        </p>
      </div>
      </>
      )}
    </div>
  );
}

/** Andromeda's drawn position: true distance, or pulled in (log) so it fits beside the Milky Way. */
function andromedaShown(mode: ScaleMode, years: number): Vec3 {
  const dLy = andromedaDistanceLy(years);
  const shown = mode === "log" ? 22_000 + 26_000 * (dLy / GALAXY.andromedaLy) : dLy;
  return addV(sunGalacticPosition(0), scaleV(andromedaDirection(), shown));
}
