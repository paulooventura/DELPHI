import { gregorianToPersian, persianMonthName, persianYearAngle } from "../calendars/persian";
import type { CyclePlugin } from "../types";

export const persianPlugin: CyclePlugin = {
  id: "persian",
  title: "Persian",
  family: "calendar",
  tier: "A",
  region: ["iran", "afghanistan"],
  color: "#c026d3",
  icon: "🌞",
  category: "abrahamic",
  defaultEnabled: true,
  resolve(ctx) {
    const p = gregorianToPersian(ctx.localYear, ctx.localMonth, ctx.localDay);
    const monthName = persianMonthName(p.month);
    return {
      systemId: "persian",
      title: "Persian",
      primary: `${p.day} ${monthName} ${p.year}`,
      secondary: "Solar Hijri (Jalali)",
      angleDeg: persianYearAngle(p),
      periodDays: 365.2422,
      meta: { year: p.year, month: p.month, day: p.day, monthName },
      accuracy: "arithmetical",
      sources: ["Jalali solar Hijri conversion"],
      family: "calendar",
      tier: "A",
      region: ["iran", "afghanistan"],
      color: "#c026d3",
      icon: "🌞",
      category: "abrahamic",
    };
  },
};
