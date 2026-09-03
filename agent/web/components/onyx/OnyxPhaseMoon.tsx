"use client";

import { useId } from "react";
import { lunarPhaseFromFraction } from "../../lib/cosmicAssets";

/**
 * Stylized phase moon for the home header.
 * `phaseFraction` is synodic 0 = new … 0.5 = full … 1 = new.
 */
export function OnyxPhaseMoon({
  phaseFraction,
  onOpenSky,
}: {
  phaseFraction: number;
  onOpenSky?: () => void;
}) {
  const uid = useId().replace(/:/g, "");
  const f = ((phaseFraction % 1) + 1) % 1;
  const phase = lunarPhaseFromFraction(f);
  const illum = (1 - Math.cos(2 * Math.PI * f)) / 2;
  const waxing = f <= 0.5;
  const gibbous = illum >= 0.5;
  const r = 14;
  const cx = 20;
  const cy = 20;
  const rx = Math.abs(2 * illum - 1) * r;
  const clip = `${uid}-disk`;
  const body = `${uid}-body`;
  const halo = `${uid}-halo`;
  const lit = `url(#${body})`;
  const unlit = "rgba(8, 7, 16, 0.96)";

  const moon = (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
      <defs>
        <radialGradient id={body} cx="38%" cy="34%" r="62%">
          <stop offset="0%" stopColor="#f4f0ff" />
          <stop offset="45%" stopColor="#d8d2f0" />
          <stop offset="100%" stopColor="#9a92b8" />
        </radialGradient>
        <radialGradient id={halo} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(220,214,255,0.45)" />
          <stop offset="55%" stopColor="rgba(140,124,255,0.12)" />
          <stop offset="100%" stopColor="rgba(140,124,255,0)" />
        </radialGradient>
        <clipPath id={clip}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r="19" fill={`url(#${halo})`} />
      <g clipPath={`url(#${clip})`}>
        <circle cx={cx} cy={cy} r={r} fill={unlit} />
        <rect
          x={waxing ? cx : cx - r}
          y={cy - r}
          width={r}
          height={r * 2}
          fill={lit}
        />
        <ellipse cx={cx} cy={cy} rx={rx} ry={r} fill={gibbous ? lit : unlit} />
      </g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.5"
      />
    </svg>
  );

  if (!onOpenSky) {
    return (
      <div className="onyx-phase-moon" aria-label={phase.name} title={phase.name}>
        {moon}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="onyx-phase-moon"
      aria-label={`${phase.name}. Open sky map`}
      title={`${phase.name} — sky map`}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => {
        e.stopPropagation();
        onOpenSky();
      }}
    >
      {moon}
    </button>
  );
}
