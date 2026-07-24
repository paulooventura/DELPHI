import type { CyclePlugin } from "../types";

const TZOLKIN_SIGNS = [
  "Imix", "Ik", "Akbal", "Kan", "Chikchan", "Kimi", "Manik", "Lamat", "Muluk", "Ok",
  "Chuen", "Eb", "Ben", "Ix", "Men", "Kib", "Kaban", "Etznab", "Kawak", "Ajaw",
];

/** JDN of the Unix epoch (1970-01-01), so a civil day count converts to a Julian Day Number. */
const JDN_UNIX_EPOCH = 2440588;

/** Classic GMT correlation: JDN 584283 = Long Count 0.0.0.0.0 (4 Ajaw 8 Kumk'u). */
const GMT_JD_EPOCH = 584283;

/**
 * DELPHI numbers the 260-day round from 1 Imix = kin 1 (the standard "1 Imix start").
 * Under that numbering the GMT epoch's 4 Ajaw is kin 160, so the day-count offset that
 * maps mayaDay 0 → kin 160 is (160 - 1) = 159. (An earlier version used 160, pushing every
 * day one kin late.) Kept as a named constant with its derivation so it can't silently drift.
 */
const GMT_EPOCH_KIN = 160; // 4 Ajaw in the 1-Imix numbering
const GMT_KIN_OFFSET = GMT_EPOCH_KIN - 1; // 159

/** Days (UTC-midnight based) since 1970-01-01 for a civil Y/M/D. */
function civilDayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** Julian Day Number for a civil calendar date (day-counts use the calendar day, not the instant). */
function civilJdn(y: number, m: number, d: number): number {
  return civilDayNumber(y, m, d) + JDN_UNIX_EPOCH;
}

/** DELPHI's own Kin-1 anchor (2024-07-26) — an app convention, NOT an astronomical correlation. */
const DELPHI_ANCHOR_DAY = civilDayNumber(2024, 7, 26);

/** Maya Long Count b.k.t.w.k string from days elapsed since 0.0.0.0.0. */
function formatLongCount(daysSinceCreation: number): string {
  let r = daysSinceCreation;
  const baktun = Math.floor(r / 144000);
  r -= baktun * 144000;
  const katun = Math.floor(r / 7200);
  r -= katun * 7200;
  const tun = Math.floor(r / 360);
  r -= tun * 360;
  const winal = Math.floor(r / 20);
  const kinLc = r - winal * 20;
  return `${baktun}.${katun}.${tun}.${winal}.${kinLc}`;
}

/** tone, sign, wavespell and castle all derive from the SAME kin — they cannot disagree. */
function kinParts(kin: number) {
  return {
    tone: ((kin - 1) % 13) + 1,
    sign: TZOLKIN_SIGNS[(kin - 1) % 20]!,
    wavespell: Math.ceil(kin / 13),
    castle: Math.ceil(kin / 52),
  };
}

/**
 * Canonical Tzolk'in — GMT 584283 correlation, the astronomically/historically grounded
 * count that reproduces the Long Count and the eclipse record. This is the "true to the
 * math" member of the Maya day-count family; other anchors are represented alongside it
 * but only this one is flagged canonical.
 */
export const tzolkinPlugin: CyclePlugin = {
  id: "maya_tzolkin",
  title: "Tzolk’in",
  family: "calendar",
  tier: "A",
  region: ["mesoamerica"],
  color: "#7c3aed",
  icon: "🧭",
  category: "mayan",
  defaultEnabled: true,
  resolve(ctx) {
    // Day-counts are calendar days, not moments — resolve on the LOCAL civil date.
    const mayaDay = civilJdn(ctx.localYear, ctx.localMonth, ctx.localDay) - GMT_JD_EPOCH;
    const kin = (((mayaDay + GMT_KIN_OFFSET) % 260) + 260) % 260 + 1;
    const longCount = formatLongCount(mayaDay);
    const { tone, sign, wavespell, castle } = kinParts(kin);
    return {
      systemId: "maya_tzolkin",
      title: "Tzolk’in",
      primary: `Kin ${kin} · ${tone} ${sign}`,
      secondary: `LC ${longCount} · Wavespell ${wavespell} · Castle ${castle}/5 · GMT 584283 (canonical)`,
      angleDeg: ((kin - 1) / 260) * 360,
      periodDays: 260,
      meta: {
        kin,
        tone,
        sign,
        wavespell,
        castle,
        longCount,
        correlation: "gmt_584283",
        canonical: true,
      },
      accuracy: "arithmetical",
      claim: "convention",
      canonical: true,
      sources: [
        "GMT correlation 584283 — reproduces the Long Count (0.0.0.0.0 = 4 Ajaw) and the eclipse record.",
      ],
      family: "calendar",
      tier: "A",
      region: ["mesoamerica"],
      color: "#7c3aed",
      icon: "🧭",
      category: "mayan",
    };
  },
};

/**
 * DELPHI Kin-1 anchor Tzolk'in — the same 260-day round counted from an app-chosen anchor
 * (2024-07-26 = Kin 1). Represented as a peer so nothing is hidden, but explicitly NOT
 * canonical: it doesn't tie to the Long Count and disagrees with the GMT count by design.
 */
export const tzolkinDelphiPlugin: CyclePlugin = {
  id: "maya_tzolkin_delphi",
  title: "Tzolk’in · DELPHI anchor",
  family: "calendar",
  tier: "B",
  region: ["mesoamerica"],
  color: "#a78bfa",
  icon: "📍",
  category: "mayan",
  defaultEnabled: false,
  resolve(ctx) {
    const diff = civilDayNumber(ctx.localYear, ctx.localMonth, ctx.localDay) - DELPHI_ANCHOR_DAY;
    const kin = ((diff % 260) + 260) % 260 + 1;
    const { tone, sign, wavespell, castle } = kinParts(kin);
    return {
      systemId: "maya_tzolkin_delphi",
      title: "Tzolk’in · DELPHI anchor",
      primary: `Kin ${kin} · ${tone} ${sign}`,
      secondary: `Wavespell ${wavespell} · Castle ${castle}/5 · DELPHI Kin-1 anchor (2024-07-26)`,
      angleDeg: ((kin - 1) / 260) * 360,
      periodDays: 260,
      meta: {
        kin,
        tone,
        sign,
        wavespell,
        castle,
        correlation: "delphi_kin1",
        canonical: false,
      },
      accuracy: "arithmetical",
      claim: "convention",
      canonical: false,
      sources: ["DELPHI Kin-1 anchor 2024-07-26 — an app convention, not the astronomical GMT correlation."],
      family: "calendar",
      tier: "B",
      region: ["mesoamerica"],
      color: "#a78bfa",
      icon: "📍",
      category: "mayan",
    };
  },
};
