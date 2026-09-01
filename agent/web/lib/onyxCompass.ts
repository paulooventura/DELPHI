/** Home compass — Paulo 2026-09-01: yin-yang doors, not the old cast/clock map. */

export type CompassAim = "up" | "down" | "left" | "right" | "center" | null;

export const COMPASS_LOCK_PX = 10;
export const COMPASS_AIM_PX = 42;

export type CompassDoor = "sky" | "tonal" | "studies" | "orrery" | "you";

export const COMPASS_DOORS: Record<Exclude<CompassAim, null>, CompassDoor> = {
  up: "sky",
  down: "tonal",
  left: "studies",
  right: "orrery",
  center: "you",
};

export function resolveCompassAim(dx: number, dy: number, aimPx = COMPASS_AIM_PX): CompassAim {
  const dist = Math.hypot(dx, dy);
  if (dist < aimPx) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export function doorForAim(aim: CompassAim): CompassDoor | null {
  if (!aim) return null;
  return COMPASS_DOORS[aim];
}
