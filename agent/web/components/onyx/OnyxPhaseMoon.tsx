"use client";

import { lunarPhaseFromFraction } from "../../lib/cosmicAssets";

/**
 * Stylized phase moon for the home header — phase is shown, not narrated.
 * Synodic fraction 0 = new … 0.5 = full … 1 = new.
 */
export function OnyxPhaseMoon({ phaseFraction }: { phaseFraction: number }) {
  const f = ((phaseFraction % 1) + 1) % 1;
  const phase = lunarPhaseFromFraction(f);
  const illum = (1 - Math.cos(2 * Math.PI * f)) / 2;
  const r = 14;
  // Waxing: lit on the right (shadow disk to the left). Waning: opposite.
  const sign = f <= 0.5 ? -1 : 1;
  const shadowOff = sign * ((1 - illum) * r * 1.55 - r * 0.15);

  return (
    <div
      className="onyx-phase-moon"
      aria-label={phase.name}
      title={phase.name}
    >
      <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
        <defs>
          <radialGradient id="onyx-moon-body" cx="38%" cy="34%" r="62%">
            <stop offset="0%" stopColor="#f4f0ff" />
            <stop offset="45%" stopColor="#d8d2f0" />
            <stop offset="100%" stopColor="#9a92b8" />
          </radialGradient>
          <radialGradient id="onyx-moon-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(220,214,255,0.45)" />
            <stop offset="55%" stopColor="rgba(140,124,255,0.12)" />
            <stop offset="100%" stopColor="rgba(140,124,255,0)" />
          </radialGradient>
          <clipPath id="onyx-moon-disk">
            <circle cx="20" cy="20" r={r} />
          </clipPath>
        </defs>
        <circle cx="20" cy="20" r="19" fill="url(#onyx-moon-halo)" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="url(#onyx-moon-body)"
          stroke="rgba(230,220,255,0.35)"
          strokeWidth="0.6"
        />
        <g clipPath="url(#onyx-moon-disk)">
          <circle cx={20 + shadowOff} cy="20" r={r * 0.98} fill="rgba(6, 5, 14, 0.92)" />
        </g>
        {/* Soft limb highlight on the lit edge */}
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
}
