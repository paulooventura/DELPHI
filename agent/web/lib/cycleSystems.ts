// ─── Types ────────────────────────────────────────────────────────────────

export type WheelLayer = {
  id: string;
  name: string;
  icon: string;
  label: string;
  sublabel: string;
  angleDeg: number;     // 0-360 current position
  periodDays: number;   // full revolution length in days
  color: string;        // ring stroke color
  category: string;
};

export type WeatherInfo = {
  condition: string;
  emoji: string;
  tempC: number | null;
  windKmh: number | null;
  /** Local forecast emoji per clock hour (0–23) */
  hourly?: Array<{ hour: number; emoji: string; condition: string; tempC: number | null }>;
};

export function weatherCodeToEmoji(code: number): { emoji: string; condition: string } {
  const condition =
    code === 0   ? "Clear sky"
    : code <= 3  ? "Partly cloudy"
    : code <= 9  ? "Foggy"
    : code <= 29 ? "Drizzle"
    : code <= 39 ? "Rain"
    : code <= 49 ? "Snow"
    : code <= 67 ? "Showers"
    : code <= 77 ? "Snow"
    : code <= 82 ? "Rain showers"
    : code <= 86 ? "Snow showers"
    : "Thunderstorm";
  const emoji =
    code === 0   ? "☀️"
    : code <= 3  ? "⛅"
    : code <= 9  ? "🌫️"
    : code <= 39 ? "🌧️"
    : code <= 49 ? "❄️"
    : code <= 67 ? "🌦️"
    : code <= 77 ? "🌨️"
    : "⛈️";
  return { emoji, condition };
}

export type CycleSnapshot = {
  capturedAtMs: number;
  isoDate: string;
  gregorian: {
    weekday: string;
    weekdayShort: string;
    month: string;
    monthShort: string;
    monthNum: number;
    day: number;
    year: number;
    dayOfYear: number;
    weekOfYear: number;
  };
  westernZodiac: { sign: string; symbol: string };
  chineseZodiac: { animal: string; element: string; yinYang: "Yin" | "Yang"; symbol: string };
  tzolkin: { tone: number; sign: string; kin: number };
  mayan: { wavespell: number; castle: number; castleName: string; castleColor: string };
  lunar: { phase: string; emoji: string; fraction: number; angleDeg: number };
  season: { name: string; emoji: string; dayInSeason: number; angleDeg: number };
  weather?: WeatherInfo;
  spectrum: Array<{ name: string; axis: "evidence" | "cultural" | "philosophical"; score: number; note: string }>;
  wheelLayers: WheelLayer[];  // calendar/astronomical only — clock wheels are in the frontend
};

// ─── Constants ────────────────────────────────────────────────────────────

const TZOLKIN_SIGNS = ["Imix","Ik","Akbal","Kan","Chikchan","Kimi","Manik","Lamat","Muluk","Ok","Chuen","Eb","Ben","Ix","Men","Kib","Kaban","Etznab","Kawak","Ajaw"];
const CHINESE_ANIMALS = ["Rat","Ox","Tiger","Rabbit","Dragon","Snake","Horse","Goat","Monkey","Rooster","Dog","Pig"];
const CHINESE_SYMBOLS = ["🐀","🐂","🐅","🐇","🐉","🐍","🐴","🐑","🐒","🐓","🐕","🐖"];
const CHINESE_ELEMENTS = ["Wood","Fire","Earth","Metal","Water"];
const CASTLE_NAMES = ["Red East","White North","Blue West","Yellow South","Green Centre"];
const CASTLE_COLORS = ["#e53e3e","#a0aec0","#4299e1","#d69e2e","#48bb78"];

