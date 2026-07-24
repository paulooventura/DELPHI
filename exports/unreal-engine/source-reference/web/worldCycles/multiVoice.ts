import type { CycleReading, WorldCycleSnapshot } from "./types";

const NOW_STRIP_ORDER = [
  "gregorian",
  "hijri",
  "hebrew",
  "persian",
  "chinese_lunisolar",
  "maya_tzolkin",
  "tropical_zodiac",
  "lunar_phase",
  "ethiopian",
  "galactic_1320",
];

/** Short Palatina-friendly multi-voice paragraph from enabled systems. */
export function synthesizeMultiVoice(world: WorldCycleSnapshot, enabledIds?: string[]): string {
  const ids = enabledIds?.length ? enabledIds : NOW_STRIP_ORDER;
  const bits: string[] = [];
  for (const id of ids) {
    const r = world.byId[id];
    if (!r) continue;
    bits.push(voiceBit(r));
    if (bits.length >= 6) break;
  }
  if (!bits.length) return "The registries are quiet — enable a pack in Atlas to hear the planet speak.";
  if (bits.length === 1) return `Right now: ${bits[0]}.`;
  const head = bits.slice(0, -1).join("; ");
  const tail = bits[bits.length - 1];
  return `Right now across the planet: ${head}; and ${tail}.`;
}

function voiceBit(r: CycleReading): string {
  switch (r.systemId) {
    case "gregorian":
      return `civil day is ${r.primary}`;
    case "hijri":
      return `Hijri reads ${r.primary}`;
    case "hebrew":
      return `Hebrew calendar says ${r.primary}`;
    case "persian":
      return `Persian solar is ${r.primary}`;
    case "ethiopian":
      return `Ethiopian marks ${r.primary}`;
    case "chinese_lunisolar":
      return `Chinese lunisolar is ${r.primary}`;
    case "maya_tzolkin":
      return `Tzolk’in is ${r.primary}`;
    case "galactic_1320":
      return `13:20 names ${r.primary}`;
    case "tropical_zodiac":
      return `the Sun sits in ${r.primary}`;
    case "lunar_phase":
      return `the Moon is ${r.primary}`;
    case "chinese_year":
      return `the year animal is ${r.primary}`;
    default:
      return `${r.title}: ${r.primary}`;
  }
}

export function nowStripReadings(world: WorldCycleSnapshot, enabledIds?: string[]): CycleReading[] {
  const order = NOW_STRIP_ORDER.filter((id) => !enabledIds || enabledIds.includes(id));
  return order.map((id) => world.byId[id]).filter(Boolean) as CycleReading[];
}
