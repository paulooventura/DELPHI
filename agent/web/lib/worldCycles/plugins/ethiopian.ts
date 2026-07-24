import {
  copticMonthName,
  ethiopianMonthName,
  ethiopianToCoptic,
  ethiopianYearAngle,
  gregorianToEthiopian,
} from "../calendars/ethiopian";
import type { CyclePlugin } from "../types";

export const ethiopianPlugin: CyclePlugin = {
  id: "ethiopian",
  title: "Ethiopian",
  family: "calendar",
  tier: "A",
  region: ["ethiopia", "coptic"],
  color: "#ca8a04",
  icon: "✝",
  category: "abrahamic",
  defaultEnabled: true,
  resolve(ctx) {
    const e = gregorianToEthiopian(ctx.localYear, ctx.localMonth, ctx.localDay);
    const c = ethiopianToCoptic(e);
    const ethMonth = ethiopianMonthName(e.month);
    const copMonth = copticMonthName(c.month);
    return {
      systemId: "ethiopian",
      title: "Ethiopian",
      primary: `${e.day} ${ethMonth} ${e.year}`,
      secondary: `Coptic: ${c.day} ${copMonth} ${c.year}`,
      angleDeg: ethiopianYearAngle(e),
      periodDays: 365.25,
      meta: {
        year: e.year,
        month: e.month,
        day: e.day,
        monthName: ethMonth,
        copticYear: c.year,
        copticMonth: c.month,
        copticDay: c.day,
        copticMonthName: copMonth,
      },
      accuracy: "arithmetical",
      claim: "convention",
      sources: ["Ethiopian civil calendar + Coptic companion"],
      family: "calendar",
      tier: "A",
      region: ["ethiopia", "coptic"],
      color: "#ca8a04",
      icon: "✝",
      category: "abrahamic",
    };
  },
};
