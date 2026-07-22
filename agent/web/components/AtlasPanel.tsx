"use client";

import {
  ATLAS_PRESETS,
  listPlugins,
  type AtlasPresetId,
  type WorldCyclePreferences,
} from "../lib/worldCycles";

export function AtlasPanel({
  prefs,
  onChange,
}: {
  prefs: WorldCyclePreferences;
  onChange: (next: WorldCyclePreferences) => void;
}) {
  const plugins = listPlugins();

  const applyPreset = (id: AtlasPresetId) => {
    const preset = ATLAS_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onChange({
      ...prefs,
      presetId: id,
      enabledIds: [...preset.systemIds],
    });
  };

  const toggleSystem = (id: string) => {
    const on = prefs.enabledIds.includes(id);
    const enabledIds = on
      ? prefs.enabledIds.filter((x) => x !== id)
      : [...prefs.enabledIds, id];
    onChange({ ...prefs, enabledIds, presetId: null });
  };

  return (
    <section className="cp-atlas cp-card">
      <div className="cp-card-head">
        <h2 className="cp-card-title">World Cycles Atlas</h2>
      </div>
      <p className="cp-atlas-blurb">
        One Julian spine · many cultural projections. Pick a pack or toggle systems for Clock rings and Moment voice.
      </p>

      <div className="cp-atlas-presets" role="group" aria-label="Atlas presets">
        {ATLAS_PRESETS.map((p) => {
          const active = prefs.presetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`cp-atlas-preset${active ? " cp-atlas-preset-active" : ""}`}
              onClick={() => applyPreset(p.id)}
              title={p.blurb}
            >
              <span className="cp-atlas-preset-label">{p.label}</span>
              <span className="cp-atlas-preset-blurb">{p.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="cp-atlas-options">
        <label className="cp-atlas-option">
          <span>Maya correlation</span>
          <select
            value={prefs.mayaCorrelation}
            onChange={(e) =>
              onChange({
                ...prefs,
                mayaCorrelation: e.target.value === "gmt_584283" ? "gmt_584283" : "delphi_kin1",
              })
            }
          >
            <option value="delphi_kin1">DELPHI Kin-1 (2024-07-26)</option>
            <option value="gmt_584283">GMT 584283</option>
          </select>
        </label>
        <label className="cp-atlas-option">
          <span>Ayanamsa</span>
          <select
            value={prefs.ayanamsa}
            onChange={(e) =>
              onChange({
                ...prefs,
                ayanamsa: e.target.value === "fagan_bradley" ? "fagan_bradley" : "lahiri",
              })
            }
          >
            <option value="lahiri">Lahiri</option>
            <option value="fagan_bradley">Fagan–Bradley</option>
          </select>
        </label>
      </div>

      <ul className="cp-atlas-list">
        {plugins.map((p) => {
          const enabled = prefs.enabledIds.includes(p.id);
          return (
            <li key={p.id} className={`cp-atlas-row${enabled ? " cp-atlas-row-on" : ""}`}>
              <button
                type="button"
                className="cp-atlas-toggle"
                aria-pressed={enabled}
                onClick={() => toggleSystem(p.id)}
                style={{ ["--sys-color" as string]: p.color }}
              >
                <span className="cp-atlas-toggle-icon" aria-hidden>
                  {p.icon}
                </span>
                <span className="cp-atlas-toggle-body">
                  <span className="cp-atlas-toggle-title">{p.title}</span>
                  <span className="cp-atlas-toggle-meta">
                    Tier {p.tier} · {p.family} · {p.region.join(", ")}
                  </span>
                </span>
                <span className="cp-atlas-toggle-state">{enabled ? "On" : "Off"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
