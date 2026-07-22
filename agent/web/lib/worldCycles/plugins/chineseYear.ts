import { gregorianToChineseLunisolar } from "../calendars/chineseLunisolar";
import type { CyclePlugin } from "../types";

const SYMBOLS: Record<string, string> = {
  Rat: "🐀", Ox: "🐂", Tiger: "🐅", Rabbit: "🐇", Dragon: "🐉", Snake: "🐍",
  Horse: "🐴", Goat: "🐑", Monkey: "🐒", Rooster: "🐓", Dog: "🐕", Pig: "🐖",
};

/** Chinese year animal/element (CNY-aware). */
export const chineseYearPlugin: CyclePlugin = {
  id: "chinese_year",
  title: "Chinese Year",
  family: "calendar",
  tier: "A",
  region: ["east-asia"],
  color: "#b91c1c",
  icon: "🧧",
  category: "chinese",
  defaultEnabled: true,
  resolve(ctx) {
    const c = gregorianToChineseLunisolar(ctx.localYear, ctx.localMonth, ctx.localDay);
    const cyclePos = ((c.year - 1984 + 120) % 60) / 60;
    const symbol = SYMBOLS[c.animal] ?? "🐉";
    return {
      systemId: "chinese_year",
      title: "Chinese Year",
      primary: `${symbol} ${c.element} ${c.animal}`,
      secondary: `${c.yinYang} · 60-year cycle`,
      angleDeg: cyclePos * 360,
      periodDays: 21915,
      meta: {
        animal: c.animal,
        element: c.element,
        yinYang: c.yinYang,
        symbol,
        animalYear: c.year,
      },
      accuracy: "arithmetical",
      sources: ["Civil Chinese New Year table 1980–2050"],
      family: "calendar",
      tier: "A",
      region: ["east-asia"],
      color: "#b91c1c",
      icon: "🧧",
      category: "chinese",
    };
  },
};
