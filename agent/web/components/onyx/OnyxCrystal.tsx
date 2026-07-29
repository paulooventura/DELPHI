"use client";

/**
 * Background octagonal onyx crystal — gimbal-linked.
 * beta / gamma from DeviceOrientation drive a soft 3D tilt;
 * desktop falls back to pointer parallax.
 */

import { useEffect, useRef } from "react";
import { watchDeviceOrientation } from "../../lib/localSignals";

type Pose = { rx: number; ry: number; tx: number; ty: number; hx: number; hy: number };

/** Resting pose — slight yaw so the profile reads as volume, not a flat card. */
const IDLE: Pose = { rx: 4, ry: -12, tx: 0, ty: 0, hx: 38, hy: 32 };

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
        hx: clamp(38 + dg * 0.7, 24, 58),
        hy: clamp(32 - db * 0.55, 18, 52),
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
          Profile / elevation of an octagonal crystal — tip, crown, girdle, pavilion.
          Not a top-down flat octagon (those radial spokes read as looking down the axis).
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
              <stop offset="0%" stopColor="#3a3058" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#0a0810" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="onyx-xtal-right" x1="1" y1="0.15" x2="0" y2="0.9">
              <stop offset="0%" stopColor="#1a1428" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="onyx-xtal-edge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c4ae80" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#8a7bff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#c4ae80" stopOpacity="0.55" />
            </linearGradient>
            <radialGradient id="onyx-xtal-core" cx="40%" cy="38%" r="50%">
              <stop offset="0%" stopColor="#6a5cff" stopOpacity="0.32" />
              <stop offset="55%" stopColor="#2a2048" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="onyx-xtal-gloss" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#efe6ff" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#b8a6ff" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Full silhouette — double-terminated octagonal crystal in profile */}
          <polygon
            points="
              50,6
              62,22
              74,34
              78,52
              74,70
              62,88
              50,134
              38,88
              26,70
              22,52
              26,34
              38,22
            "
            fill="url(#onyx-xtal-body)"
            stroke="url(#onyx-xtal-edge)"
            strokeWidth="1.05"
            strokeLinejoin="round"
          />

          {/* Left face (lit) */}
          <polygon
            points="50,6 38,22 26,34 22,52 26,70 38,88 50,134 50,70 50,52 50,34 50,22"
            fill="url(#onyx-xtal-left)"
          />
          {/* Right face (shadow) */}
          <polygon
            points="50,6 62,22 74,34 78,52 74,70 62,88 50,134 50,70 50,52 50,34 50,22"
            fill="url(#onyx-xtal-right)"
          />

          <polygon
            points="
              50,6
              62,22
              74,34
              78,52
              74,70
              62,88
              50,134
              38,88
              26,70
              22,52
              26,34
              38,22
            "
            fill="url(#onyx-xtal-core)"
          />

          {/* Crown / girdle / pavilion facet lines — vertical structure of an octagon in elevation */}
          <g stroke="rgba(196,174,128,0.28)" strokeWidth="0.55" strokeLinecap="round">
            {/* Center spine */}
            <line x1="50" y1="6" x2="50" y2="134" />
            {/* Near-vertical side ridges (octagon flats seen in profile) */}
            <line x1="38" y1="22" x2="38" y2="88" />
            <line x1="62" y1="22" x2="62" y2="88" />
            <line x1="30" y1="38" x2="30" y2="72" opacity="0.7" />
            <line x1="70" y1="38" x2="70" y2="72" opacity="0.7" />
            {/* Girdle belt */}
            <line x1="22" y1="52" x2="78" y2="52" stroke="rgba(180,166,255,0.22)" />
            {/* Crown breaks */}
            <line x1="38" y1="22" x2="62" y2="22" stroke="rgba(230,220,255,0.2)" />
            <line x1="26" y1="34" x2="74" y2="34" stroke="rgba(180,166,255,0.14)" />
            {/* Pavilion breaks */}
            <line x1="26" y1="70" x2="74" y2="70" stroke="rgba(180,166,255,0.14)" />
            <line x1="38" y1="88" x2="62" y2="88" stroke="rgba(196,174,128,0.18)" />
          </g>

          {/* Lit bevel on the near-left crown */}
          <polyline
            points="50,8 39,22 28,34 24,48"
            fill="none"
            stroke="rgba(230,220,255,0.32)"
            strokeWidth="0.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="50,8 61,22 72,34"
            fill="none"
            stroke="rgba(196,174,128,0.18)"
            strokeWidth="0.55"
            strokeLinecap="round"
          />

          {/* Moving specular on the crown face */}
          <ellipse
            ref={glossRef}
            cx="38"
            cy="32"
            rx="9"
            ry="11"
            fill="url(#onyx-xtal-gloss)"
            opacity="0.85"
          />

          {/* Core spark near girdle */}
          <circle cx="50" cy="52" r="1.4" fill="rgba(220,210,255,0.4)" />
        </svg>
      </div>
    </div>
  );
}
