import { normalizeDeg, sunEclipticLongitudeDeg } from "../../cosmic/math";
import type { CyclePlugin } from "../types";

const SIGNS = [
  { sign: "Aries", symbol: "♈" },
  { sign: "Taurus", symbol: "♉" },
  { sign: "Gemini", symbol: "♊" },
  { sign: "Cancer", symbol: "♋" },
  { sign: "Leo", symbol: "♌" },
  { sign: "Virgo", symbol: "♍" },
  { sign: "Libra", symbol: "♎" },
  { sign: "Scorpio", symbol: "♏" },
  { sign: "Sagittarius", symbol: "♐" },
  { sign: "Capricorn", symbol: "♑" },
  { sign: "Aquarius", symbol: "♒" },
  { sign: "Pisces", symbol: "♓" },
];

/** Tropical zodiac from solar ecliptic longitude λ — no date-cutoff drift. */
export const tropicalPlugin: CyclePlugin = {
  id: "tropical_zodiac",
  title: "Tropical Zodiac",
  family: "zodiac",
  tier: "A",
  region: ["west"],
  color: "#f97316",
  icon: "✨",
  category: "western",
  defaultEnabled: true,
  resolve(ctx) {
    const lambda = normalizeDeg(sunEclipticLongitudeDeg(ctx.jd));
    const idx = Math.floor(lambda / 30) % 12;
    const degInSign = lambda % 30;
    const { sign, symbol } = SIGNS[idx]!;
    return {
      systemId: "tropical_zodiac",
      title: "Tropical Zodiac",
      primary: `${symbol} ${sign}`,
      secondary: `${degInSign.toFixed(1)}° · λ ${lambda.toFixed(1)}°`,
      angleDeg: lambda,
      periodDays: 365.2422,
      meta: {
        sign,
        symbol,
        longitude: Number(lambda.toFixed(4)),
        degreeInSign: Number(degInSign.toFixed(4)),
      },
      accuracy: "astronomical",
      sources: ["VSOP-style mean solar λ (DELPHI math.ts)"],
      family: "zodiac",
      tier: "A",
      region: ["west"],
      color: "#f97316",
      icon: "✨",
      category: "western",
    };
  },
};
