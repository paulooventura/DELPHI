import type { CyclePlugin } from "./types";
import { chineseLunisolarPlugin } from "./plugins/chineseLunisolar";
import { chineseYearPlugin } from "./plugins/chineseYear";
import { ethiopianPlugin } from "./plugins/ethiopian";
import { galactic1320Plugin } from "./plugins/galactic1320";
import { gregorianPlugin } from "./plugins/gregorian";
import { hebrewPlugin } from "./plugins/hebrew";
import { hijriPlugin } from "./plugins/hijri";
import { lunarPlugin } from "./plugins/lunar";
import { persianPlugin } from "./plugins/persian";
import { tropicalPlugin } from "./plugins/tropical";
import { tzolkinPlugin } from "./plugins/tzolkin";

/** Canonical plugin registry — single source for Atlas / Clock / Moment. */
export const WORLD_CYCLE_PLUGINS: CyclePlugin[] = [
  gregorianPlugin,
  tropicalPlugin,
  lunarPlugin,
  chineseYearPlugin,
  chineseLunisolarPlugin,
  hijriPlugin,
  hebrewPlugin,
  persianPlugin,
  ethiopianPlugin,
  tzolkinPlugin,
  galactic1320Plugin,
];

const byId = new Map(WORLD_CYCLE_PLUGINS.map((p) => [p.id, p]));

export function getPlugin(id: string): CyclePlugin | undefined {
  return byId.get(id);
}

export function listPlugins(): CyclePlugin[] {
  return [...WORLD_CYCLE_PLUGINS];
}

export function defaultEnabledIds(): string[] {
  return WORLD_CYCLE_PLUGINS.filter((p) => p.defaultEnabled).map((p) => p.id);
}
