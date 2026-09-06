/**
 * Sky heading ribbon — one unique compass cycle, plus wrap copies so the
 * strip can scroll past 360° without a gap.
 *
 * The old HUD used DIRS.length (including wrap copies) as the 360° period, so
 * east sat ~30° off and south ~56° off while the moon (true alt/az) looked fine.
 */

export const SKY_RIBBON_TICKS = [
  "N", "·", "NE", "·", "E", "·", "SE", "·", "S", "·", "SW", "·", "W", "·", "NW", "·",
] as const;

export const SKY_RIBBON_WRAP = ["N", "·", "NE", "·", "E"] as const;

export const SKY_RIBBON_DIRS = [...SKY_RIBBON_TICKS, ...SKY_RIBBON_WRAP] as const;

export const SKY_RIBBON_PERIOD = SKY_RIBBON_TICKS.length;
export const SKY_RIBBON_TICK_PX = 44;

export function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Translate the ribbon so `az` sits under the lubber (screen center).
 * `barWidth` is the heading strip width in CSS pixels.
 */
export function skyRibbonTranslateX(azDeg: number, barWidth: number, tickPx = SKY_RIBBON_TICK_PX): number {
  const az = normalizeHeading(azDeg);
  const periodPx = SKY_RIBBON_PERIOD * tickPx;
  return barWidth / 2 - tickPx / 2 - (az / 360) * periodPx;
}
