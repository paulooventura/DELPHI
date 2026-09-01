"use client";

import { useMemo, useState } from "react";
import {
  ATLAS_PRESETS,
  TIME_SYSTEMS,
  type TimeAnchor,
  type TimeSystemDef,
  type WorldCyclePreferences,
} from "../../lib/worldCycles";

type AnchorFilter = "all" | TimeAnchor;

function pluginId(sys: TimeSystemDef): string {
  return `time_${sys.id}`;
}

export function OnyxTimeCompendium({
  prefs,
  onChange,
}: {
  prefs: WorldCyclePreferences;
  onChange: (next: WorldCyclePreferences) => void;
}) {
  const [filter, setFilter] = useState<AnchorFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    return TIME_SYSTEMS.filter((s) => filter === "all" || s.anchor === filter);
  }, [filter]);

  const applyPack = () => {
    const preset = ATLAS_PRESETS.find((p) => p.id === "time_compendium");
    if (!preset) return;
    onChange({
      ...prefs,
      presetId: "time_compendium",
      enabledIds: [...preset.systemIds],
    });
  };

  const toggle = (id: string) => {
    const on = prefs.enabledIds.includes(id);
    const enabledIds = on
      ? prefs.enabledIds.filter((x) => x !== id)
      : [...prefs.enabledIds, id];
    onChange({ ...prefs, enabledIds, presetId: null });
  };

  return (
    <section className="cp-atlas cp-card onyx-time-compendium" aria-label="Time-unit compendium">
      <div className="cp-card-head">
        <h2 className="cp-card-title">Time units</h2>
      </div>
      <p className="cp-atlas-blurb">
        How a day has been counted below the hour. Filter first by fixed midnight
        vs seasonal sunrise — that axis is the one that breathes.
      </p>

      <div className="onyx-time-filters" role="group" aria-label="Anchor filter">
        {(
          [
            ["all", "All"],
            ["midnight", "Fixed · midnight"],
            ["sunrise", "Seasonal · sunrise"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`onyx-time-filter${filter === id ? " on" : ""}`}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="onyx-time-filter pack" onClick={applyPack}>
          Load Time Compendium pack
        </button>
      </div>

      <ul className="cp-atlas-list">
        {rows.map((sys) => {
          const id = pluginId(sys);
          const enabled = prefs.enabledIds.includes(id);
          const expanded = openId === sys.id;
          const seasonal = sys.anchor === "sunrise";
          return (
            <li
              key={sys.id}
              className={`cp-atlas-row${enabled ? " cp-atlas-row-on" : ""}${seasonal ? " onyx-time-seasonal" : ""}`}
            >
              <button
                type="button"
                className="cp-atlas-toggle"
                aria-expanded={expanded}
                onClick={() => setOpenId(expanded ? null : sys.id)}
                style={{ ["--sys-color" as string]: sys.color }}
              >
                <span className="cp-atlas-toggle-icon" aria-hidden>
                  {sys.icon}
                </span>
                <span className="cp-atlas-toggle-body">
                  <span className="cp-atlas-toggle-title">
                    {sys.title}
                    {sys.native ? ` · ${sys.native}` : ""}
                  </span>
                  <span className="cp-atlas-toggle-meta">
                    {seasonal ? "seasonal · sunrise" : "fixed · midnight"} · {sys.origin} · Tier {sys.tier}
                  </span>
                </span>
                <span className="cp-atlas-toggle-state">{expanded ? "▴" : "▾"}</span>
              </button>
              {expanded ? (
                <div className="onyx-time-body">
                  <p>{sys.purpose}</p>
                  <p className="onyx-time-meta">
                    Era {sys.era}
                    {sys.ancestor ? ` · from ${sys.ancestor}` : ""}
                  </p>
                  <ul className="onyx-time-units">
                    {sys.units.map((u) => (
                      <li key={u.id}>
                        <b>{u.name}</b>
                        {u.native ? ` (${u.native})` : ""} — {u.perDay}/day · {u.gloss}
                      </li>
                    ))}
                  </ul>
                  <p className="onyx-time-src">{sys.sources.join(" · ")}</p>
                  <button
                    type="button"
                    className="onyx-primary-btn"
                    onClick={() => toggle(id)}
                  >
                    {enabled ? "Remove from clock" : "Put on the clock"}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
