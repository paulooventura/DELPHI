/**
 * Dreamspell tribe color → felt-weather lean for distillation.
 * Never names Red/White/Blue/Yellow in the street phrase — only reweights
 * quality words already present in the computed chorus.
 */

export type TribeColor = "Red" | "White" | "Blue" | "Yellow";

/** Quality words that resonate with each tribe color (lowercase). */
export const COLOR_QUALITY_LEAN: Record<TribeColor, readonly string[]> = {
  Red: [
    "warm",
    "active",
    "initiating",
    "vital",
    "fierce",
    "passionate",
    "rising",
    "urgent",
    "charged",
    "radiant",
    "bold",
    "consuming",
    "pioneering",
  ],
  White: [
    "clear",
    "cool",
    "reflective",
    "purifying",
    "communicative",
    "receptive",
    "inward",
    "loyal",
    "refining",
    "precise",
    "ordering",
    "breath",
    "spirit",
  ],
  Blue: [
    "deep",
    "dreaming",
    "intuitive",
    "expansive",
    "transformative",
    "secretive",
    "abundant",
    "visionary",
    "healing",
    "playful",
    "magical",
    "catalytic",
    "shadowed",
  ],
  Yellow: [
    "radiant",
    "bright",
    "outward",
    "enlightening",
    "flowering",
    "light",
    "optimistic",
    "generous",
    "target",
    "aware",
    "elegant",
    "intelligent",
    "free",
  ],
};

/** Extra weight applied when a chorus quality matches the color lean. */
export const COLOR_LEAN_BOOST = 2.4;

export function isTribeColor(v: unknown): v is TribeColor {
  return v === "Red" || v === "White" || v === "Blue" || v === "Yellow";
}

export function colorLeanMatches(quality: string, color: TribeColor): boolean {
  const q = quality.trim().toLowerCase();
  if (!q) return false;
  return COLOR_QUALITY_LEAN[color].some(lean => q === lean || q.includes(lean) || lean.includes(q));
}
