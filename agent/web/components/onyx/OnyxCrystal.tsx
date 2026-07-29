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
const IDLE: Pose = { rx: 4, ry: -12, tx: 0, ty: 0, hx: 38, hy: 34 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function OnyxCrystal() {
  const stageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const glossRef = useRef<SVGEllipseElement>(null);
  const target = useRef<Pose>({ ...IDLE });
  const current = useRef<Pose>({ ...IDLE });
  const baseline = useRef<{ beta: number; gamma: number } | null>(null);
  const samples = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
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
        rx: clamp(-db * 0.45 + 4, -14, 16),
        ry: clamp(dg * 0.75 - 12, -28, 18),
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
        // Freeze a resting hold so the crystal doesn't jump at first paint.
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
      // Phone gimbal wins while fresh; desktop / idle uses pointer parallax.
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
  }, []);

  return (
    <div className="onyx-crystal-stage" ref={stageRef} aria-hidden>
      <div className="onyx-crystal" ref={bodyRef}>
        <div className="onyx-crystal-glow" />
        {/*
          Rectangular symmetrical lapidated crystal — four primary faces.
          Elevation: pointed crown + rectangular prism body + pointed pavilion.
          Center ridge = meeting of the two near faces; outer edges = the other pair.
        */}
        <svg className="onyx-crystal-svg" viewBox="0 0 100 140" fill="none">
          <defs>
            <linearGradient id="onyx-xtal-body" x1="22%" y1="6%" x2="78%" y2="96%">
              <stop offset="0%" stopColor="#322848" />
              <stop offset="32%" stopColor="#12101c" />
              <stop offset="68%" stopColor="#07060c" />
              <stop offset="100%" stopColor="#1c1630" />
            </linearGradient>
            <linearGradient id="onyx-xtal-left" x1="0" y1="0.2" x2="1" y2="0.8">
              <stop offset="0%" stopColor="#3a3058" stopOpacity="0.58" />
              <stop offset="100%" stopColor="#0a0810" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="onyx-xtal-right" x1="1" y1="0.15" x2="0" y2="0.9">
              <stop offset="0%" stopColor="#1a1428" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.58" />
            </linearGradient>
            <linearGradient id="onyx-xtal-edge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c4ae80" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#8a7bff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#c4ae80" stopOpacity="0.55" />
            </linearGradient>
            <radialGradient id="onyx-xtal-core" cx="40%" cy="42%" r="48%">
              <stop offset="0%" stopColor="#6a5cff" stopOpacity="0.3" />
              <stop offset="55%" stopColor="#2a2048" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="onyx-xtal-gloss" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#efe6ff" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#b8a6ff" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Silhouette — double-terminated rectangular prism (4 faces) */}
          <polygon
            points="
              50,8
              70,28
              70,112
              50,132
              30,112
              30,28
            "
            fill="url(#onyx-xtal-body)"
            stroke="url(#onyx-xtal-edge)"
            strokeWidth="1.05"
            strokeLinejoin="round"
          />

          {/* Near-left face (lit) */}
          <polygon
            points="50,8 30,28 30,112 50,132 50,70 50,28"
            fill="url(#onyx-xtal-left)"
          />
          {/* Near-right face (shadow) */}
          <polygon
            points="50,8 70,28 70,112 50,132 50,70 50,28"
            fill="url(#onyx-xtal-right)"
          />

          <polygon
            points="50,8 70,28 70,112 50,132 30,112 30,28"
            fill="url(#onyx-xtal-core)"
          />

          {/* Lapidation — four-face ridges + crown / pavilion bevels */}
          <g stroke="rgba(196,174,128,0.3)" strokeWidth="0.55" strokeLinecap="round">
            {/* Center ridge — two near faces meet */}
            <line x1="50" y1="8" x2="50" y2="132" />
            {/* Outer prism edges (far pair of faces) */}
            <line x1="30" y1="28" x2="30" y2="112" />
            <line x1="70" y1="28" x2="70" y2="112" />
            {/* Crown shoulder */}
            <line x1="30" y1="28" x2="70" y2="28" stroke="rgba(230,220,255,0.22)" />
            {/* Pavilion shoulder */}
            <line x1="30" y1="112" x2="70" y2="112" stroke="rgba(196,174,128,0.2)" />
            {/* Mid girdle belt */}
            <line x1="30" y1="70" x2="70" y2="70" stroke="rgba(180,166,255,0.2)" />
            {/* Soft internal facet breaks on each face */}
            <line x1="40" y1="34" x2="40" y2="106" stroke="rgba(180,166,255,0.12)" />
            <line x1="60" y1="34" x2="60" y2="106" stroke="rgba(180,166,255,0.1)" />
          </g>

          {/* Lit bevel on near-left crown */}
          <polyline
            points="50,10 32,28 32,48"
            fill="none"
            stroke="rgba(230,220,255,0.34)"
            strokeWidth="0.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="50,10 68,28"
            fill="none"
            stroke="rgba(196,174,128,0.2)"
            strokeWidth="0.55"
            strokeLinecap="round"
          />

          {/* Moving specular on the crown face */}
          <ellipse
            ref={glossRef}
            cx="38"
            cy="34"
            rx="8"
            ry="12"
            fill="url(#onyx-xtal-gloss)"
            opacity="0.85"
          />

          {/* Core spark at girdle */}
          <circle cx="50" cy="70" r="1.35" fill="rgba(220,210,255,0.4)" />
        </svg>
      </div>
    </div>
  );
}
