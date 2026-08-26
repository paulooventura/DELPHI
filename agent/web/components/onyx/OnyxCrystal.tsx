"use client";

/**
 * Background rectangular 4-face lapidated onyx crystal — gimbal-linked.
 * beta / gamma from DeviceOrientation drive a soft 3D tilt;
 * desktop falls back to pointer parallax.
 */

import { useEffect, useRef } from "react";
import { watchDeviceOrientation } from "../../lib/localSignals";

type Pose = { rx: number; ry: number; tx: number; ty: number; hx: number; hy: number };

/** Resting pose — slight yaw so the rectangular body reads as volume. */
const IDLE: Pose = { rx: 6, ry: -14, tx: 0, ty: 0, hx: 38, hy: 34 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function OnyxCrystal({ sensorsUnlocked = false }: { sensorsUnlocked?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const glossRef = useRef<SVGEllipseElement>(null);
  const target = useRef<Pose>({ ...IDLE });
  const current = useRef<Pose>({ ...IDLE });
  const baseline = useRef<{ beta: number; gamma: number } | null>(null);
  const samples = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!sensorsUnlocked) return;
    const body = bodyRef.current;
    const stage = stageRef.current;
    if (!body || !stage) return;

    let gimbalLive = false;
    let lastGimbal = 0;

    const tick = () => {
      const c = current.current;
      const t = target.current;
      const k = 0.12;
      c.rx = lerp(c.rx, t.rx, k);
      c.ry = lerp(c.ry, t.ry, k);
      c.tx = lerp(c.tx, t.tx, k);
      c.ty = lerp(c.ty, t.ty, k);
      c.hx = lerp(c.hx, t.hx, k);
      c.hy = lerp(c.hy, t.hy, k);
      body.style.transform =
        `translate3d(${c.tx.toFixed(2)}px, ${c.ty.toFixed(2)}px, 0) ` +
        `rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg)`;
      if (glossRef.current) {
        glossRef.current.setAttribute("cx", String(c.hx));
        glossRef.current.setAttribute("cy", String(c.hy));
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    const applyDelta = (db: number, dg: number) => {
      target.current = {
        rx: clamp(-db * 0.45 + 6, -14, 16),
        ry: clamp(dg * 0.75 - 14, -28, 18),
        tx: dg * 0.5,
        ty: -db * 0.3,
        hx: clamp(38 + dg * 0.7, 26, 56),
        hy: clamp(34 - db * 0.55, 22, 56),
      };
    };

    const stopOrient = watchDeviceOrientation(reading => {
      const beta = reading.beta;
      const gamma = reading.gamma;
      if (beta == null || gamma == null) return;

      samples.current += 1;
      if (!baseline.current || samples.current <= 8) {
        baseline.current = { beta, gamma };
        if (samples.current < 8) return;
      }

      const db = clamp(beta - baseline.current.beta, -28, 28);
      const dg = clamp(gamma - baseline.current.gamma, -28, 28);
      if (Math.abs(db) + Math.abs(dg) > 0.4) {
        gimbalLive = true;
        lastGimbal = performance.now();
      }
      applyDelta(db, dg);
    });

    const host =
      (stage.closest(".onyx-device") as HTMLElement | null) ?? stage;
    const onPointer = (ev: Event) => {
      const e = ev as PointerEvent;
      if (gimbalLive && performance.now() - lastGimbal < 900) return;
      const r = host.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      applyDelta(ny * 16, nx * 18);
    };
    host.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      cancelAnimationFrame(raf.current);
      stopOrient();
      host.removeEventListener("pointermove", onPointer);
    };
  }, [sensorsUnlocked]);

  return (
    <div className="onyx-crystal-stage" ref={stageRef} aria-hidden>
      <div className="onyx-crystal" ref={bodyRef}>
        <div className="onyx-crystal-glow" />
        {/*
          Rectangular symmetrical lapidated crystal — four primary faces.
          Opaque stone body (not a wireframe sheet).
        */}
        <svg className="onyx-crystal-svg" viewBox="0 0 100 140" fill="none">
          <defs>
            <linearGradient id="onyx-xtal-body" x1="18%" y1="4%" x2="82%" y2="98%">
              <stop offset="0%" stopColor="#2a2438" />
              <stop offset="28%" stopColor="#14101c" />
              <stop offset="62%" stopColor="#08060c" />
              <stop offset="100%" stopColor="#1a1428" />
            </linearGradient>
            <linearGradient id="onyx-xtal-left" x1="0" y1="0.15" x2="1" y2="0.85">
              <stop offset="0%" stopColor="#5a4e78" stopOpacity="0.92" />
              <stop offset="40%" stopColor="#2e2644" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#100e18" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="onyx-xtal-right" x1="1" y1="0.1" x2="0" y2="0.95">
              <stop offset="0%" stopColor="#1c1628" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#08060c" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#000" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="onyx-xtal-edge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e0d0a8" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#a898ff" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#c4ae80" stopOpacity="0.75" />
            </linearGradient>
            <radialGradient id="onyx-xtal-core" cx="42%" cy="40%" r="46%">
              <stop offset="0%" stopColor="#7a6cff" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#3a2f68" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="onyx-xtal-gloss" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff8ff" stopOpacity="0.7" />
              <stop offset="40%" stopColor="#c8b8ff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <filter id="onyx-xtal-soft" x="-20%" y="-10%" width="140%" height="120%">
              <feGaussianBlur stdDeviation="0.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Depth plate — offset rear face for stone thickness */}
          <polygon
            points="52,10 72,30 72,114 52,134 32,114 32,30"
            fill="#050408"
            opacity="0.85"
          />

          {/* Silhouette — solid body */}
          <polygon
            points="50,8 70,28 70,112 50,132 30,112 30,28"
            fill="url(#onyx-xtal-body)"
            stroke="url(#onyx-xtal-edge)"
            strokeWidth="1.35"
            strokeLinejoin="round"
            filter="url(#onyx-xtal-soft)"
          />

          {/* Near-left face (lit stone) */}
          <polygon
            points="50,8 30,28 30,112 50,132 50,70 50,28"
            fill="url(#onyx-xtal-left)"
          />
          {/* Near-right face (deep shadow) */}
          <polygon
            points="50,8 70,28 70,112 50,132 50,70 50,28"
            fill="url(#onyx-xtal-right)"
          />

          <polygon
            points="50,8 70,28 70,112 50,132 30,112 30,28"
            fill="url(#onyx-xtal-core)"
          />

          {/* Lapidation ridges */}
          <g stroke="rgba(220,200,160,0.42)" strokeWidth="0.7" strokeLinecap="round">
            <line x1="50" y1="8" x2="50" y2="132" />
            <line x1="30" y1="28" x2="30" y2="112" stroke="rgba(180,166,255,0.35)" />
            <line x1="70" y1="28" x2="70" y2="112" stroke="rgba(80,70,110,0.55)" />
            <line x1="30" y1="28" x2="70" y2="28" stroke="rgba(240,230,255,0.35)" />
            <line x1="30" y1="112" x2="70" y2="112" stroke="rgba(196,174,128,0.3)" />
            <line x1="30" y1="70" x2="70" y2="70" stroke="rgba(160,148,255,0.28)" />
          </g>

          <polyline
            points="50,10 32,28 32,52"
            fill="none"
            stroke="rgba(255,248,255,0.45)"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="50,10 68,28"
            fill="none"
            stroke="rgba(196,174,128,0.28)"
            strokeWidth="0.7"
            strokeLinecap="round"
          />

          <ellipse
            ref={glossRef}
            cx="38"
            cy="34"
            rx="9"
            ry="14"
            fill="url(#onyx-xtal-gloss)"
            opacity="0.9"
          />

          <circle cx="50" cy="70" r="1.6" fill="rgba(240,230,255,0.55)" />
        </svg>
      </div>
    </div>
  );
}
