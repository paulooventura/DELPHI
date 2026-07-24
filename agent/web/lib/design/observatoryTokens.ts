/**
 * DELPHI — Onyx material tokens (TypeScript mirror of app/onyx-tokens.css).
 *
 * One stone, one light. Polished black glass with a single cold violet living
 * inside it. Light ENTERS at the top edge and pools to black at the bottom.
 * Nothing emits; the accent is caught, never broadcast.
 *
 * CSS owns the surface gradients; this module is for canvas / SVG / inline styles.
 */

export const OBS = {
  space: {
    outer: "#030304", // --onyx-void
    core: "#070709", // --onyx-base
    raised: "#0c0c11", // --onyx-raised
    lit: "#15141d", // --onyx-lit
  },
  light: {
    core: "#a99cff",
    accent: "#8a7bff",
    deep: "#6c5cff",
    far: "#3a2f8f",
  },
  edge: {
    bright: "rgba(140, 124, 255, 0.40)",
    default: "rgba(140, 124, 255, 0.20)",
    faint: "rgba(140, 124, 255, 0.14)",
  },
  ink: {
    bright: "#eeecfb",
    body: "#d3d0e2",
    soft: "#8f8ca3",
    quiet: "#605d72",
    faint: "#4a4756",
  },
  /** @deprecated Prefer OBS.light — kept so older call sites still compile. */
  vector: {
    structural: "rgba(140, 124, 255, 0.20)",
    structuralStrong: "rgba(140, 124, 255, 0.40)",
    strokeMin: 0.5,
    strokeMax: 1.25,
  },
  day: {
    ink: "#d3d0e2",
    accent: "#8a7bff",
    glow: "rgba(140, 124, 255, 0.28)",
  },
  night: {
    amber: "#6c5cff",
    gold: "#a99cff",
    glow: "rgba(169, 156, 255, 0.22)",
  },
  celestial: {
    targetLock: "#a99cff",
    targetGlow: "rgba(169, 156, 255, 0.4)",
    crosshair: "rgba(140, 124, 255, 0.75)",
    horizon: "rgba(140, 124, 255, 0.22)",
    ecliptic: "rgba(140, 124, 255, 0.35)",
    meridian: "rgba(140, 124, 255, 0.16)",
    starAbove: "#eeecfb",
    starBelow: "rgba(108, 92, 255, 0.45)",
    subterraneanTop: "#0c0c11",
    subterraneanMid: "#070709",
    subterraneanBottom: "#030304",
  },
  claim: {
    measurement: "#8a7bff",
    convention: "#6c5cff",
    interpretation: "rgba(140, 124, 255, 0.20)",
  },
  motion: {
    settle: "620ms cubic-bezier(0.16, 1, 0.30, 1)",
    breathe: "1400ms cubic-bezier(0.40, 0, 0.20, 1)",
    lift: "280ms cubic-bezier(0.20, 0, 0.10, 1)",
  },
  typography: {
    micro: 'var(--font-cinzel, Cinzel, Georgia, "Times New Roman", serif)',
    display: 'var(--font-cinzel, Cinzel, Georgia, "Times New Roman", serif)',
  },
} as const;

/** Blend day (t=0) ↔ night (t=1) spectrum channels. */
export function spectrumBlend(warmth: number, dayHex: string, nightHex: string): string {
  const t = Math.max(0, Math.min(1, warmth));
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as const;
  };
  const [dr, dg, db] = parse(dayHex);
  const [nr, ng, nb] = parse(nightHex);
  const r = Math.round(dr + (nr - dr) * t);
  const g = Math.round(dg + (ng - dg) * t);
  const b = Math.round(db + (nb - db) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function spectrumAccent(warmth: number): string {
  return spectrumBlend(warmth, OBS.day.accent, OBS.night.gold);
}
