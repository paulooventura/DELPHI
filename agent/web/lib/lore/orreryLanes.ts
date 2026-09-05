/**
 * Orrery lane math — true cycle progress for the stacked-lanes clock (CLOCK-SPEC).
 *
 * Fixed now-line at screen center. Cells scroll right→left through it; a cell's
 * offset relative to the line IS the reading (phase within the cycle).
 * Do not center the active cell — that destroys phase information.
 */

import { computeSolarDayEvents } from "../cosmic/astronomy";
import { MUHURTA_COUNT, MUHURTA_MINUTES } from "../cosmic/math";
import { jdFromDate } from "../phase/timeResolution";
import { QUALIA, byId } from "./qualia";
import { resolveMoment } from "./resolveMoment";

/** 1 ghati = 24 minutes. Zero-point is local sunrise, not midnight. */
export const GHATI_MS = 24 * 60 * 1000;
/** 1 pala / vighaṭi = 24 s. 60 pala in one ghaṭi. */
export const PALA_MS = 24 * 1000;
/** 1 prāṇa = 4 s. Six breaths in one pala. */
export const PRANA_MS = 4 * 1000;
/** 1 helek = 3⅓ s. 1080 per hour, 25920 per sunrise-day. */
export const HELEK_MS = (10 / 3) * 1000;
export const HELEK_PER_HOUR = 1080;
export const HELEK_PER_DAY = 25920;
/** 1 rega = 1/76 helek ≈ 43.86 ms. */
export const REGA_PER_HELEK = 76;

/**
 * Horizontal scroll origin — every lane uses this with true cell-phase progress.
 * Cells move left through a fixed now-line; offset IS the reading:
 *   progress 0   → left edge on the line (cell mostly right — just began / young)
 *   progress 0.5 → cell centered (halfway)
 *   progress 1   → right edge on the line (about to tick)
 *
 * Formula: activeLeft = nowX − progress·cellW
 */
export function laneScrollStartX(
  nowX: number,
  index: number,
  progress: number,
  cellW: number,
): number {
  const p = Math.max(0, Math.min(1, progress));
  return nowX - (index + p) * cellW;
}

/** Center X of the active cell for a given progress (phase helper, not a layout goal). */
export function activeCellCenterX(nowX: number, progress: number, cellW: number): number {
  const p = Math.max(0, Math.min(1, progress));
  return nowX + (0.5 - p) * cellW;
}

export type LaneTier = "measured" | "celebrated" | "display";

export type OrreryLaneId =
  | "rega"
  | "ms"
  | "sec"
  | "helek"
  | "prana"
  | "pala"
  | "min"
  | "ghati"
  | "muhurta"
  | "planetary-hour"
  | "shi"
  | "day"
  | "pancawara"
  | "moon"
  | "wuku-tzolkin"
  | "season"
  | "month"
  | "year";

/**
 * Escapement haptic class — all lanes scroll by true phase; discrete-tick
 * lanes also fire a settle tick when their index advances.
 */
export type OrreryMotion = "continuous" | "discrete-tick";

/** Civil / clock subdivisions — no escapement haptic (pure glide). */
export const CONTINUOUS_LANE_IDS: readonly OrreryLaneId[] = [
  "rega",
  "ms",
  "sec",
  "helek",
  "prana",
  "pala",
  "min",
  "ghati",
  "day",
];

export function laneMotion(id: OrreryLaneId): OrreryMotion {
  return CONTINUOUS_LANE_IDS.includes(id) ? "continuous" : "discrete-tick";
}

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
  /** Index of the active cell (the unit currently in force). */
  index: number;
  /** 0..1 phase through the current cell — drives continuous scroll offset. */
  progress: number;
  cells: OrreryCell[];
  /** Active cell label (now-line). */
  activeLabel: string;
  source?: string;
  /** Why this cycle exists — shown when the lane is opened. */
  lore?: string;
  /** Historical birthplace / lineage of the unit or cycle. */
  origin?: string;
  /** Cautious period when the convention is attested or standardized. */
  usedSince?: string;
  /** A memorable, relevant fact rather than another definition. */
  curious?: string;
};

type LaneLore = Pick<OrreryLaneState, "origin" | "usedSince" | "curious">;

/**
 * Historical teaching copy for every visible lane.
 * Dates are deliberately cautious ("attested", "standardized") because a
 * convention's ancestry is often older than its surviving written record.
 */
