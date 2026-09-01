"use client";

/** Glassy taijitu — portal compass gem, purple crystal, not a flat badge. */

export function OnyxYinYang({
  aiming = false,
  locked = false,
}: {
  aiming?: boolean;
  locked?: boolean;
}) {
  return (
    <svg
      className={`onyx-yy-svg${aiming ? " aiming" : ""}${locked ? " locked" : ""}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Yin yang — you"
    >
      <defs>
        <clipPath id="onyx-yy-clip">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
        <radialGradient id="onyx-yy-glass-yang" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="rgba(248,246,255,0.72)" />
          <stop offset="42%" stopColor="rgba(210,204,255,0.38)" />
          <stop offset="100%" stopColor="rgba(140,124,255,0.18)" />
        </radialGradient>
        <radialGradient id="onyx-yy-glass-yin" cx="62%" cy="68%" r="78%">
          <stop offset="0%" stopColor="rgba(42,36,78,0.55)" />
          <stop offset="55%" stopColor="rgba(12,10,24,0.42)" />
          <stop offset="100%" stopColor="rgba(6,5,14,0.28)" />
        </radialGradient>
        <radialGradient id="onyx-yy-core" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="rgba(196,186,255,0.95)" />
          <stop offset="100%" stopColor="rgba(108,92,255,0.55)" />
        </radialGradient>
        <linearGradient id="onyx-yy-rim" x1="20%" y1="8%" x2="86%" y2="94%">
          <stop offset="0%" stopColor="rgba(230,226,255,0.85)" />
          <stop offset="45%" stopColor="rgba(169,156,255,0.55)" />
          <stop offset="100%" stopColor="rgba(80,70,160,0.35)" />
        </linearGradient>
        <filter id="onyx-yy-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>

      <circle cx="50" cy="50" r="49" fill="rgba(20,16,40,0.22)" />
      <circle cx="50" cy="50" r="48.2" fill="none" stroke="url(#onyx-yy-rim)" strokeWidth="1.15" />

      <g clipPath="url(#onyx-yy-clip)">
        <rect width="100" height="100" fill="url(#onyx-yy-glass-yin)" />
        <path
          d="M50,2 a24,24 0 0,1 0,48 a24,24 0 0,0 0,48 a48,48 0 0,1 0,-96 z"
          fill="url(#onyx-yy-glass-yang)"
        />
        <path
          d="M18,18 L36,8 L28,32 Z"
          fill="rgba(255,255,255,0.28)"
          filter="url(#onyx-yy-soft)"
        />
        <path
          d="M62,58 L86,70 L70,88 Z"
          fill="rgba(169,156,255,0.16)"
        />
      </g>

      <circle cx="50" cy="26" r="7.2" fill="url(#onyx-yy-glass-yin)" stroke="rgba(210,204,255,0.35)" strokeWidth="0.4" />
      <circle cx="50" cy="74" r="7.2" fill="url(#onyx-yy-glass-yang)" stroke="rgba(20,16,40,0.28)" strokeWidth="0.4" />
      <circle cx="50" cy="26" r="2.1" fill="url(#onyx-yy-core)" />
      <circle cx="50" cy="74" r="2.1" fill="rgba(12,10,22,0.55)" />
    </svg>
  );
}
