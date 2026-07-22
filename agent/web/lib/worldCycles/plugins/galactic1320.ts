import { galacticDayFromKin } from "../../galacticFrequency";
import type { CyclePlugin } from "../types";
import { tzolkinPlugin } from "./tzolkin";

export const galactic1320Plugin: CyclePlugin = {
  id: "galactic_1320",
  title: "13:20 Galactic",
  family: "meta",
  tier: "A",
  region: ["mesoamerica", "dreamspell"],
  color: "#6366f1",
  icon: "🌊",
  category: "mayan",
  defaultEnabled: true,
  resolve(ctx) {
    const tz = tzolkinPlugin.resolve(ctx);
    const kin = Number(tz.meta.kin) || 1;
    const g = galacticDayFromKin(kin);
    return {
      systemId: "galactic_1320",
      title: "13:20 Galactic",
      primary: g.label,
      secondary: g.affirmation,
      angleDeg: ((kin - 1) / 260) * 360,
      periodDays: 260,
      meta: {
        kin,
        tone: g.tone.tone,
        toneName: g.tone.name,
        tribe: g.tribe.name,
        tribeColor: g.tribe.color,
        mayaSign: g.tribe.mayaSign,
        affirmation: g.affirmation,
        label: g.label,
        frequencyNote: g.frequencyNote,
      },
      accuracy: "symbolic",
      sources: ["13 Tones × 20 Tribes (DELPHI galacticFrequency)"],
      family: "meta",
      tier: "A",
      region: ["mesoamerica", "dreamspell"],
      color: "#6366f1",
      icon: "🌊",
      category: "mayan",
    };
  },
};