const LANE_LORE: Partial<Record<OrreryLaneId, LaneLore>> = {
  year: {
    origin: "Astronomical calendars grew from watching the Sun return through the seasons; the modern civil year is the Gregorian calendar's arithmetic approximation.",
    usedSince: "Seasonal year-counting is prehistoric. The Gregorian reform has governed most international civil time since 1582, spreading gradually by country.",
    curious: "A tropical year is about 365.2422 days, which is why the Gregorian rule keeps most century years common but retains years divisible by 400 as leap years.",
  },
  month: {
    origin: "The word month descends from Moon. Early month systems followed lunations; the modern Gregorian months preserve a reshaped Roman calendar.",
    usedSince: "Lunar month-counting is ancient. The present twelve-month Gregorian arrangement dates to 1582 but inherited the Julian calendar of 45 BCE.",
    curious: "Our unequal 28–31 day months no longer track one lunar phase cycle, which averages about 29.53 days.",
  },
  season: {
    origin: "This lane divides the tropical year into twelve equal 30° sectors, following the zodiacal framework developed in Babylonian astronomy and adopted by Hellenistic astrologers.",
    usedSince: "A standardized twelve-sign zodiac is attested in Babylonia by the 5th century BCE and was elaborated in the Hellenistic world.",
    curious: "A tropical sign is anchored to the equinoxes and solstices, so precession slowly separates it from the same-named star constellation.",
  },
  "wuku-tzolkin": {
    origin: "Two independent sacred/social counts share this visual speed band: the Javanese-Balinese Pawukon and the Maya 260-day Tzolk'in.",
    usedSince: "The Maya 260-day count is attested in Mesoamerica before the Common Era. Pawukon has deep Javanese-Balinese roots and remains culturally active.",
    curious: "The Maya count interlocks 20 day names with 13 numbers; Pawukon layers ten simultaneous week cycles inside a repeating 210-day whole.",
  },
  moon: {
    origin: "A synodic month measures the Moon's repeating phase relationship with the Sun, one of humanity's oldest visible clocks.",
    usedSince: "Lunar phase tallies appear in prehistoric artifacts; written lunar calendars are documented in early Mesopotamia and many other ancient cultures.",
    curious: "The phase cycle averages about 29.53 days, while the Moon returns to the same stars in only about 27.32 days—the Sun moved meanwhile.",
  },
  pancawara: {
    origin: "Pancawara is the five-day market week of the Javanese-Balinese calendrical family, with each day carrying a traditional name and social quality.",
    usedSince: "Its exact beginning is not recoverable; it is inherited through the old Javanese and Balinese Pawukon traditions and remains in use.",
    curious: "Pancawara meets the seven-day week every 35 days; in Javanese practice that pairing helps identify a person's weton.",
  },
  day: {
    origin: "The physical day comes from Earth's rotation; the civil day turns that changing solar motion into a shared social count.",
    usedSince: "Day-counting predates writing. The twenty-four-part day traces through ancient Egyptian hour systems and later Hellenistic astronomy.",
    curious: "Apparent solar days are not perfectly equal. Mechanical clocks keep a mean solar day, smoothing seasonal variation caused by Earth's orbit and tilt.",
  },
  shi: {
    origin: "Traditional Chinese time divided the day into twelve shí, each named for an Earthly Branch and later paired with its zodiac animal.",
    usedSince: "The branch cycle is ancient and the twelve double-hour system is firmly attested in imperial China, including the Han era.",
    curious: "The Zǐ hour straddles midnight, roughly 11 p.m.–1 a.m.; therefore a named shí does not begin on the modern even-hour boundary everywhere.",
  },
  "planetary-hour": {
    origin: "Hellenistic astrologers assigned daylight and night to seven wandering lights in the repeating Chaldean order, beginning each day with its ruling planet.",
    usedSince: "Planetary-hour schemes are attested in the Greco-Roman world in the early centuries of the Common Era.",
    curious: "The first-hour ruler generates the weekday sequence: Sun-day, Moon-day, Mars-day and so on—the same planetary ancestry survives in many languages.",
  },
  muhurta: {
    origin: "Muhūrta is an Indic division of the day used in astronomy, ritual timing, and electional traditions; a conventional day contains thirty.",
    usedSince: "The term and related divisions occur in ancient Sanskrit literature and were systematized across classical Indian astronomical traditions.",
    curious: "A muhūrta is conventionally 48 modern minutes, but its cultural meaning can depend on sunrise and context rather than a wall-clock timestamp alone.",
  },
  ghati: {
    origin: "Ghaṭī or ghaṭikā is an Indic time unit associated with water clocks: sixty ghaṭī complete a day, making each about 24 modern minutes.",
    usedSince: "Water-clock timekeeping is described in classical Indian sources and ghaṭī remained practical into medieval and early-modern South Asia.",
    curious: "A common device was a small bowl with a calibrated hole; the bowl sank when full, physically turning flowing water into elapsed time.",
  },
  min: {
    origin: "The minute is the Latin pars minuta prima—the first small part—created by applying inherited Babylonian base-60 fractions to an hour.",
    usedSince: "Ptolemy used sexagesimal first fractions in the 2nd century CE; minutes became everyday clock readings as precision clocks and minute hands spread after the late Middle Ages.",
    curious: "Minute originally meant a mathematical fraction, not necessarily a displayed clock unit; early public clocks often had only an hour hand.",
  },
  pala: {
    origin: "Pala, also called vighaṭī in timekeeping contexts, subdivides the Indic ghaṭī: sixty pala make one ghaṭī.",
    usedSince: "It belongs to classical and medieval Indian astronomical time-reckoning, though exact historical values could vary by text and locality.",
    curious: "Under the common 60-ghaṭī day convention, one pala equals 24 modern seconds—an ancient rung between our minute and second.",
  },
  prana: {
    origin: "Prāṇa means breath or vital breath; some Indic time systems used one respiration as a small unit, conventionally six prāṇa to a pala.",
    usedSince: "Breath-based measures occur in classical Indian astronomical and yogic traditions; Delphi uses the common approximate four-second convention.",
    curious: "It joins body and clock directly: six measured breaths form a pala, so physiology becomes the metaphor and instrument of subdivision.",
  },
  helek: {
    origin: "The Hebrew ḥeleq—'part'—is the fine unit used in traditional Jewish molad arithmetic: 1/1080 of an hour.",
    usedSince: "The system preserves ancient Near Eastern sexagesimal mathematics and is documented in medieval Jewish calendrical calculation.",
    curious: "There are exactly 18 ḥalakim in a modern minute and 76 rega'im in one ḥeleq; 1080 is useful because it has many divisors.",
  },
  sec: {
    origin: "The second is the Latin pars minuta secunda—the second small part of an hour—built by dividing an hour by 60, then dividing that result by 60 again.",
    usedSince: "Ptolemy used sexagesimal second fractions in the 2nd century CE. Seconds became practical clock units in the 16th–17th centuries and an SI base unit in 1960.",
    curious: "Since 1967, one SI second is not defined by the Sun: it is exactly 9,192,631,770 transitions of the caesium-133 atom.",
  },
  ms: {
    origin: "A millisecond is the metric prefix milli—one thousandth—applied to the SI second.",
    usedSince: "The prefix was created with the metric system in the late 18th century; milliseconds became everyday engineering units with electrical and electronic timing.",
    curious: "Light travels almost 300 kilometres in one millisecond, while a 60 Hz screen frame lasts about 16.7 milliseconds.",
  },
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
 * Compute moving lanes + slow-sky cluster for `date` at lat/lon.
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

  // Muhūrta — 30 × 48 min from local midnight in the site timezone (not host TZ).
  const muhTotal =
    (hour * 60 + minute + second / 60 + ms / 60_000) / MUHURTA_MINUTES;
  const muhIndex = Math.floor(mod(muhTotal, MUHURTA_COUNT));
  const muhProg = mod(muhTotal, 1);

  // Shí — 2 h cells; Zi straddles 23:00–01:00.
  const shiIndex = Math.floor(((hour + 1) % 24) / 2) % 12;
  const shiProg = mod((hour + 1) % 24, 2) / 2
    + (minute + second / 60 + ms / 60_000) / 120;

  // Planetary hour — equal civil hours (matches resolveMoment Chaldean cascade).
  const phIndex = CHALDEAN.indexOf(meta.planetaryHour as (typeof CHALDEAN)[number]);
  const phProg = (minute + second / 60 + ms / 60_000) / 60;

  // Moon phase — 8 equal synodic sectors, named phase at sector center.
  // progress = fraction elapsed through the current sector's true boundaries.
  const moonFloat = (((meta.moonPhase * 360) + 22.5) % 360) / 45;
  const moonIndex = Math.floor(moonFloat) % 8;
  const moonProg = moonFloat - Math.floor(moonFloat);

  // Solar season — 30° tropical-longitude cells (true ecliptic boundaries).
  const seasonIndex = Math.floor(meta.sunTropicalDeg / 30) % 12;
  const seasonProg = (meta.sunTropicalDeg % 30) / 30;
  const wukuIndex = Math.max(0, meta.wuku - 1);
  const civilDay = Math.floor(jd + 0.5);
  const pawukon = mod(civilDay - 2451545, 210);
  const wukuProg = (pawukon % 7) / 7 + dayFrac / 7;
  const pancaIndex = Math.max(0, meta.pancawara - 1);
  const pancaProg = dayFrac; // advances with the civil day

  // Ghati — 60 × 24 min from local sunrise (not midnight).
  const solarToday = computeSolarDayEvents(date, lat, lon);
  let sunrise = solarToday.sunrise;
  if (date.getTime() < sunrise.getTime()) {
    const prevDay = new Date(date.getTime() - 86_400_000);
    sunrise = computeSolarDayEvents(prevDay, lat, lon).sunrise;
  }
  const ghatiFloat = (date.getTime() - sunrise.getTime()) / GHATI_MS;
  const ghatiIndex = Math.floor(mod(ghatiFloat, 60));
  const ghatiProg = mod(ghatiFloat, 1);

  // Gregorian year and month
  const calParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const calGet = (t: string) => Number(calParts.find(p => p.type === t)?.value ?? 0);
  const calYear = calGet("year");
  const calMonth = calGet("month"); // 1-12
  const calDay = calGet("day");
  const daysThisMonth = new Date(calYear, calMonth, 0).getDate();
  const monthProg = (calDay - 1 + dayFrac) / daysThisMonth;

  const MONTH_NAMES = ["January","February","March","April","May","June",
    "July","August","September","October","November","December"];
  const monthCells = MONTH_NAMES.map((n, i) => ({ id: `mo-${i+1}`, label: n }));

  // Year lane: decade-scale, 10 years visible
  const yearStart = Math.floor(calYear / 10) * 10;
  const yearCells = Array.from({ length: 10 }, (_, i) => ({
    id: `yr-${yearStart + i}`,
    label: String(yearStart + i),
  }));
  const yearInDecade = calYear - yearStart;
  const yearProg = (calMonth - 1 + (calDay - 1) / daysThisMonth) / 12;

  // Display order: north (slow) → south (fast). speedT 1 = blue/north, 0 = red/south.
  const lanesNorthToSouth: OrreryLaneState[] = [
    {
      id: "year",
      name: "Year",
      cycle: "10 years",
      tier: "display",
      speedT: 1.08,
      index: yearInDecade,
      progress: yearProg,
      cells: yearCells,
      activeLabel: String(calYear),
      lore: "The Gregorian calendar year — ten years in view, so you can feel where this year sits in its decade.",
    },
    {
      id: "month",
      name: "Month",
      cycle: "12 months",
      tier: "display",
      speedT: 1.04,
      index: calMonth - 1,
      progress: monthProg,
      cells: monthCells,
      activeLabel: MONTH_NAMES[calMonth - 1] ?? "—",
      lore: "The civil calendar month. Twelve Gregorian months advancing left as the year moves.",
    },
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
      lore: "The tropical year cut into twelve 30° signs. Celebrated Hellenistic season — one of several ways a sky can be named, not the only one.",
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
      lore: "Javanese pawukon week beside the Maya 260-day count. Two independent calendars sharing this row because both move slower than the moon.",
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
      lore: "Eight equal synodic sectors of the real moon. Measured light — the face you can see, not a personality.",
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
      lore: "The Javanese five-day market week. Celebrated social time, not a measured orbit.",
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
      lore: "Twenty-four civil hours of this place. The measured day-arc — light, not a named quality.",
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
      lore: "Twelve double-hours named by earthly branch. Zi straddles midnight. Celebrated Chinese civil time.",
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
      lore: "Chaldean planetary hours — each civil hour named for a wandering star in the ancient cascade. Celebrated rulership, not a spectrograph.",
    },
    {
      id: "muhurta",
      name: "Muhūrta",
      cycle: "~48 min",
      tier: "celebrated",
      speedT: 0.36,
      index: muhIndex,
      progress: muhProg,
      cells: muhCells,
      activeLabel: muhCells[muhIndex]?.label ?? `Muhūrta ${muhIndex + 1}`,
      source: byId(`muh-${String(muhIndex + 1).padStart(2, "0")}`)?.source,
      lore: "Thirty muhūrta of about forty-eight minutes. The auspicious unit of the Indic day — quality-bearing, celebrated.",
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
      source: "Vedic ghati — 60 × ~24 min from local sunrise (not midnight)",
      lore: "The water-clock mark of the Indic day: sixty ghaṭi from sunrise, each about twenty-four minutes. Display pulse — it measures light, it does not name a mood.",
    },
    {
      id: "min",
      name: "Minutes",
      cycle: "60 min",
      tier: "display",
      speedT: 0.2,
      index: minute,
      progress: (second + ms / 1000) / 60,
      cells: Array.from({ length: 60 }, (_, i) => ({
        id: `m-${i}`,
        label: String(i).padStart(2, "0"),
      })),
      activeLabel: `${String(minute).padStart(2, "0")}m`,
      lore: "Ptolemy's first small part of the hour — sixty of them make the civil hour you already know.",
    },
    {
      id: "pala",
      name: "Pala",
      cycle: "~24 s",
      tier: "display",
      speedT: 0.16,
      index: Math.floor(mod(ghatiProg * 60, 60)),
      progress: mod(ghatiProg * 60, 1),
      cells: Array.from({ length: 60 }, (_, i) => ({
        id: `pa-${i}`,
        label: `P ${i + 1}`,
      })),
      activeLabel: `Pala ${Math.floor(mod(ghatiProg * 60, 60)) + 1}`,
      source: "Vedic pala / vighaṭi — 1/60 of a ghaṭi ≈ 24 s, counted from sunrise",
      lore: "The older cousin of the minute: sixty pala fill one ghaṭi. Between the civil minute and the civil second, this is how the Indic day subdivides the ghaṭi.",
    },
    {
      id: "prana",
      name: "Prāṇa",
      cycle: "~4 s",
      tier: "display",
      speedT: 0.13,
      index: Math.floor(mod((date.getTime() - sunrise.getTime()) / PRANA_MS, 6)),
      progress: mod((date.getTime() - sunrise.getTime()) / PRANA_MS, 1),
      cells: Array.from({ length: 6 }, (_, i) => ({
        id: `pr-${i}`,
        label: `Breath ${i + 1}`,
      })),
      activeLabel: `Prāṇa ${Math.floor(mod((date.getTime() - sunrise.getTime()) / PRANA_MS, 6)) + 1}`,
      source: "Vedic prāṇa — a breath, 1/6 of a pala ≈ 4 s from sunrise",
      lore: "A breath: six of them fill a pala. In the sonics it is a tiny warm harmonic pulse — present without drowning the civil second.",
    },
    {
      id: "helek",
      name: "Helek",
      cycle: "3⅓ s",
      tier: "display",
      speedT: 0.11,
      index: Math.floor((second + ms / 1000) / (10 / 3)) % 18,
      progress: mod((second + ms / 1000) / (10 / 3), 1),
      cells: Array.from({ length: 18 }, (_, i) => ({
        id: `hk-${i}`,
        label: String(i + 1),
      })),
      activeLabel: `Helek ${Math.floor((second + ms / 1000) / (10 / 3)) % 18 + 1}`,
      source: "Hebrew ḥeleq — 1/1080 of an hour = 3⅓ s. The molad is stated in these parts.",
      lore: "Eighteen ḥalakim fill a civil minute. This is the Jewish calendar's fine gear — the molad (mean conjunction) is written in days, hours, and ḥalakim, not in SI seconds.",
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
      lore: "The second small part of the hour — SI's base unit, and the pulse you can hear. Display, not a named quality.",
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

  const lanesWithLore = lanesNorthToSouth.map(lane => ({
    ...lane,
    ...LANE_LORE[lane.id],
  }));

  return { lanes: lanesWithLore, slowSky };
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