const ZODIAC = [
  { sign: "Capricorn", symbol: "♑", start: [12, 22] as [number, number] },
  { sign: "Aquarius",  symbol: "♒", start: [1,  20] as [number, number] },
  { sign: "Pisces",    symbol: "♓", start: [2,  19] as [number, number] },
  { sign: "Aries",     symbol: "♈", start: [3,  21] as [number, number] },
  { sign: "Taurus",    symbol: "♉", start: [4,  20] as [number, number] },
  { sign: "Gemini",    symbol: "♊", start: [5,  21] as [number, number] },
  { sign: "Cancer",    symbol: "♋", start: [6,  21] as [number, number] },
  { sign: "Leo",       symbol: "♌", start: [7,  23] as [number, number] },
  { sign: "Virgo",     symbol: "♍", start: [8,  23] as [number, number] },
  { sign: "Libra",     symbol: "♎", start: [9,  23] as [number, number] },
  { sign: "Scorpio",   symbol: "♏", start: [10, 23] as [number, number] },
  { sign: "Sagittarius", symbol: "♐", start: [11, 22] as [number, number] },
];

// ─── Date helpers ─────────────────────────────────────────────────────────

function getDayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const now   = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

function getWeekOfYear(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - y0.getTime()) / 86400000) + 1) / 7);
}

// ─── Cycle calculators ───────────────────────────────────────────────────

function getZodiac(month: number, day: number) {
  for (let i = ZODIAC.length - 1; i >= 0; i--) {
    const [m, d] = ZODIAC[i].start;
    if (month > m || (month === m && day >= d)) return ZODIAC[i];
  }
  return ZODIAC[0]; // Capricorn fallback
}

function getChineseZodiac(year: number) {
  const cycle = (year - 1984 + 120) % 60;
  const animalIdx = cycle % 12;
  return {
    animal: CHINESE_ANIMALS[animalIdx],
    element: CHINESE_ELEMENTS[Math.floor((cycle % 10) / 2)],
    yinYang: (cycle % 2 === 0 ? "Yang" : "Yin") as "Yang" | "Yin",
    symbol: CHINESE_SYMBOLS[animalIdx],
  };
}

function getTzolkin(date: Date) {
  const anchor = new Date(Date.UTC(2024, 6, 26)); // Kin 1 anchor
  const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = Math.floor((current.getTime() - anchor.getTime()) / 86400000);
  const kin  = ((diff % 260) + 260) % 260 + 1;
  const tone = ((kin - 1) % 13) + 1;
  const sign = TZOLKIN_SIGNS[(kin - 1) % 20];
  return { tone, sign, kin };
}

function getMayan(kin: number) {
  const wavespell  = Math.ceil(kin / 13);
  const castle     = Math.ceil(kin / 52);
  const castleName = CASTLE_NAMES[castle - 1] ?? "Green Centre";
  const castleColor = CASTLE_COLORS[castle - 1] ?? "#48bb78";
  return { wavespell, castle, castleName, castleColor };
}

const KNOWN_NEW_MOON = new Date("2000-01-06T18:14:00Z");
const SYNODIC = 29.530588853;
const MOON_EMOJIS: [number, string, string][] = [
  [0.0625, "New Moon",        "🌑"],
  [0.1875, "Waxing Crescent", "🌒"],
  [0.3125, "First Quarter",   "🌓"],
  [0.4375, "Waxing Gibbous",  "🌔"],
  [0.5625, "Full Moon",       "🌕"],
  [0.6875, "Waning Gibbous",  "🌖"],
  [0.8125, "Last Quarter",    "🌗"],
  [1.0000, "Waning Crescent", "🌘"],
];

