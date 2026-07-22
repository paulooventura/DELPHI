import { buildCycleContext, type CycleContextOptions } from "./context";
import { getPlugin, listPlugins } from "./registry";
import type { CycleReading, WorldCycleSnapshot } from "./types";

export type ResolveOptions = CycleContextOptions & {
  /** If set, only these system ids are resolved (order preserved). */
  enabledIds?: string[];
  date?: Date;
};

export function resolveWorldCycles(opts: ResolveOptions = {}): WorldCycleSnapshot {
  const date = opts.date ?? new Date();
  const context = buildCycleContext(date, opts);
  const plugins = opts.enabledIds?.length
    ? opts.enabledIds.map((id) => getPlugin(id)).filter(Boolean)
    : listPlugins();

  const readings: CycleReading[] = [];
  for (const plugin of plugins) {
    if (!plugin) continue;
    try {
      readings.push(plugin.resolve(context));
    } catch {
      /* skip broken plugin for resilience */
    }
  }

  const byId: Record<string, CycleReading> = {};
  for (const r of readings) byId[r.systemId] = r;

  const y = context.localYear;
  const m = String(context.localMonth).padStart(2, "0");
  const d = String(context.localDay).padStart(2, "0");

  return {
    capturedAtMs: date.getTime(),
    isoDate: `${y}-${m}-${d}`,
    context,
    readings,
    byId,
  };
}
