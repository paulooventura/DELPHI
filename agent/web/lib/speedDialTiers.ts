export type SpeedTierId = "walk" | "run" | "drive" | "fly";

export type SpeedTier = {
  id: SpeedTierId;
  label: string;
  maxKmh: number;
  icon: string;
};

export const SPEED_TIERS: SpeedTier[] = [
  { id: "walk", label: "Walk", maxKmh: 8, icon: "🚶" },
  { id: "run", label: "Run", maxKmh: 28, icon: "🏃" },
  { id: "drive", label: "Drive", maxKmh: 140, icon: "🚗" },
  { id: "fly", label: "Fly", maxKmh: 900, icon: "✈️" },
];

/** Pick tier from speed with hysteresis so the dial doesn't flicker at boundaries. */
export function resolveSpeedTier(
  speedKmh: number,
  prevTierId: SpeedTierId,
): SpeedTierId {
  const idx = SPEED_TIERS.findIndex(t => t.id === prevTierId);
  const cur = idx >= 0 ? idx : 0;

  if (cur < SPEED_TIERS.length - 1) {
    const ceiling = SPEED_TIERS[cur]!.maxKmh;
    if (speedKmh > ceiling * 0.92) {
      for (let i = cur + 1; i < SPEED_TIERS.length; i++) {
        if (speedKmh <= SPEED_TIERS[i]!.maxKmh * 0.92 || i === SPEED_TIERS.length - 1) {
          return SPEED_TIERS[i]!.id;
        }
      }
    }
  }

  if (cur > 0) {
    const floor = SPEED_TIERS[cur - 1]!.maxKmh;
    if (speedKmh < floor * 0.55) {
      for (let i = cur - 1; i >= 0; i--) {
        if (speedKmh >= SPEED_TIERS[i]!.maxKmh * 0.35 || i === 0) {
          return SPEED_TIERS[i]!.id;
        }
      }
    }
  }

  return prevTierId;
}

export function tierById(id: SpeedTierId): SpeedTier {
  return SPEED_TIERS.find(t => t.id === id) ?? SPEED_TIERS[0]!;
}
