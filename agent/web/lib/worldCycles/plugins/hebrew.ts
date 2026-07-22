import { gregorianToHebrew, hebrewMonthDisplay, hebrewYearAngle } from "../calendars/hebrew";
import type { CyclePlugin } from "../types";

export const hebrewPlugin: CyclePlugin = {
  id: "hebrew",
  title: "Hebrew",
  family: "calendar",
  tier: "A",
  region: ["jewish"],
  color: "#2563eb",
  icon: "✡",
  category: "abrahamic",
  defaultEnabled: true,
  resolve(ctx) {
    const h = gregorianToHebrew(ctx.localYear, ctx.localMonth, ctx.localDay);
    const monthName = hebrewMonthDisplay(h.year, h.month);
    return {
      systemId: "hebrew",
      title: "Hebrew",
      primary: `${h.day} ${monthName} ${h.year}`,
      secondary: "Fixed arithmetic Hebrew",
      angleDeg: hebrewYearAngle(h),
      periodDays: 365.2468,
      meta: { year: h.year, month: h.month, day: h.day, monthName },
      accuracy: "arithmetical",
      sources: ["Dershowitz/Reingold-style Hebrew arithmetic"],
      family: "calendar",
      tier: "A",
      region: ["jewish"],
      color: "#2563eb",
      icon: "✡",
      category: "abrahamic",
    };
  },
};
