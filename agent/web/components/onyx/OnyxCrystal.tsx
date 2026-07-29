"use client";

/**
 * Background octagonal onyx crystal — gimbal-linked.
 * beta / gamma from DeviceOrientation drive a soft 3D tilt;
 * desktop falls back to pointer parallax.
 */

import { useEffect, useRef } from "react";
import { watchDeviceOrientation } from "../../lib/localSignals";

type Pose = { rx: number; ry: number; tx: number; ty: number; hx: number; hy: number };

const IDLE: Pose = { rx: 8, ry: -6, tx: 0, ty: 0, hx: 42, hy: 36 };

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
        rx: clamp(-db * 0.55 + 6, -18, 22),
        ry: clamp(dg * 0.7, -24, 24),
        tx: dg * 0.55,
        ty: -db * 0.35,
        hx: clamp(50 + dg * 0.9, 28, 72),
        hy: clamp(42 - db * 0.7, 24, 62),
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
        <svg className="onyx-crystal-svg" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="onyx-xtal-body" x1="18%" y1="8%" x2="86%" y2="94%">
              <stop offset="0%" stopColor="#2a2438" />
              <stop offset="38%" stopColor="#0e0c14" />
              <stop offset="72%" stopColor="#06050a" />
              <stop offset="100%" stopColor="#1a1528" />
            </linearGradient>
            <linearGradient id="onyx-xtal-edge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c4ae80" stopOpacity="0.75" />
              <stop offset="45%" stopColor="#8a7bff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#c4ae80" stopOpacity="0.55" />
            </linearGradient>
            <radialGradient id="onyx-xtal-core" cx="42%" cy="36%" r="55%">
              <stop offset="0%" stopColor="#6a5cff" stopOpacity="0.28" />
              <stop offset="55%" stopColor="#2a2048" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="onyx-xtal-gloss" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#efe6ff" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#b8a6ff" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <filter id="onyx-xtal-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
          </defs>

          {/* Outer octagon */}
          <polygon
            points="30,6 70,6 94,30 94,70 70,94 30,94 6,70 6,30"
            fill="url(#onyx-xtal-body)"
            stroke="url(#onyx-xtal-edge)"
            strokeWidth="1.1"
          />
          <polygon
            points="30,6 70,6 94,30 94,70 70,94 30,94 6,70 6,30"
            fill="url(#onyx-xtal-core)"
          />

          {/* Inner facet cage */}
          <polygon
            points="36,18 64,18 82,36 82,64 64,82 36,82 18,64 18,36"
            fill="rgba(120,108,200,0.04)"
            stroke="rgba(196,174,128,0.28)"
            strokeWidth="0.6"
          />

          {/* Crystal cuts */}
          <g stroke="rgba(180,166,255,0.18)" strokeWidth="0.45" filter="url(#onyx-xtal-soft)">
            <line x1="50" y1="6" x2="50" y2="94" />
            <line x1="6" y1="50" x2="94" y2="50" />
            <line x1="30" y1="6" x2="70" y2="94" />
            <line x1="70" y1="6" x2="30" y2="94" />
            <line x1="6" y1="30" x2="94" y2="70" />
            <line x1="94" y1="30" x2="6" y2="70" />
          </g>

          {/* Bevel highlights */}
          <polyline
            points="32,8 68,8 90,32"
            fill="none"
            stroke="rgba(230,220,255,0.28)"
            strokeWidth="0.7"
            strokeLinecap="round"
          />
          <polyline
            points="10,68 10,34 32,10"
            fill="none"
            stroke="rgba(196,174,128,0.22)"
            strokeWidth="0.55"
            strokeLinecap="round"
          />

          {/* Moving specular */}
          <ellipse
            ref={glossRef}
            cx="42"
            cy="36"
            rx="14"
            ry="9"
            fill="url(#onyx-xtal-gloss)"
            opacity="0.9"
          />

          {/* Tiny core spark */}
          <circle cx="50" cy="50" r="1.6" fill="rgba(220,210,255,0.45)" />
        </svg>
      </div>
    </div>
  );
}