function getLunar(date: Date) {
  const elapsed  = (date.getTime() - KNOWN_NEW_MOON.getTime()) / 86400000;
  const fraction = ((elapsed % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
  const angleDeg = fraction * 360;
  const found = MOON_EMOJIS.find(([t]) => fraction < t) ?? MOON_EMOJIS[MOON_EMOJIS.length - 1];
  return { fraction, angleDeg, phase: found[1], emoji: found[2] };
}

const SEASON_DEFS: Array<[number, number, string, string]> = [
  // dayStart, dayEnd, name, emoji
  [79,  172, "Spring", "🌸"],
  [172, 266, "Summer", "☀️"],
  [266, 355, "Autumn", "🍂"],
];

function getSeason(dayOfYear: number) {
  const def = SEASON_DEFS.find(([s, e]) => dayOfYear >= s && dayOfYear < e);
  if (!def) {
    const dayInSeason = dayOfYear >= 355 ? dayOfYear - 355 : dayOfYear;
    return { name: "Winter", emoji: "❄️", dayInSeason, angleDeg: (dayInSeason / 88) * 360 };
  }
  const [s, e, name, emoji] = def;
  const len = e - s;
  const dayInSeason = dayOfYear - s;
  return { name, emoji, dayInSeason, angleDeg: (dayInSeason / len) * 360 };
}

// ─── Wheel layer builder (calendar/astronomical, no clock) ────────────────
// Order from inner to outer matches user spec:
// day > kin > chinese sign > wavespell > castle > moon > chinese month >
// gregorian month > zodiac sign > season > chinese year > gregorian year

function buildWheelLayers(
  date: Date,
  dayOfYear: number,
  tzolkin: ReturnType<typeof getTzolkin>,
  mayan: ReturnType<typeof getMayan>,
  lunar: ReturnType<typeof getLunar>,
  season: ReturnType<typeof getSeason>,
  chineseZodiac: ReturnType<typeof getChineseZodiac>,
  westernZodiac: ReturnType<typeof getZodiac>,
): WheelLayer[] {
  const year  = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day   = date.getUTCDate();

  // position within current zodiac sign (0-360 within ~30-day sign)
  const zodiacSignStart = ZODIAC.find(z => z.sign === westernZodiac.sign)?.start ?? [1, 1];
  const signStartDoy    = getDayOfYear(new Date(Date.UTC(year, zodiacSignStart[0] - 1, zodiacSignStart[1])));
  const dayInSign       = (dayOfYear - signStartDoy + 365) % 365;
  const zodiacAngle     = (dayInSign / 30.44) * 360;

  // Chinese 60-year cycle position
  const chineseCyclePos = ((year - 1984 + 120) % 60) / 60;
  // Chinese animal 12-year position
  const chineseAnimalPos = ((year - 1984 + 120) % 12) / 12;

  return [
    { id: "day",           name: "Day",            icon: "🕒", label: date.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }),            sublabel: `D${dayOfYear}`,               angleDeg: (date.getUTCDay() / 7) * 360,                    periodDays: 7,       color: "#4d8bff", category: "nature" },
    { id: "kin",           name: "Kin",            icon: "🧭", label: `Kin ${tzolkin.kin}`,                                                            sublabel: tzolkin.sign,                  angleDeg: ((tzolkin.kin - 1) / 260) * 360,                 periodDays: 260,     color: "#7c3aed", category: "mayan" },
    { id: "chinese-sign",  name: "Chinese Sign",   icon: "🐉", label: `${chineseZodiac.symbol} ${chineseZodiac.animal}`,                               sublabel: `12-yr cycle`,                 angleDeg: chineseAnimalPos * 360,                           periodDays: 4383,    color: "#dc2626", category: "chinese" },
    { id: "wavespell",     name: "Wavespell",      icon: "🌊", label: `Tone ${tzolkin.tone}`,                                                          sublabel: `Wave ${mayan.wavespell}`,      angleDeg: ((tzolkin.tone - 1) / 13) * 360,                 periodDays: 13,      color: "#6366f1", category: "mayan" },
    { id: "castle",        name: "Castle",         icon: "🏰", label: mayan.castleName,                                                                sublabel: `Castle ${mayan.castle}/5`,     angleDeg: (((tzolkin.kin - 1) % 52) / 52) * 360,           periodDays: 52,      color: mayan.castleColor, category: "mayan" },
    { id: "moon",          name: "Moon",           icon: "🌙", label: `${lunar.emoji} ${lunar.phase}`,                                                 sublabel: `${(lunar.fraction * 100).toFixed(0)}%`, angleDeg: lunar.angleDeg,                         periodDays: SYNODIC, color: "#94a3b8", category: "lunar" },
    { id: "chinese-month", name: "Chinese Month",  icon: "📅", label: `Lunar M${(Math.floor(lunar.fraction * 12) % 12) + 1}`,                          sublabel: "Lunar month",                  angleDeg: (((lunar.fraction * 12) % 1)) * 360,              periodDays: SYNODIC, color: "#f43f5e", category: "chinese" },
    { id: "greg-month",    name: "Month",          icon: "🗓️", label: date.toLocaleDateString("en", { month: "short", timeZone: "UTC" }),               sublabel: `Day ${day}`,                   angleDeg: ((month - 1 + (day / 30)) / 12) * 360,            periodDays: 30.44,   color: "#0891b2", category: "western" },
    { id: "zodiac",        name: "Zodiac",         icon: "✨", label: `${westernZodiac.symbol} ${westernZodiac.sign}`,                                  sublabel: "Sign cycle",                   angleDeg: zodiacAngle % 360,                                periodDays: 30.44,   color: "#f97316", category: "western" },
    { id: "season",        name: "Season",         icon: "🍃", label: `${season.emoji} ${season.name}`,                                                 sublabel: `Day ${season.dayInSeason}`,    angleDeg: season.angleDeg,                                  periodDays: 91.3,    color: "#22c55e", category: "nature" },
    { id: "chinese-year",  name: "Chinese Year",   icon: "🧧", label: `${chineseZodiac.element} ${chineseZodiac.animal}`,                               sublabel: "60-yr cycle",                  angleDeg: chineseCyclePos * 360,                            periodDays: 21915,   color: "#b91c1c", category: "chinese" },
    { id: "greg-year",     name: "Year",           icon: "📆", label: String(year),                                                                     sublabel: `Day ${dayOfYear}/365`,          angleDeg: (dayOfYear / 365.25) * 360,                       periodDays: 365.25,  color: "#1e40af", category: "western" },
  ];
}

