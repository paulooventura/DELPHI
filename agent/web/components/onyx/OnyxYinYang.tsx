"use client";

import { useEffect, useId, useRef } from "react";
import { pulseHaptic } from "../../lib/haptics";
import { watchDeviceOrientation } from "../../lib/localSignals";

/** Polished taijitu marble — a ball, not a flat badge. Light + tilt follow pointer / gimbal. */

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
  copyFlash = false,
  shareFlash = false,
}: {
  aiming?: boolean;
  locked?: boolean;
  spinning?: boolean;
  sensorsUnlocked?: boolean;
  copyFlash?: boolean;
  shareFlash?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const shadeRef = useRef<SVGRadialGradientElement>(null);
  const specRef = useRef<SVGRadialGradientElement>(null);
  const specCircleRef = useRef<SVGCircleElement>(null);
  const windowRef = useRef<SVGRectElement>(null);
  const rimRef = useRef<SVGCircleElement>(null);
  const target = useRef<Light>({ ...IDLE });
  const current = useRef<Light>({ ...IDLE });
  const baseline = useRef<{ beta: number; gamma: number } | null>(null);
  const samples = useRef(0);
  const raf = useRef(0);
  const lastHaptic = useRef(0);
  const idleT0 = useRef(performance.now());
  const lastInput = useRef(performance.now());
  const spinningRef = useRef(spinning);
  spinningRef.current = spinning;

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

      // Ball tilt — stronger than the light alone so it reads as volume.
      const rx = clamp((50 - l.ly) * 0.28, -14, 14);
      const ry = clamp((l.lx - 50) * 0.32, -16, 16);
      svg.style.setProperty("--yy-lx", `${l.lx.toFixed(1)}%`);
      svg.style.setProperty("--yy-ly", `${l.ly.toFixed(1)}%`);
      svg.style.setProperty("--yy-rx", `${rx.toFixed(2)}deg`);
      svg.style.setProperty("--yy-ry", `${ry.toFixed(2)}deg`);
      // Soft contact shadow under the sphere shifts opposite the light.
      const shX = ((50 - l.lx) / 50) * 6;
      const shY = 2 + ((l.ly - 30) / 50) * 4;
      svg.style.setProperty("--yy-sh-x", `${shX.toFixed(2)}px`);
      svg.style.setProperty("--yy-sh-y", `${shY.toFixed(2)}px`);
      rimRef.current?.setAttribute(
        "stroke",
        `rgba(${180 + (l.lx / 100) * 40}, ${170 + (l.ly / 100) * 30}, 255, 0.42)`,
      );
    };

    const tick = () => {
      const now = performance.now();
      // Idle breathe when nothing is steering the ball.
      if (now - lastInput.current > 1400 && !spinningRef.current) {
        const t = (now - idleT0.current) / 1000;
        target.current = {
          lx: IDLE.lx + Math.sin(t * 0.55) * 7 + Math.sin(t * 0.19) * 3,
          ly: IDLE.ly + Math.cos(t * 0.48) * 5 + Math.sin(t * 0.31) * 2.5,
        };
      }
      const c = current.current;
      const t = target.current;
      c.lx = lerp(c.lx, t.lx, 0.12);
      c.ly = lerp(c.ly, t.ly, 0.12);
      paint(c);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    const applyDelta = (db: number, dg: number) => {
      lastInput.current = performance.now();
      target.current = {
        lx: clamp(IDLE.lx + dg * 1.35, 12, 82),
        ly: clamp(IDLE.ly - db * 1.1, 10, 72),
      };
    };

    const maybeHaptic = (db: number, dg: number) => {
      const mag = Math.abs(db) + Math.abs(dg);
      if (mag < 9) return;
      const now = performance.now();
      if (now - lastHaptic.current < 2200) return;
      lastHaptic.current = now;
      void pulseHaptic("tick");
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
          const db = clamp(beta - baseline.current.beta, -32, 32);
          const dg = clamp(gamma - baseline.current.gamma, -32, 32);
          if (Math.abs(db) + Math.abs(dg) > 0.35) {
            gimbalLive = true;
            lastGimbal = performance.now();
          }
          applyDelta(db, dg);
          maybeHaptic(db, dg);
        })
      : () => {};

    const onPointer = (ev: Event) => {
      const e = ev as PointerEvent;
      if (gimbalLive && performance.now() - lastGimbal < 900) return;
      const r = host.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      applyDelta(ny * 22, nx * 26);
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
          <stop offset="55%" stopColor="#f3f1f8" />
          <stop offset="100%" stopColor="#c9c4d8" />
        </radialGradient>
        <radialGradient id={`${uid}-yin`} cx="62%" cy="70%" r="84%">
          <stop offset="0%" stopColor="#2a2448" />
          <stop offset="35%" stopColor="#0c0a14" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <radialGradient id={`${uid}-shade`} ref={shadeRef} cx="34%" cy="28%" r="78%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
          <stop offset="14%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="42%" stopColor="rgba(0,0,0,0)" />
          <stop offset="78%" stopColor="rgba(0,0,0,0.45)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.82)" />
        </radialGradient>
        <radialGradient id={`${uid}-spec`} ref={specRef} cx="34%" cy="28%" r="18%">
          <stop offset="0%" stopColor="rgba(255,255,255,1)" />
          <stop offset="30%" stopColor="rgba(255,255,255,0.72)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <radialGradient id={`${uid}-ao`} cx="50%" cy="62%" r="70%">
          <stop offset="55%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.38)" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.65" />
        </filter>
        <filter id={`${uid}-win`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>

      {/* Grounded contact shadow — shifts with tilt via CSS vars on the host gem */}
      <ellipse
        className="onyx-yy-contact-shadow"
        cx="50"
        cy="92"
        rx="34"
        ry="5.5"
        fill="rgba(0,0,0,0.45)"
      />

      <circle cx="50" cy="51.8" r="47.2" fill="rgba(0,0,0,0.28)" />

      <g clipPath={`url(#${uid}-clip)`}>
        <rect width="100" height="100" fill={`url(#${uid}-yin)`} />
        <path
          d="M50,2 a24,24 0 0,1 0,48 a24,24 0 0,0 0,48 a48,48 0 0,1 0,-96 z"
          fill={`url(#${uid}-yang)`}
        />

        <rect
          ref={windowRef}
          x="20"
          y="40"
          width="16"
          height="22"
          rx="0.35"
          fill="rgba(255,255,255,0.34)"
          filter={`url(#${uid}-win)`}
          transform="rotate(-18 28 51)"
        />
        <rect
          x="27"
          y="43"
          width="7"
          height="15"
          rx="0.25"
          fill="rgba(255,255,255,0.16)"
          transform="rotate(-18 30.5 50.5)"
        />

        <circle cx="50" cy="50" r="48" fill={`url(#${uid}-shade)`} />
        <circle cx="50" cy="50" r="48" fill={`url(#${uid}-ao)`} />
        <circle
          ref={specCircleRef}
          cx="34"
          cy="26"
          r="17"
          fill={`url(#${uid}-spec)`}
          filter={`url(#${uid}-soft)`}
        />
        <circle cx="50" cy="26" r="8" fill={shareFlash ? "#2fbf71" : `url(#${uid}-yin)`} />
        <circle cx="50" cy="74" r="8" fill={copyFlash ? "#2fbf71" : `url(#${uid}-yang)`} />
        {shareFlash && (
          <g transform="translate(50 26)" fill="none" stroke="#f7fff9" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="0" cy="-2.2" r="1.15" fill="#f7fff9" stroke="none" />
            <circle cx="-2.4" cy="2.1" r="1.15" fill="#f7fff9" stroke="none" />
            <circle cx="2.4" cy="2.1" r="1.15" fill="#f7fff9" stroke="none" />
            <path d="M-1.4 1.4 L-0.5 -1.1 M1.4 1.4 L0.5 -1.1 M-1.3 2.1 H1.3" />
          </g>
        )}
        {copyFlash && (
          <g transform="translate(50 74)" fill="none" stroke="#0b1a12" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="-2.6" y="-1.4" width="4.4" height="4.4" rx="0.6" />
            <rect x="-1.4" y="-2.8" width="4.4" height="4.4" rx="0.6" />
          </g>
        )}
      </g>

      <circle
        ref={rimRef}
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
