import type { AtlasPreset } from "./types";

export const ATLAS_PRESETS: AtlasPreset[] = [
  {
    id: "delphi_classic",
    label: "DELPHI Classic",
    blurb: "Gregorian, tropical, lunar, Chinese year, Tzolk’in, and 13:20.",
    systemIds: [
      "gregorian",
      "tropical_zodiac",
      "lunar_phase",
      "chinese_year",
      "maya_tzolkin",
      "galactic_1320",
    ],
  },
  {
    id: "abrahamic",
    label: "Abrahamic",
    blurb: "Gregorian with Hijri, Hebrew, and Persian solar calendars.",
    systemIds: ["gregorian", "hijri", "hebrew", "persian", "lunar_phase"],
  },
  {
    id: "asia",
    label: "Asia",
    blurb: "Chinese lunisolar with Gregorian and tropical solar season.",
    systemIds: ["gregorian", "chinese_lunisolar", "chinese_year", "tropical_zodiac", "lunar_phase"],
  },
  {
    id: "planet",
    label: "Planet",
    blurb: "Tier A living calendars across the globe — Atlas showcase.",
    systemIds: [
      "gregorian",
      "hijri",
      "hebrew",
      "persian",
      "ethiopian",
      "chinese_lunisolar",
      "maya_tzolkin",
      "galactic_1320",
      "tropical_zodiac",
      "lunar_phase",
    ],
  },
];

export function presetById(id: string): AtlasPreset | undefined {
  return ATLAS_PRESETS.find((p) => p.id === id);
}
