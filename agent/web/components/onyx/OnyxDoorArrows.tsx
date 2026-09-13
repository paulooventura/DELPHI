"use client";

/**
 * Four silver bows around the home compass — drawn (loaded), release on click.
 * Tip points outward; arrow flies that way, then the door opens.
 */

export type DoorArrowDir = "up" | "down" | "left" | "right";

function SilverBow({ id, shooting }: { id: string; shooting: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className="onyx-bow-svg" aria-hidden focusable="false">
      <defs>
        <linearGradient id={`${id}-limb`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f4f6fa" />
          <stop offset="28%" stopColor="#c5ccd6" />
          <stop offset="55%" stopColor="#8e97a6" />
          <stop offset="78%" stopColor="#e8ecf2" />
          <stop offset="100%" stopColor="#6a7382" />
        </linearGradient>
        <linearGradient id={`${id}-arrow`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#9aa3b2" />
          <stop offset="45%" stopColor="#eef1f6" />
          <stop offset="100%" stopColor="#7a8494" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Bow limbs — tip points up (+Y outward after parent rotate) */}
      <path
        className="onyx-bow-limb"
        d="M 14 50 C 10 36, 12 18, 32 10 C 52 18, 54 36, 50 50"
        fill="none"
        stroke={`url(#${id}-limb)`}
        strokeWidth="3.2"
        strokeLinecap="round"
        filter={`url(#${id}-glow)`}
      />
      <path
        className="onyx-bow-limb-edge"
        d="M 16 48 C 13 36, 15 20, 32 13 C 49 20, 51 36, 48 48"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.7"
        strokeLinecap="round"
      />

      {/* Drawn string (taut when loaded; slack when shooting) */}
      <path
        className={`onyx-bow-string${shooting ? " slack" : ""}`}
        d={shooting ? "M 16 48 L 32 42 L 48 48" : "M 16 48 L 32 28 L 48 48"}
        fill="none"
        stroke="#d8dee8"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Arrow — nocked on string, tip outward */}
      <g className={`onyx-bow-arrow${shooting ? " loosed" : ""}`}>
        <line
          x1="32"
          y1="46"
          x2="32"
          y2="14"
          stroke={`url(#${id}-arrow)`}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M 32 8 L 36.2 16.5 L 32 14.6 L 27.8 16.5 Z"
          fill="#eef2f7"
          stroke="#9aa3b2"
          strokeWidth="0.4"
        />
        <path d="M 29.2 44 L 32 40.5 L 34.8 44 Z" fill="#b8c0cc" opacity="0.9" />
      </g>
    </svg>
  );
}

const BOW_META: {
  dir: DoorArrowDir;
  rotate: number;
  label: string;
}[] = [
  { dir: "up", rotate: 0, label: "Aether — sky map" },
  { dir: "right", rotate: 90, label: "Heliodrome — orrery" },
  { dir: "down", rotate: 180, label: "Agon — Show Thyself" },
  { dir: "left", rotate: -90, label: "Mouseion — studies" },
];

export function OnyxDoorArrows({
  active = null,
  shooting = null,
  onShoot,
}: {
  active?: DoorArrowDir | "center" | null;
  shooting?: DoorArrowDir | null;
  onShoot?: (dir: DoorArrowDir) => void;
}) {
  const lit: DoorArrowDir | null =
    active === "up" || active === "down" || active === "left" || active === "right"
      ? active
      : null;

  return (
    <div className="onyx-yy-bows" aria-label="Chamber bows">
      {BOW_META.map(({ dir, rotate, label }) => (
        <button
          key={dir}
          type="button"
          className={`onyx-yy-bow onyx-yy-bow-${dir}${lit === dir ? " on" : ""}${shooting === dir ? " shooting" : ""}`}
          aria-label={label}
          disabled={Boolean(shooting)}
          style={{ ["--bow-rot" as string]: `${rotate}deg` }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            if (shooting) return;
            onShoot?.(dir);
          }}
        >
          <span className="onyx-yy-bow-face" style={{ transform: `rotate(${rotate}deg)` }}>
            <SilverBow id={`yy-bow-${dir}`} shooting={shooting === dir} />
          </span>
        </button>
      ))}
    </div>
  );
}
