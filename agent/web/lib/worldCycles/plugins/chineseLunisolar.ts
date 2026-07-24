import {
  chineseLunisolarAngle,
  gregorianToChineseLunisolar,
} from "../calendars/chineseLunisolar";
import type { CyclePlugin } from "../types";

export const chineseLunisolarPlugin: CyclePlugin = {
  id: "chinese_lunisolar",
  title: "Chinese Lunisolar",
  family: "calendar",
  tier: "A",
  region: ["east-asia"],
  color: "#f43f5e",
  icon: "📅",
  category: "chinese",
  defaultEnabled: true,
  resolve(ctx) {
    const c = gregorianToChineseLunisolar(ctx.localYear, ctx.localMonth, ctx.localDay);
    const leap = c.isLeapMonth ? "leap " : "";
    return {
      systemId: "chinese_lunisolar",
      title: "Chinese Lunisolar",
      primary: `${leap}M${c.month} day ${c.day} · ${c.element} ${c.animal}`,
      secondary: `Animal year ${c.year}`,
      angleDeg: chineseLunisolarAngle(c),
      periodDays: 29.530588853,
      meta: {
        year: c.year,
        month: c.month,
        day: c.day,
        isLeapMonth: c.isLeapMonth,
        animal: c.animal,
        element: c.element,
      },
      accuracy: "arithmetical",
      claim: "convention",
      sources: ["CNY table + synodic month index; leap-month map 1980–2050"],
      family: "calendar",
      tier: "A",
      region: ["east-asia"],
      color: "#f43f5e",
      icon: "📅",
      category: "chinese",
    };
  },
};
