"use client";

import { useEffect, useId, useRef } from "react";
import { watchDeviceOrientation } from "../../lib/localSignals";

/** Polished taijitu marble — key light follows pointer / gimbal, not a flat badge. */

type Light = { lx: number; ly: number };

const IDLE: Light = { lx: 34, ly: 28 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function OnyxYinYang({
  aiming = false,
  locked = false,
  spinning = false,
  sensorsUnlocked = false,
}: {
  aiming?: boolean;
  locked?: boolean;
  spinning?: boolean;
  sensorsUnlocked?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const shadeRef = useRef<SVGRadialGradientElement>(null);
  const specRef = useRef<SVGRadialGradientElement>(null);
  const specCircleRef = useRef<SVGCircleElement>(null);
  const windowRef = useRef<SVGRectElement>(null);
  const target = useRef<Light>({ ...IDLE });
  const current = useRef<Light>({ ...IDLE });
  const baseline = useRef<{ beta: number; gamma: number } | null>(null);
  const samples = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const host =
      (svg.closest(".onyx-device") as HTMLElement | null) ?? svg.parentElement;
    if (!host) return;

    let gimbalLive = false;
    let lastGimbal = 0;

    const paint = (l: Light) => {
      shadeRef.current?.setAttribute("cx", `${l.lx.toFixed(1)}%`);
      shadeRef.current?.setAttribute("cy", `${l.ly.toFixed(1)}%`);
      specRef.current?.setAttribute("cx", `${l.lx.toFixed(1)}%`);
      specRef.current?.setAttribute("cy", `${l.ly.toFixed(1)}%`);
      const cx = 18 + (l.lx / 100) * 64;
      const cy = 14 + (l.ly / 100) * 52;
      specCircleRef.current?.setAttribute("cx", cx.toFixed(1));
      specCircleRef.current?.setAttribute("cy", cy.toFixed(1));
      windowRef.current?.setAttribute("x", (l.lx * 0.42 + 8).toFixed(1));
      windowRef.current?.setAttribute("y", (l.ly * 0.28 + 36).toFixed(1));
      svg.style.setProperty("--yy-lx", `${l.lx.toFixed(1)}%`);
      svg.style.setProperty("--yy-ly", `${l.ly.toFixed(1)}%`);
    };

    const tick = () => {
      const c = current.current;
      const t = target.current;
      c.lx = lerp(c.lx, t.lx, 0.14);
      c.ly = lerp(c.ly, t.ly, 0.14);
      paint(c);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    const applyDelta = (db: number, dg: number) => {
      target.current = {
        lx: clamp(IDLE.lx + dg * 1.15, 14, 78),
        ly: clamp(IDLE.ly - db * 0.95, 12, 68),
      };
    };

    const stopOrient = sensorsUnlocked
      ? watchDeviceOrientation(reading => {
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
        })
      : () => {};

    const onPointer = (ev: Event) => {
      const e = ev as PointerEvent;
      if (gimbalLive && performance.now() - lastGimbal < 900) return;
      const r = host.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      applyDelta(ny * 18, nx * 22);
    };
    host.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      cancelAnimationFrame(raf.current);
      stopOrient();
      host.removeEventListener("pointermove", onPointer);
    };
  }, [sensorsUnlocked]);

  return (
    <svg
      ref={svgRef}
      className={`onyx-yy-svg${aiming ? " aiming" : ""}${locked ? " locked" : ""}${spinning ? " spinning" : ""}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Yin yang — you"
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
        <radialGradient id={`${uid}-yang`} cx="40%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#f3f1f8" />
          <stop offset="100%" stopColor="#d8d4e6" />
        </radialGradient>
        <radialGradient id={`${uid}-yin`} cx="62%" cy="70%" r="84%">
          <stop offset="0%" stopColor="#1a1630" />
          <stop offset="40%" stopColor="#07060c" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <radialGradient id={`${uid}-shade`} ref={shadeRef} cx="34%" cy="28%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="22%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="58%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.62)" />
        </radialGradient>
        <radialGradient id={`${uid}-spec`} ref={specRef} cx="34%" cy="28%" r="18%">
          <stop offset="0%" stopColor="rgba(255,255,255,1)" />
          <stop offset="35%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.65" />
        </filter>
        <filter id={`${uid}-win`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>

      <circle cx="50" cy="52.5" r="47" fill="rgba(0,0,0,0.38)" />

      <g clipPath={`url(#${uid}-clip)`}>
        <rect width="100" height="100" fill={`url(#${uid}-yin)`} />
        <path
          d="M50,2 a24,24 0 0,1 0,48 a24,24 0 0,0 0,48 a48,48 0 0,1 0,-96 z"
          fill={`url(#${uid}-yang)`}
        />
        <circle cx="50" cy="26" r="8" fill={`url(#${uid}-yin)`} />
        <circle cx="50" cy="74" r="8" fill={`url(#${uid}-yang)`} />

        <rect
          ref={windowRef}
          x="22"
          y="44"
          width="13"
          height="18"
          rx="0.4"
          fill="rgba(255,255,255,0.22)"
          filter={`url(#${uid}-win)`}
          transform="rotate(-16 28 52)"
        />
        <rect
          x="29"
          y="46"
          width="6"
          height="13"
          rx="0.3"
          fill="rgba(255,255,255,0.1)"
          transform="rotate(-16 32 52)"
        />

        <circle cx="50" cy="50" r="48" fill={`url(#${uid}-shade)`} />
        <circle
          ref={specCircleRef}
          cx="34"
          cy="26"
          r="16"
          fill={`url(#${uid}-spec)`}
          filter={`url(#${uid}-soft)`}
        />
      </g>

      <circle
        cx="50"
        cy="50"
        r="48.15"
        fill="none"
        stroke="rgba(236,232,255,0.42)"
        strokeWidth="0.55"
      />
      <circle
        cx="50"
        cy="50"
        r="48.7"
        fill="none"
        stroke="rgba(12,8,24,0.55)"
        strokeWidth="0.85"
      />
    </svg>
  );
}
