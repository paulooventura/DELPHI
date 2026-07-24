import type { WheelLayer } from "../cycleSystems";
import type { CycleReading } from "./types";

/** Thin adapter: enabled plugin angles → clock-friendly wheel layers (no hardcoding in timeEngine). */
export function clockRingsFromReadings(readings: CycleReading[]): WheelLayer[] {
  return readings.map((r) => ({
    id: r.systemId,
    name: r.title,
    icon: r.icon,
    label: r.primary.length > 28 ? `${r.primary.slice(0, 26)}…` : r.primary,
    sublabel: r.secondary ?? r.accuracy,
    angleDeg: ((r.angleDeg % 360) + 360) % 360,
    periodDays: r.periodDays,
    color: r.color,
    category: r.category,
  }));
}
