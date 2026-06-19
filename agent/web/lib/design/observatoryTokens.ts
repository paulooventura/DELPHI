/** Modern Observatory palette — shared across canvas, SVG, and CSS. */
export const OBS = {
  space: {
    outer: "#05070B",
    core: "#0D111A",
  },
  vector: {
    structural: "rgba(255, 255, 255, 0.15)",
    structuralStrong: "rgba(255, 255, 255, 0.28)",
    strokeMin: 0.75,
    strokeMax: 1.5,
  },
  day: {
    ink: "#E2E8F0",
    accent: "#60A5FA",
    glow: "rgba(96, 165, 250, 0.35)",
  },
  night: {
    amber: "#D97706",
    gold: "#F59E0B",
    glow: "rgba(217, 119, 6, 0.28)",
  },
  celestial: {
    targetLock: "#10B981",
    targetGlow: "rgba(16, 185, 129, 0.45)",
    crosshair: "rgba(96, 165, 250, 0.82)",
    horizon: "rgba(255, 255, 255, 0.22)",
    ecliptic: "rgba(245, 158, 11, 0.42)",
    meridian: "rgba(255, 255, 255, 0.18)",
    starAbove: "#E2E8F0",
    starBelow: "rgba(106, 140, 176, 0.55)",
    subterraneanTop: "#1a1208",
    subterraneanMid: "#120c06",
    subterraneanBottom: "#0a0704",
  },
  typography: {
    micro: 'var(--font-geist-mono, "JetBrains Mono", "SF Mono", Consolas, monospace)',
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
