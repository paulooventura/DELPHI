import { gregorianToHijri, hijriMonthName, hijriYearAngle } from "../calendars/hijri";
import type { CyclePlugin } from "../types";

export const hijriPlugin: CyclePlugin = {
  id: "hijri",
  title: "Hijri",
  family: "calendar",
  tier: "A",
  region: ["islamic"],
  color: "#059669",
  icon: "☪",
  category: "abrahamic",
  defaultEnabled: true,
  resolve(ctx) {
    const h = gregorianToHijri(ctx.localYear, ctx.localMonth, ctx.localDay);
    const month = hijriMonthName(h.month);
    return {
      systemId: "hijri",
      title: "Hijri",
      primary: `${h.day} ${month} ${h.year} AH`,
      secondary: "Tabular Islamic (Kuwaiti)",
      angleDeg: hijriYearAngle(h),
      periodDays: 354.36667,
      meta: { year: h.year, month: h.month, day: h.day, monthName: month },
      accuracy: "arithmetical",
      sources: ["Tabular Islamic / Kuwaiti algorithm"],
      family: "calendar",
      tier: "A",
      region: ["islamic"],
      color: "#059669",
      icon: "☪",
      category: "abrahamic",
    };
  },
};
