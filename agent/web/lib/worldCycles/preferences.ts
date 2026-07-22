import { ATLAS_PRESETS } from "./presets";

const STORAGE_KEY = "delphi.worldCycles.v1";

export type WorldCyclePreferences = {
  enabledIds: string[];
  presetId: string | null;
  mayaCorrelation: "delphi_kin1" | "gmt_584283";
  ayanamsa: "lahiri" | "fagan_bradley";
};

export function defaultPreferences(defaultEnabledIds: string[]): WorldCyclePreferences {
  const planet = ATLAS_PRESETS.find((p) => p.id === "planet");
  return {
    enabledIds: planet ? [...planet.systemIds] : [...defaultEnabledIds],
    presetId: "planet",
    mayaCorrelation: "delphi_kin1",
    ayanamsa: "lahiri",
  };
}

export function loadPreferences(defaultEnabledIds: string[]): WorldCyclePreferences {
  const fallback = defaultPreferences(defaultEnabledIds);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WorldCyclePreferences>;
    return {
      enabledIds: Array.isArray(parsed.enabledIds) ? parsed.enabledIds.map(String) : fallback.enabledIds,
      presetId: typeof parsed.presetId === "string" || parsed.presetId === null ? parsed.presetId : fallback.presetId,
      mayaCorrelation: parsed.mayaCorrelation === "gmt_584283" ? "gmt_584283" : "delphi_kin1",
      ayanamsa: parsed.ayanamsa === "fagan_bradley" ? "fagan_bradley" : "lahiri",
    };
  } catch {
    return fallback;
  }
}

export function savePreferences(prefs: WorldCyclePreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}
