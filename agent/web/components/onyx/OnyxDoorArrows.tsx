"use client";

/**
 * Four curved onyx arrowheads around the home taijitu —
 * a quiet visual cue that the marble can be dragged to open doors.
 */

export type DoorArrowDir = "up" | "down" | "left" | "right";

/**
 * Carved chevron that hugs the circle. Local space: tip points +Y (outward
 * after parent rotate). Curves follow the rim so it reads as stone cut into
 * the ring, not a flat UI caret.
 */
function CurvedOnyxHead({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-body`} x1="18%" y1="5%" x2="82%" y2="95%">
          <stop offset="0%" stopColor="#4a2f7a" stopOpacity="0.58" />
          <stop offset="38%" stopColor="#160c2a" stopOpacity="0.78" />
          <stop offset="72%" stopColor="#2a1748" stopOpacity="0.62" />
          <stop offset="100%" stopColor="#6b4db8" stopOpacity="0.42" />
        </linearGradient>
        <linearGradient id={`${id}-facet`} x1="40%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#d8ceff" stopOpacity="0.5" />
          <stop offset="40%" stopColor="#9a8cff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#12081f" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-spec`} cx="38%" cy="28%" r="55%">
          <stop offset="0%" stopColor="#f0eaff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#8a7bff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-carve`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.55" result="b" />
          <feOffset dy="0.45" result="o" />
          <feFlood floodColor="#05030c" floodOpacity="0.65" />
          <feComposite in2="o" operator="in" result="sh" />
          <feMerge>
            <feMergeNode in="sh" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer carved body — curved wings + tip */}
      <path
        d="
          M 0 10.5
          C 1.2 8.8, 2.6 6.4, 4.8 4.2
          C 7.8 1.2, 10.6 -1.6, 11.4 -4.8
          C 11.8 -6.4, 10.2 -7.2, 8.6 -6.4
          C 5.8 -5.0, 3.2 -2.6, 1.4 -0.2
          L 0 -2.4
          L -1.4 -0.2
          C -3.2 -2.6, -5.8 -5.0, -8.6 -6.4
          C -10.2 -7.2, -11.8 -6.4, -11.4 -4.8
          C -10.6 -1.6, -7.8 1.2, -4.8 4.2
          C -2.6 6.4, -1.2 8.8, 0 10.5
          Z
        "
        fill={`url(#${id}-body)`}
        stroke="rgba(150,130,220,0.42)"
        strokeWidth="0.5"
        filter={`url(#${id}-carve)`}
      />

      {/* Inner facet — glossy cut */}
      <path
        d="
          M 0 6.8
          C 0.9 5.4, 2.0 3.6, 3.4 2.0
          C 5.2 0.0, 6.8 -1.8, 7.2 -3.4
          C 7.4 -4.2, 6.6 -4.6, 5.8 -4.1
          C 4.0 -3.2, 2.4 -1.6, 1.1 0.2
          L 0 -1.2
          L -1.1 0.2
          C -2.4 -1.6, -4.0 -3.2, -5.8 -4.1
          C -6.6 -4.6, -7.4 -4.2, -7.2 -3.4
          C -6.8 -1.8, -5.2 0.0, -3.4 2.0
          C -2.0 3.6, -0.9 5.4, 0 6.8
          Z
        "
        fill={`url(#${id}-facet)`}
        stroke="rgba(210,198,255,0.28)"
        strokeWidth="0.3"
      />

      {/* Specular window on the carved face */}
      <ellipse
        cx="-2.2"
        cy="1.4"
        rx="2.1"
        ry="3.2"
        fill={`url(#${id}-spec)`}
        transform="rotate(-22 -2.2 1.4)"
        opacity="0.85"
      />
    </g>
  );
}

export function OnyxDoorArrows({
  active = null,
}: {
  active?: DoorArrowDir | "center" | null;
}) {
  const lit: DoorArrowDir | null =
    active === "up" || active === "down" || active === "left" || active === "right"
      ? active
      : null;

  const dirs: { dir: DoorArrowDir; rotate: number }[] = [
    { dir: "up", rotate: 180 },
    { dir: "right", rotate: -90 },
    { dir: "down", rotate: 0 },
    { dir: "left", rotate: 90 },
  ];

  return (
    <svg
      className="onyx-yy-arrows"
      viewBox="0 0 100 100"
      aria-hidden
      focusable="false"
    >
      {dirs.map(({ dir, rotate }) => (
        <g
          key={dir}
          className={`onyx-yy-arrow onyx-yy-arrow-${dir}${lit === dir ? " on" : ""}`}
          transform={`rotate(${rotate} 50 50)`}
        >
          {/* Just outside the marble rim */}
          <g transform="translate(50 5.4)">
            <CurvedOnyxHead id={`yy-arr-${dir}`} />
          </g>
        </g>
      ))}
    </svg>
  );
}
