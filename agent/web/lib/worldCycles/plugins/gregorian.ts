import type { CyclePlugin } from "../types";

function daysInMonth(year: number, monthNum: number): number {
  return new Date(year, monthNum, 0).getDate();
}

function weekOfYear(y: number, m: number, d: number): number {
  const date = new Date(y, m - 1, d);
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  x.setDate(x.getDate() + 4 - (x.getDay() || 7));
  const y0 = new Date(x.getFullYear(), 0, 1);
  return Math.ceil((((x.getTime() - y0.getTime()) / 86400000) + 1) / 7);
}

export const gregorianPlugin: CyclePlugin = {
  id: "gregorian",
  title: "Gregorian",
  family: "calendar",
  tier: "A",
  region: ["global"],
  color: "#1e40af",
  icon: "📆",
  category: "western",
  defaultEnabled: true,
  resolve(ctx) {
    const { localYear: y, localMonth: m, localDay: d, dayOfYear, instant } = ctx;
    const dim = daysInMonth(y, m);
    const weekday = instant.toLocaleDateString("en", { weekday: "long", timeZone: ctx.timeZone });
    const monthName = instant.toLocaleDateString("en", { month: "long", timeZone: ctx.timeZone });
    const angleDeg = ((dayOfYear - 1 + ctx.localHour / 24) / 365.25) * 360;
    return {
      systemId: "gregorian",
      title: "Gregorian",
      primary: `${weekday}, ${monthName} ${d}, ${y}`,
      secondary: `Day ${dayOfYear} · week ${weekOfYear(y, m, d)}`,
      angleDeg: ((angleDeg % 360) + 360) % 360,
      periodDays: 365.25,
      meta: {
        year: y,
        month: m,
        day: d,
        dayOfYear,
        weekOfYear: weekOfYear(y, m, d),
        daysInMonth: dim,
        weekday,
        monthName,
      },
      accuracy: "civil",
      claim: "convention",
      sources: ["ISO 8601 civil calendar"],
      family: "calendar",
      tier: "A",
      region: ["global"],
      color: "#1e40af",
      icon: "📆",
      category: "western",
    };
  },
};
