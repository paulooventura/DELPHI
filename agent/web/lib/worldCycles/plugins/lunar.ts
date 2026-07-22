import type { CyclePlugin } from "../types";

const KNOWN_NEW_MOON = Date.parse("2000-01-06T18:14:00Z");
const SYNODIC = 29.530588853;
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
    const elapsed = (ctx.instant.getTime() - KNOWN_NEW_MOON) / 86400000;
    const fraction = ((elapsed % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
    const angleDeg = fraction * 360;
    const found = PHASES.find(([t]) => fraction < t) ?? PHASES[PHASES.length - 1]!;
    return {
      systemId: "lunar_phase",
      title: "Lunar Phase",
      primary: `${found[2]} ${found[1]}`,
      secondary: `${(fraction * 100).toFixed(0)}% illuminated cycle`,
      angleDeg,
      periodDays: SYNODIC,
      meta: {
        phase: found[1],
        emoji: found[2],
        fraction: Number(fraction.toFixed(6)),
      },
      accuracy: "mean-orbit",
      sources: ["Synodic month from known new moon 2000-01-06"],
      family: "calendar",
      tier: "A",
      region: ["global"],
      color: "#94a3b8",
      icon: "🌙",
      category: "lunar",
    };
  },
};
