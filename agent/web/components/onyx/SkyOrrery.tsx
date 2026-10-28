"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRIGHT_STARS } from "../../lib/brightStars";
import { CONSTELLATION_FIGURES } from "../../lib/constellationLines";
import {
  AU_KM,
  GALAXY,
  ORRERY_BODIES,
  ORRERY_BODY_BY_ID,
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
import { ORRERY_SPEEDS, advanceCosmicClock, type OrrerySpeedId } from "../../lib/timeEngine";

type LevelId = "earth" | "inner" | "system" | "galaxy";
type ScaleMode = "log" | "true";
type SceneKind = "solar" | "galaxy";

const LEVELS: Array<{
  id: LevelId;
  label: string;
  focus: string | null;
  frame: Record<ScaleMode, number>;
  pitchDeg: number;
}> = [
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

const FOV_HALF = (20 * Math.PI) / 180;
/** Camera distance that fits a sphere of radius 1 on the short screen side. */
const DIST_PER_FRAME = 1.08 / Math.tan(FOV_HALF);
const YEAR_MS = 365.2422 * 86_400_000;
const SCRUB_YEARS = 200;
const DEEP_SCRUB_MYR = 1000;
const ORBIT_STALE_MS = 30 * YEAR_MS;
const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

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

type Cam = {
  yaw: number;
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

function scenePos(id: string, f: OrreryFrame, mode: ScaleMode): Vec3 {
  const body = ORRERY_BODY_BY_ID[id];
  const helio = f.helio[id] ?? ZERO;
  if (mode === "true" || !body) return helio;
  if (body.parent === "earth" || body.parent === "jupiter") {
    const sat = f.satellites[id];
    const parent = toLogScene(f.helio[body.parent] ?? ZERO);
    return sat ? addV(parent, satelliteLogOffset(sat.pos)) : parent;
  }
  return toLogScene(helio);
}

function presetDist(level: LevelId, focus: string | null, mode: ScaleMode): number {
  const lv = LEVEL_BY_ID[level];
  if (lv.id === "galaxy" || !focus || focus === lv.focus || focus === "sun") {
    return lv.frame[mode] * DIST_PER_FRAME;
  }
  if (focus === "earth") return LEVEL_BY_ID.earth.frame[mode] * DIST_PER_FRAME;
  if (focus === "jupiter") return (mode === "log" ? 0.17 : 0.016) * DIST_PER_FRAME;
  const body = ORRERY_BODY_BY_ID[focus];
  if (body?.kind === "moon") return (mode === "log" ? 0.07 : 0.004) * DIST_PER_FRAME;
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
): boolean {
  const w = ctx.measureText(text).width;
  const h = 11 * dpr;
  x = clamp(x, w / 2 + 6 * dpr, ctx.canvas.width - w / 2 - 6 * dpr);
  const rect: [number, number, number, number] = [x - w / 2 - 2, y - h, x + w / 2 + 2, y + 2];
  for (const p of placed) {
    if (rect[0] < p[2] && rect[2] > p[0] && rect[1] < p[3] && rect[3] > p[1]) return false;
  }
  placed.push(rect);
  ctx.fillStyle = `rgba(236, 232, 255, ${alpha.toFixed(3)})`;
  ctx.fillText(text, x, y);
  return true;
}

export function SkyOrrery({ onClose, rise = false }: { onClose: () => void; rise?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const [level, setLevel] = useState<LevelId>("inner");
  const [mode, setMode] = useState<ScaleMode>("log");
  const [speedId, setSpeedId] = useState<OrrerySpeedId>(reduceMotion ? "day" : "month");
  const [deepSpeedId, setDeepSpeedId] = useState<DeepSpeedId>("tenmyr");
  const [playing, setPlaying] = useState(true);
  const [following, setFollowing] = useState<string | null>(null);
  const [readout, setReadout] = useState({ date: "", offset: 0, deep: "", deepMyr: 0 });

  const simMsRef = useRef(0);
  const deepYearsRef = useRef(0);
  const levelRef = useRef(level);
  const modeRef = useRef(mode);
  const speedRef = useRef(speedId);
  const deepSpeedRef = useRef(deepSpeedId);
  const playingRef = useRef(playing);
  useEffect(() => {
    levelRef.current = level;
    modeRef.current = mode;
    speedRef.current = speedId;
    deepSpeedRef.current = deepSpeedId;
    playingRef.current = playing;
  }, [level, mode, speedId, deepSpeedId, playing]);

  // A pull-back entry starts edge-on and close, as if rising off the horizon into space.
  const rising = rise && !reduceMotion;
  const camRef = useRef<Cam>({
    yaw: -0.5,
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
  const frameRef = useRef<OrreryFrame | null>(null);
  const autoLevelRef = useRef<(next: LevelId) => void>(() => {});

  const applyLevel = useCallback(
    (next: LevelId, scaleMode: ScaleMode) => {
      const cam = camRef.current;
      const lv = LEVEL_BY_ID[next];
      const scene: SceneKind = next === "galaxy" ? "galaxy" : "solar";
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
    cam.goalDist = presetDist(levelRef.current, cam.focus, next);
    cam.dist = cam.goalDist;
    cam.blend = 1;
  };

  const focusBody = (id: string) => {
    const cam = camRef.current;
    if (cam.scene !== "solar") return;
    cam.from = cam.target;
    cam.blend = reduceMotion ? 1 : 0;
    cam.focus = id;
    if (id !== "sun") cam.goalDist = presetDist(levelRef.current, id, modeRef.current);
    if (reduceMotion) cam.dist = cam.goalDist;
    setFollowing(id === "sun" ? null : id);
  };
  const focusBodyRef = useRef<(id: string) => void>(() => {});
  useEffect(() => {
    focusBodyRef.current = focusBody;
    autoLevelRef.current = next => {
      if (levelRef.current === next) return;
      levelRef.current = next;
      setLevel(next);
      applyLevel(next, modeRef.current);
    };
  });

  const releaseFocus = () => {
    applyLevel(levelRef.current, modeRef.current);
  };

  const resetNow = () => {
    simMsRef.current = Date.now();
    deepYearsRef.current = 0;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!simMsRef.current) simMsRef.current = Date.now();
    const fontFamily = getComputedStyle(canvas).fontFamily || "system-ui, sans-serif";
    const galaxyStars = galaxyStarField(1400);
    const orbitCache = new Map<string, { center: number; true: Vec3[]; log: Vec3[] }>();
    const helioBodies = ORRERY_BODIES.filter(b => b.parent === "sun");
    let hits: Array<{ id: string; x: number; y: number; r: number }> = [];
    let raf = 0;
    let last = performance.now();
    let lastReadout = 0;

    const clampDist = (cam: Cam, d: number, fromUser: boolean) => {
      const m = modeRef.current;
      if (cam.scene === "solar") {
        const sys = LEVEL_BY_ID.system.frame[m] * DIST_PER_FRAME;
        const min = (m === "log" ? 0.02 : 0.0004) * DIST_PER_FRAME;
        if (fromUser && d > sys * 3.2 && cam.fadeDir === 0) autoLevelRef.current("galaxy");
        return clamp(d, min, sys * 5);
      }
      const g = LEVEL_BY_ID.galaxy.frame[m] * DIST_PER_FRAME;
      if (fromUser && d < g * 0.12 && cam.fadeDir === 0) autoLevelRef.current("system");
      return clamp(d, g * 0.08, g * 4);
    };

    /* ── input: drag to orbit, pinch / wheel to zoom, tap to follow ── */
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; dist: number } | null = null;
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
        pinch = { d: pairDistance(), dist: camRef.current.goalDist };
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
        moved += Math.abs(dx) + Math.abs(dy);
      } else if (pointers.size === 2 && pinch && pinch.d > 0) {
        const d = pairDistance();
        if (d > 0) cam.goalDist = clampDist(cam, (pinch.dist * pinch.d) / d, true);
      }
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
      if (best) focusBodyRef.current(best.id);
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

    // Fading trails: Sun-bound bodies store heliocentric points, moons store
    // offsets from their planet so the trail rides along with it.
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
      id: string,
      f: OrreryFrame,
      m: ScaleMode,
      project: (p: Vec3) => Projected | null,
      dpr: number,
      alpha: number,
    ) => {
      const body = ORRERY_BODY_BY_ID[id];
      const list = trails.get(id);
      if (!body || !list || list.length < 2) return;
      const sat = f.satellites[id];
      const parentScene = sat ? scenePos(sat.parent, f, m) : null;
      const toScene = (p: Vec3) =>
        parentScene
          ? addV(parentScene, m === "log" ? satelliteLogOffset(p) : p)
          : m === "log"
            ? toLogScene(p)
            : p;
      const pts = [...list.map(q => project(toScene(q.p))), project(scenePos(id, f, m))];
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
      for (const s of STAR_DIRS) {
        const p = projectDir(s.d);
        if (!p) continue;
        const a = clamp(0.75 - s.mag * 0.18, 0.18, 0.8) * alpha;
        ctx.fillStyle = `rgba(226, 222, 255, ${a.toFixed(3)})`;
        ctx.fillRect(p.x, p.y, 1.2 * dpr, 1.2 * dpr);
      }
    };

    const drawSolar = (
      f: OrreryFrame,
      cam: Cam,
      w: number,
      h: number,
      dpr: number,
      alpha: number,
      daysPerSec: number,
    ) => {
      const m = modeRef.current;
      const { project, projectDir, screenDir } = makeProjector(cam, w, h);
      ctx.globalAlpha = alpha;
      drawStars(projectDir, 1, dpr);

      // Bodies well outside the framed region fade so the close views stay readable.
      const frameR = cam.dist / DIST_PER_FRAME;
      const focusId = cam.focus ?? "sun";
      const keep = new Set([focusId, ORRERY_BODY_BY_ID[focusId]?.parent ?? "sun", "sun"]);
      const visibility = (id: string) => {
        const body = ORRERY_BODY_BY_ID[id];
        if (keep.has(id) || (body?.parent && keep.has(body.parent) && body.parent !== "sun")) return 1;
        const p = scenePos(id, f, m);
        const d = Math.hypot(p.x - cam.target.x, p.y - cam.target.y, p.z - cam.target.z) / frameR;
        return clamp((1.7 - d) / 0.55, 0, 1);
      };
      const vis = new Map(ORRERY_BODIES.map(b => [b.id, visibility(b.id)]));

      for (const b of helioBodies) {
        const c = orbitCache.get(b.id);
        const v = vis.get(b.id) ?? 1;
        if (!c || v <= 0.02) continue;
        const minor = b.kind === "asteroid" || b.kind === "comet";
        ctx.globalAlpha = alpha * v;
        strokePath(
          m === "log" ? c.log : c.true,
          project,
          minor ? "rgba(170, 160, 220, 0.16)" : "rgba(169, 156, 255, 0.28)",
          (minor ? 0.7 : 1) * dpr,
          b.kind === "comet" ? [4 * dpr, 4 * dpr] : null,
        );
      }
      ctx.globalAlpha = alpha;

      for (const [id, sat] of Object.entries(f.satellites)) {
        if ((vis.get(id) ?? 1) <= 0.02) continue;
        const parentScene = scenePos(sat.parent, f, m);
        const pp = project(parentScene);
        const sp = project(scenePos(id, f, m));
        if (!pp || !sp || Math.hypot(pp.x - sp.x, pp.y - sp.y) < 5 * dpr) continue;
        const rel = osculatingOrbit(sat.pos, sat.vel, sat.mu, 72);
        const pts = rel.map(r => addV(parentScene, m === "log" ? satelliteLogOffset(r) : r));
        strokePath(pts, project, "rgba(200, 196, 240, 0.3)", 0.8 * dpr, null);
      }

      for (const b of ORRERY_BODIES) {
        const v = vis.get(b.id) ?? 1;
        if (b.parent && v > 0.02) drawTrail(b.id, f, m, project, dpr, alpha * v);
      }

      const sysDist = LEVEL_BY_ID.system.frame[m] * DIST_PER_FRAME;
      const zoomMul = clamp((sysDist / cam.dist) ** 0.3, 1, 3.4);
      const sunScene = scenePos("sun", f, m);
      const drawn: Array<{ body: OrreryBody; s: Projected; r: number; pos: Vec3 }> = [];
      for (const b of ORRERY_BODIES) {
        if ((vis.get(b.id) ?? 1) <= 0.02) continue;
        const pos = scenePos(b.id, f, m);
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
        const revPerSec = daysPerSec / Math.abs(d.body.rotationDays);
        const spin = playingRef.current && revPerSec > 1.2 ? null : spinAngle(d.body, f.date);
        if (d.body.kind === "comet") {
          const rSun = vecLength(f.helio[d.body.id] ?? ZERO);
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
        ctx.globalAlpha = alpha;
        hits.push({ id: d.body.id, x: d.s.x, y: d.s.y, r: d.r });
      }

      ctx.font = `${10 * dpr}px ${fontFamily}`;
      ctx.textAlign = "center";
      const placed: Array<[number, number, number, number]> = [];
      const byId = new Map(drawn.map(d => [d.body.id, d]));
      const order = [...drawn].sort((a, b) => rank(a.body) - rank(b.body));
      for (const d of order) {
        if (d.body.kind === "moon") {
          const parent = byId.get(d.body.parent ?? "");
          if (parent && Math.hypot(parent.s.x - d.s.x, parent.s.y - d.s.y) < 16 * dpr) continue;
        }
        const v = vis.get(d.body.id) ?? 1;
        if (v < 0.5 || d.s.x < 0 || d.s.x > w || d.s.y < 0 || d.s.y > h) continue;
        const a = (d.body.kind === "asteroid" || d.body.kind === "comet" ? 0.5 : 0.82) * v;
        drawLabel(ctx, placed, d.body.name, d.s.x, d.s.y - d.r - 5 * dpr, a, dpr);
      }

      const earth = byId.get("earth");
      const moon = byId.get("moon");
      const sun = byId.get("sun");
      const fmt = (p?: { s: Projected }) => (p ? `${(p.s.x / dpr).toFixed(1)},${(p.s.y / dpr).toFixed(1)}` : "");
      root.dataset.earthPx = fmt(earth);
      root.dataset.moonPx = fmt(moon);
      root.dataset.sunPx = fmt(sun);
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
      const dir = andromedaDirection();
      const dLy = andromedaDistanceLy(years);
      const shown = m === "log" ? 30_000 + 34_000 * (dLy / GALAXY.andromedaLy) : dLy;
      const sunAtStart = sunGalacticPosition(0);
      const andPos = addV(sunAtStart, scaleV(dir, shown));
      const and = project(andPos);

      ctx.font = `${10 * dpr}px ${fontFamily}`;
      ctx.textAlign = "center";
      const placed: Array<[number, number, number, number]> = [];
      if (core) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(core.x, core.y, 2 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      if (sun) {
        ctx.fillStyle = "#ffd98a";
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, 3.2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        drawLabel(ctx, placed, "Sun + every planet · 26,000 ly out", sun.x, sun.y - 22 * dpr, 0.9, dpr);
        drawLabel(ctx, placed, "one lap ≈ 230 million years", sun.x, sun.y - 9 * dpr, 0.6, dpr);
      }
      if (core) {
        drawLabel(ctx, placed, "Sgr A* · the black hole at the centre", core.x, core.y + 18 * dpr, 0.85, dpr);
      }
      if (and) {
        const radiusLy = m === "log" ? 16_000 : GALAXY.andromedaRadiusLy;
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
        drawLabel(ctx, placed, `Andromeda · ${mly} million ly`, and.x, and.y - 12 * dpr, 0.9, dpr);
        drawLabel(
          ctx,
          placed,
          m === "log" ? "closing at 110 km/s · pulled in to fit" : "closing at 110 km/s · true distance",
          and.x,
          and.y + 18 * dpr,
          0.6,
          dpr,
        );
        drawLabel(ctx, placed, "merger in ~4.5 billion years", and.x, and.y + 31 * dpr, 0.5, dpr);
      }
      hits = [];
      ctx.globalAlpha = 1;
    };

    const drawScaleBar = (cam: Cam, w: number, h: number, dpr: number, alpha: number) => {
      const m = modeRef.current;
      if (cam.scene === "solar" && m === "log") {
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = "rgba(236, 232, 255, 0.7)";
        ctx.font = `${9 * dpr}px ${fontFamily}`;
        ctx.textAlign = "left";
        ctx.fillText("log distances · sizes not to scale", 16 * dpr, 76 * dpr);
        ctx.globalAlpha = 1;
        return "log";
      }
      const F = Math.min(w, h) / 2 / Math.tan(FOV_HALF);
      const unitsPerPx = cam.dist / F;
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
      const label = formatScale(len, m, cam.scene);
      ctx.fillText(label, 16 * dpr, 76 * dpr);
      ctx.globalAlpha = 1;
      return label;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const cam = camRef.current;
      const speed = ORRERY_SPEEDS.find(s => s.id === speedRef.current) ?? ORRERY_SPEEDS[0];
      const deep = DEEP_SPEEDS.find(s => s.id === deepSpeedRef.current) ?? DEEP_SPEEDS[0];
      if (playingRef.current) {
        if (cam.scene === "solar") {
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
      const f = orreryFrame(date);
      frameRef.current = f;
      refreshOneOrbit(simMsRef.current);
      recordTrails(f, simMsRef.current);

      if (cam.fadeDir < 0) {
        cam.fade -= dt / 0.35;
        if (cam.fade <= 0) {
          cam.fade = 0;
          cam.fadeDir = 1;
          const toGalaxy = cam.nextScene === "galaxy";
          cam.scene = cam.nextScene;
          cam.dist = cam.goalDist * (toGalaxy ? 0.25 : 4);
          cam.blend = 1;
        }
      } else if (cam.fadeDir > 0) {
        cam.fade = Math.min(1, cam.fade + dt / 0.55);
        if (cam.fade >= 1) cam.fadeDir = 0;
      }

      const m = modeRef.current;
      const focusPos =
        cam.scene === "galaxy"
          ? m === "true"
            ? scaleV(addV(sunGalacticPosition(0), scaleV(andromedaDirection(), andromedaDistanceLy(deepYearsRef.current))), 0.45)
            : ZERO
          : scenePos(cam.focus ?? "sun", f, m);
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

      const dpr = fitCanvas();
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#030308";
      ctx.fillRect(0, 0, w, h);
      const alpha = reduceMotion ? 1 : ease(cam.fade);
      if (cam.scene === "solar") drawSolar(f, cam, w, h, dpr, alpha, speed.daysPerSec);
      else drawGalaxy(cam, w, h, dpr, alpha);
      const scaleLabel = drawScaleBar(cam, w, h, dpr, alpha);

      if (now - lastReadout > 250) {
        lastReadout = now;
        root.dataset.simMs = String(Math.round(simMsRef.current));
        root.dataset.scene = cam.scene;
        root.dataset.scale = scaleLabel;
        const offset = (simMsRef.current - Date.now()) / YEAR_MS;
        const lap = (((Math.PI - sunGalacticAngle(deepYearsRef.current)) / (2 * Math.PI)) * 100) % 100;
        setReadout({
          date: date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
          offset,
          deep: `+${(deepYearsRef.current / 1e6).toFixed(1)} Myr · Sun's lap ${lap.toFixed(0)}%`,
          deepMyr: Math.round(deepYearsRef.current / 1e6),
        });
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
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [reduceMotion]);

  const galaxy = level === "galaxy";
  const followName = following ? ORRERY_BODY_BY_ID[following]?.name : null;
  const offsetLabel =
    Math.abs(readout.offset) < 0.01
      ? "now"
      : `${readout.offset > 0 ? "+" : "−"}${Math.abs(readout.offset).toFixed(Math.abs(readout.offset) < 10 ? 2 : 1)} yr`;

  return (
    <div
      ref={rootRef}
      className={`onyx-orr${rising ? " onyx-orr-rise" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Orrery: the solar system and galaxy in motion"
      onWheel={e => e.stopPropagation()}
    >
      <canvas ref={canvasRef} className="onyx-orr-canvas" aria-hidden />

      <header className="onyx-orr-head">
        <button type="button" className="onyx-orr-back" onClick={onClose} aria-label="Back to the sky">
          ‹
        </button>
        <p className="onyx-orr-title">
          Orrery
          {followName ? <span className="onyx-orr-sub"> · following {followName}</span> : null}
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

      <div className="onyx-orr-panel">
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
        </div>
        <p className="onyx-orr-hint">drag to turn · pinch to zoom · tap a world to follow it</p>
      </div>
    </div>
  );
}

function rank(b: OrreryBody): number {
  switch (b.kind) {
    case "star":
      return 0;
    case "planet":
      return 1;
    case "moon":
      return 2;
    case "dwarf":
      return 3;
    default:
      return 4;
  }
}
