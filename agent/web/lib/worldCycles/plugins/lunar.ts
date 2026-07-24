import type { CyclePlugin } from "../types";
import { computePhases } from "@/lib/phase/engine";

const SYNODIC = 29.530588853;

// Phase-name lookup is presentation, not math — thresholds over synodic position.
const PHASES: [number, string, string][] = [
  [0.0625, "New Moon", "🌑"],
  [0.1875, "Waxing Crescent", "🌒"],
  [0.3125, "First Quarter", "🌓"],
  [0.4375, "Waxing Gibbous", "🌔"],
  [0.5625, "Full Moon", "🌕"],
  [0.6875, "Waning Gibbous", "🌖"],
  [0.8125, "Last Quarter", "🌗"],
  [1.0000, "Waning Crescent", "🌘"],
];

export const lunarPlugin: CyclePlugin = {
  id: "lunar_phase",
  title: "Lunar Phase",
  family: "calendar",
  tier: "A",
  region: ["global"],
  color: "#94a3b8",
  icon: "🌙",
  category: "lunar",
  defaultEnabled: true,
  resolve(ctx) {
    // Ephemeris-derived synodic phase (astronomy-engine), not mean-period arithmetic.
    const reading = computePhases(ctx.jd, { only: ["lunar-synodic"] }).byId["lunar-synodic"]!;
    const fraction = reading.phase;
    const angleDeg = reading.angleDeg;
    const illum = Number(reading.meta?.illuminatedFraction ?? 0);
    const found = PHASES.find(([t]) => fraction < t) ?? PHASES[PHASES.length - 1]!;
    return {
      systemId: "lunar_phase",
      title: "Lunar Phase",
      primary: `${found[2]} ${found[1]}`,
      secondary: `${(illum * 100).toFixed(0)}% illuminated`,
      angleDeg,
      periodDays: SYNODIC,
      meta: {
        phase: found[1],
        emoji: found[2],
        fraction: Number(fraction.toFixed(6)),
        illuminatedFraction: Number(illum.toFixed(4)),
      },
      accuracy: "astronomical",
      claim: "measurement",
      sources: reading.sources,
      family: "calendar",
      tier: "A",
      region: ["global"],
      color: "#94a3b8",
      icon: "🌙",
      category: "lunar",
    };
  },
};