// ─── Main export ──────────────────────────────────────────────────────────

export function getCycleSnapshot(input?: Date, weather?: WeatherInfo): CycleSnapshot {
  const date      = input ?? new Date();
  const month     = date.getUTCMonth() + 1;
  const day       = date.getUTCDate();
  const year      = date.getUTCFullYear();
  const dayOfYear = getDayOfYear(date);
  const weekOfYear = getWeekOfYear(date);

  const tzolkin      = getTzolkin(date);
  const mayan        = getMayan(tzolkin.kin);
  const lunar        = getLunar(date);
  const season       = getSeason(dayOfYear);
  const chineseZodiac = getChineseZodiac(year);
  const westernZodiac = getZodiac(month, day);

  const spectrum: CycleSnapshot["spectrum"] = [
    { name: "Gregorian",       axis: "evidence",      score: 0.97, note: "Astronomical/civil standard, internationally verified." },
    { name: "Moon Phase",      axis: "evidence",      score: 0.94, note: "Computed from Synodic period — precise to within hours." },
    { name: "Chinese Zodiac",  axis: "cultural",      score: 0.71, note: "4,000-year cultural continuity with agricultural and astronomic roots." },
    { name: "Tzolkin (Mayan)", axis: "cultural",      score: 0.64, note: "260-day ceremonial cycle with strong anthropological record." },
    { name: "Wavespell",       axis: "philosophical", score: 0.52, note: "13-energy symbolic wave; reflective patterning tool." },
    { name: "Castle",          axis: "philosophical", score: 0.48, note: "52-day Mayan fractal; used for intentional orientation." },
    { name: "Western Zodiac",  axis: "philosophical", score: 0.44, note: "Archetypal lens; cultural depth, not predictive." },
  ];

  return {
    capturedAtMs: date.getTime(),
    isoDate: date.toISOString().slice(0, 10),
    gregorian: {
      weekday: date.toLocaleDateString("en", { weekday: "long", timeZone: "UTC" }),
      weekdayShort: date.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }),
      month: date.toLocaleDateString("en", { month: "long", timeZone: "UTC" }),
      monthShort: date.toLocaleDateString("en", { month: "short", timeZone: "UTC" }),
      monthNum: month,
      day,
      year,
      dayOfYear,
      weekOfYear,
    },
    westernZodiac,
    chineseZodiac,
    tzolkin,
    mayan,
    lunar,
    season,
    weather,
    spectrum,
    wheelLayers: buildWheelLayers(date, dayOfYear, tzolkin, mayan, lunar, season, chineseZodiac, westernZodiac),
  };
}
