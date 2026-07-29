/**
 * Orrery lane math — true cycle progress for the stacked-lanes clock (CLOCK-SPEC).
 * Progress is 0..1 within the current cell; index is the cell at the now-line.
 */

import { muhurtaPhase } from "../cosmic/math";
import { jdFromDate } from "../phase/timeResolution";
import { QUALIA, byId } from "./qualia";
import { resolveMoment } from "./resolveMoment";

export type LaneTier = "measured" | "celebrated" | "display";

export type OrreryLaneId =
  | "ms"
  | "sec"
  | "min"
  | "ghati"
  | "muhurta"
  | "planetary-hour"
  | "shi"
  | "day"
  | "pancawara"
  | "moon"
  | "wuku-tzolkin"
  | "season";

export type OrreryCell = {
  id: string;
  label: string;
  glyph?: string;
};

export type OrreryLaneState = {
  id: OrreryLaneId;
  name: string;
  /** Cycle length label for the teaching surface. */
  cycle: string;
  tier: LaneTier;
  /** Colour key for the red→blue speed gradient (0 = fastest/red, 1 = slowest/blue). */
  speedT: number;
  /** Index of the cell under the now-line. */
  index: number;
  /** 0..1 progress through the current cell. */
  progress: number;
  cells: OrreryCell[];
  /** Active cell label (now-line). */
  activeLabel: string;
  source?: string;
};

export type SlowSkyItem = {
  id: string;
  label: string;
  value: string;
  tier: LaneTier;
};

const CHALDEAN = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"] as const;
const SHI = ["zi", "chou", "yin", "mao", "chen", "si", "wu", "wei", "shen", "you", "xu", "hai"] as const;
const SHI_LABEL = [
  "Zi · Rat", "Chou · Ox", "Yin · Tiger", "Mao · Rabbit", "Chen · Dragon", "Si · Snake",
  "Wu · Horse", "Wei · Goat", "Shen · Monkey", "You · Rooster", "Xu · Dog", "Hai · Pig",
] as const;
const MP_IDS = [
  "mp-new", "mp-wax-cres", "mp-first-q", "mp-wax-gib",
  "mp-full", "mp-wan-gib", "mp-last-q", "mp-wan-cres",
] as const;
const WZ_IDS = [
  "wz-aries", "wz-taurus", "wz-gemini", "wz-cancer", "wz-leo", "wz-virgo",
  "wz-libra", "wz-scorpio", "wz-sagittarius", "wz-capricorn", "wz-aquarius", "wz-pisces",
] as const;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function localHourFrac(date: Date, timeZone: string): { dayFrac: number; hour: number; minute: number; second: number; ms: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  const ms = date.getMilliseconds();
  const dayFrac = (hour + minute / 60 + second / 3600 + ms / 3_600_000) / 24;
  return { dayFrac, hour, minute, second, ms };
}

function zoneFor(lat: number, lon: number): string {
  if (lon >= -100 && lon <= -70 && lat >= 24 && lat <= 50) return "America/Chicago";
  if (lon >= 30 && lon <= 36 && lat >= 33 && lat <= 36) return "Asia/Nicosia";
  return "UTC";
}

function cellsFromSystem(system: string): OrreryCell[] {
  return QUALIA.filter(q => q.system === system)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(q => ({ id: q.id, label: q.name, glyph: q.glyph }));
}

/**
 * Compute all 12 moving lanes + slow-sky cluster for `date` at lat/lon.
 * Call from rAF with the wall clock — rates are true, not faked.
 */
