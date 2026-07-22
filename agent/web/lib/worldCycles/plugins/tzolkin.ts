import type { CyclePlugin } from "../types";

const TZOLKIN_SIGNS = [
  "Imix", "Ik", "Akbal", "Kan", "Chikchan", "Kimi", "Manik", "Lamat", "Muluk", "Ok",
  "Chuen", "Eb", "Ben", "Ix", "Men", "Kib", "Kaban", "Etznab", "Kawak", "Ajaw",
];

/** JD of DELPHI Kin 1 civil anchor: 2024-07-26 local → use UTC noon of that civil day. */
const DELPHI_KIN1_JD = 2460518.0; // 2024-07-26 12:00 UTC approx; we use civil day count below

function civilDayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

const ANCHOR_DAY = civilDayNumber(2024, 7, 26); // Kin 1
const GMT_JD_EPOCH = 584283; // Classic GMT correlation JD for 0.0.0.0.0 — used as offset mode

export const tzolkinPlugin: CyclePlugin = {
  id: "maya_tzolkin",
  title: "Tzolk’in",
  family: "calendar",
  tier: "A",
  region: ["mesoamerica"],
  color: "#7c3aed",
  icon: "🧭",
  category: "mayan",
  defaultEnabled: true,
  resolve(ctx) {
    let kin: number;
    if (ctx.mayaCorrelation === "gmt_584283") {
      // Long Count serial day → tzolk'in; JD midnight → Maya day number
      const mayaDay = Math.floor(ctx.jd + 0.5) - GMT_JD_EPOCH;
      kin = ((mayaDay + 160) % 260 + 260) % 260 + 1; // Ajaw 4 alignment common for GMT
    } else {
      const day = civilDayNumber(ctx.localYear, ctx.localMonth, ctx.localDay);
      const diff = day - ANCHOR_DAY;
      kin = ((diff % 260) + 260) % 260 + 1;
    }
    const tone = ((kin - 1) % 13) + 1;
    const sign = TZOLKIN_SIGNS[(kin - 1) % 20]!;
    const wavespell = Math.ceil(kin / 13);
    const castle = Math.ceil(kin / 52);
    return {
      systemId: "maya_tzolkin",
      title: "Tzolk’in",
      primary: `Kin ${kin} · ${tone} ${sign}`,
      secondary: `Wavespell ${wavespell} · Castle ${castle}/5 · ${ctx.mayaCorrelation}`,
      angleDeg: ((kin - 1) / 260) * 360,
      periodDays: 260,
      meta: {
        kin,
        tone,
        sign,
        wavespell,
        castle,
        correlation: ctx.mayaCorrelation,
      },
      accuracy: "symbolic",
      sources: [
        ctx.mayaCorrelation === "gmt_584283"
          ? "GMT correlation 584283"
          : "DELPHI Kin-1 anchor 2024-07-26",
      ],
      family: "calendar",
      tier: "A",
      region: ["mesoamerica"],
      color: "#7c3aed",
      icon: "🧭",
      category: "mayan",
    };
  },
};

// silence unused (kept for documentation of JD anchor)
void DELPHI_KIN1_JD;
