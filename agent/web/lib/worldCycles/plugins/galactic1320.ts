import { dreamspellKinFromDate, galacticDayFromKin } from "../../galacticFrequency";
import type { CyclePlugin } from "../types";

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
    // Independent Dreamspell count — its own anchor + Feb-29 skip, read straight from the
    // civil date in ctx. Deliberately does NOT read the Tzolk'in plugin, so the Maya
    // correlation dropdown cannot move this card.
    const kin = dreamspellKinFromDate(ctx.localYear, ctx.localMonth, ctx.localDay);
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
      // Kin-derived (arithmetical) number, but the meaning is interpretation, NOT
      // convention — and that split from Tzolkin is deliberate, don't "fix" it:
      // Tzolkin is a pre-Columbian day-count with documented continuity (its labels
      // are conventional like "Tuesday"); the 13:20 tone/tribe affirmations are the
      // Dreamspell system authored by José Argüelles (1987), a different correlation
      // plus an authored affirmation layer. Flattening both to convention would erase
      // exactly the distinction this taxonomy exists to preserve.
      accuracy: "arithmetical",
      claim: "interpretation",
      sources: [
        "Dreamspell 13:20 (J. Argüelles, 1987) — own anchor 1987 New Year, Kin 164 = 2013-07-26, Feb-29 skipped. Independent of the GMT Long Count.",
      ],
      family: "meta",
      tier: "A",
      region: ["mesoamerica", "dreamspell"],
      color: "#6366f1",
      icon: "🌊",
      category: "mayan",
    };
  },
};