export function computeOrreryState(
  date: Date,
  lat: number,
  lon: number,
): { lanes: OrreryLaneState[]; slowSky: SlowSkyItem[] } {
  const timeZone = zoneFor(lat, lon);
  const { dayFrac, hour, minute, second, ms } = localHourFrac(date, timeZone);
  const jd = jdFromDate(date);
  const resolved = resolveMoment(jd, lat, lon);
  const meta = resolved.meta;

  const muhCells = cellsFromSystem("muhurta");
  const phCells = CHALDEAN.map(p => {
    const e = byId(`ph-${p}`);
    return { id: `ph-${p}`, label: e?.name ?? `${p} hour`, glyph: e?.glyph };
  });
  const shiCells = SHI.map((b, i) => ({
    id: `shi-${b}`,
    label: SHI_LABEL[i]!,
    glyph: byId(`shi-${b}`)?.glyph,
  }));
  const pancaCells = cellsFromSystem("pancawara");
  const moonCells = MP_IDS.map(id => {
    const e = byId(id);
    return { id, label: e?.name ?? id, glyph: e?.glyph };
  });
  const wukuCells = cellsFromSystem("pawukon-wuku");
  const seasonCells = WZ_IDS.map(id => {
    const e = byId(id);
    return { id, label: e?.name ?? id, glyph: e?.glyph };
  });

  const muh = muhurtaPhase(date);
  const shiIndex = Math.floor(((hour + 1) % 24) / 2) % 12;
  const shiProg = mod((hour + 1) % 24, 2) / 2 + minute / 120 + second / 7200;
  const phIndex = CHALDEAN.indexOf(meta.planetaryHour as (typeof CHALDEAN)[number]);
  const phProg = (minute + second / 60) / 60;
  const moonFloat = (((meta.moonPhase * 360) + 22.5) % 360) / 45;
  const moonIndex = Math.floor(moonFloat) % 8;
  const moonProg = moonFloat - Math.floor(moonFloat);
  const seasonIndex = Math.floor(meta.sunTropicalDeg / 30) % 12;
  const seasonProg = (meta.sunTropicalDeg % 30) / 30;
  const wukuIndex = Math.max(0, meta.wuku - 1);
  const civilDay = Math.floor(jd + 0.5);
  const pawukon = mod(civilDay - 2451545, 210);
  const wukuProg = (pawukon % 7) / 7 + dayFrac / 7;
  const pancaIndex = Math.max(0, meta.pancawara - 1);
  const pancaProg = dayFrac; // advances with the civil day
  const ghatiFloat = dayFrac * 60; // 60 ghatis / day
  const ghatiIndex = Math.floor(ghatiFloat) % 60;
  const ghatiProg = ghatiFloat - Math.floor(ghatiFloat);

  // Display order: north (slow) → south (fast). speedT 1 = blue/north, 0 = red/south.
  const lanesNorthToSouth: OrreryLaneState[] = [
    {
      id: "season",
      name: "Solar season",
      cycle: "~1 year",
      tier: "celebrated",
      speedT: 1,
      index: seasonIndex,
      progress: seasonProg,
      cells: seasonCells,
      activeLabel: seasonCells[seasonIndex]?.label ?? "—",
      source: byId(WZ_IDS[seasonIndex]!)?.source,
    },
    {
      id: "wuku-tzolkin",
      name: "Wuku · Tzolk'in",
      cycle: "7 / 260 days",
      tier: "celebrated",
      speedT: 0.91,
      index: wukuIndex,
      progress: mod(wukuProg, 1),
      cells: wukuCells,
      activeLabel: `${wukuCells[wukuIndex]?.label ?? "—"} · ${meta.tzolkinTone} ${meta.tzolkinSign}`,
      source: byId(`wk-${String(meta.wuku).padStart(2, "0")}`)?.source,
    },
    {
      id: "moon",
      name: "Moon phase",
      cycle: "~29.5 days",
      tier: "measured",
      speedT: 0.82,
      index: moonIndex,
      progress: moonProg,
      cells: moonCells,
      activeLabel: moonCells[moonIndex]?.label ?? "—",
      source: byId(MP_IDS[moonIndex]!)?.source,
    },
    {
      id: "pancawara",
      name: "Pancawara",
      cycle: "5 days",
      tier: "celebrated",
      speedT: 0.73,
      index: pancaIndex,
      progress: pancaProg,
      cells: pancaCells,
      activeLabel: pancaCells[pancaIndex]?.label ?? "—",
      source: byId(`pc-${meta.pancawara}`)?.source,
    },
    {
      id: "day",
      name: "The day",
      cycle: "24 h",
      tier: "measured",
      speedT: 0.64,
      index: hour,
      progress: (minute + second / 60) / 60,
      cells: Array.from({ length: 24 }, (_, i) => ({
        id: `h-${i}`,
        label: `${String(i).padStart(2, "0")}h`,
      })),
      activeLabel: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      source: "Local civil day — sunrise→sunset arc as measured light",
    },
    {
      id: "shi",
      name: "Chinese shí",
      cycle: "2 h",
      tier: "celebrated",
      speedT: 0.55,
      index: shiIndex,
      progress: mod(shiProg, 1),
      cells: shiCells,
      activeLabel: shiCells[shiIndex]?.label ?? "—",
      source: byId(`shi-${SHI[shiIndex]!}`)?.source,
    },
    {
      id: "planetary-hour",
      name: "Planetary hour",
      cycle: "~60 min",
      tier: "celebrated",
      speedT: 0.45,
      index: Math.max(0, phIndex),
      progress: phProg,
      cells: phCells,
      activeLabel: phCells[Math.max(0, phIndex)]?.label ?? "—",
      source: byId(`ph-${meta.planetaryHour}`)?.source,
    },
    {
      id: "muhurta",
      name: "Muhūrta",
      cycle: "~48 min",
      tier: "celebrated",
      speedT: 0.36,
      index: muh.index,
      progress: mod(muh.angleDeg / (360 / 30), 1),
      cells: muhCells,
      activeLabel: muhCells[muh.index]?.label ?? `Muhūrta ${muh.index + 1}`,
      source: byId(`muh-${String(muh.index + 1).padStart(2, "0")}`)?.source,
    },
    {
      id: "ghati",
      name: "Ghati",
      cycle: "~24 min",
      tier: "display",
      speedT: 0.27,
      index: ghatiIndex,
      progress: ghatiProg,
      cells: Array.from({ length: 60 }, (_, i) => ({
        id: `g-${i}`,
        label: `G ${i + 1}`,
      })),
      activeLabel: `Ghati ${ghatiIndex + 1}`,
      source: "Vedic ghati — 60 divisions of the day (~24 min)",
    },
    {
      id: "min",
      name: "Minutes",
      cycle: "60 min",
      tier: "display",
      speedT: 0.18,
      index: minute,
      progress: (second + ms / 1000) / 60,
      cells: Array.from({ length: 60 }, (_, i) => ({
        id: `m-${i}`,
        label: String(i).padStart(2, "0"),
      })),
      activeLabel: `${String(minute).padStart(2, "0")}m`,
    },
    {
      id: "sec",
      name: "Seconds",
      cycle: "60 s",
      tier: "display",
      speedT: 0.09,
      index: second,
      progress: ms / 1000,
      cells: Array.from({ length: 60 }, (_, i) => ({
        id: `s-${i}`,
        label: String(i).padStart(2, "0"),
      })),
      activeLabel: `${String(second).padStart(2, "0")}s`,
    },
    {
      id: "ms",
      name: "Milliseconds",
      cycle: "1000 ms",
      tier: "display",
      speedT: 0,
      index: Math.floor(ms / 100) % 10,
      progress: (ms % 100) / 100,
      cells: Array.from({ length: 10 }, (_, i) => ({
        id: `ms-${i}`,
        label: "",
      })),
      activeLabel: "",
    },
  ];

  const nk = byId(
    resolved.ids.find(id => id.startsWith("nk-")) ?? "",
  );
  const mz = byId(`mz-${String(meta.manzil).padStart(2, "0")}`);
  const dc = byId(
    resolved.ids.find(id => id.startsWith("dc-")) ?? "",
  );
  const num = byId(`num-${meta.numerology}`);

  const slowSky: SlowSkyItem[] = [
    {
      id: "nakshatra",
      label: "Nakshatra",
      value: nk?.name ?? "—",
      tier: "measured",
    },
    {
      id: "manzil",
      label: "Manzil",
      value: mz?.name ?? "—",
      tier: "celebrated",
    },
    {
      id: "decan",
      label: "Decan",
      value: dc?.name ?? "—",
      tier: "celebrated",
    },
    {
      id: "numerology",
      label: "Number",
      value: num?.name ?? `Number ${meta.numerology}`,
      tier: "celebrated",
    },
  ];

  return { lanes: lanesNorthToSouth, slowSky };
}

/** Map speedT 0..1 → CSS/canvas colour (red hot → deep blue). */
export function laneColor(speedT: number, alpha = 1): string {
  const t = Math.max(0, Math.min(1, speedT));
  // red (0) → amber → green → teal → blue (1)
  const stops: [number, number, number][] = [
    [220, 48, 40],
    [230, 120, 36],
    [200, 170, 40],
    [60, 170, 90],
    [40, 160, 170],
    [70, 100, 220],
    [50, 70, 180],
  ];
  const x = t * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i]!;
  const b = stops[Math.min(i + 1, stops.length - 1)]!;
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgba(${r},${g},${bl},${alpha})`;
}
