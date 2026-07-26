"use client";

import { useMemo, useState } from "react";
import {
  clearBirth,
  loadBirth,
  saveBirth,
  type BirthRecord,
} from "../../lib/lore/birthStore";
import { composePerson } from "../../lib/lore/resolvePerson";
import { distillTemplate, type Composition } from "../../lib/lore/compose";

function overlap(a: Composition, b: Composition) {
  const nowQ = new Set(a.activeQualities);
  const youQ = new Set(b.activeQualities);
  const shared = [...nowQ].filter(q => youQ.has(q));
  const onlyYou = [...youQ].filter(q => !nowQ.has(q));
  const onlyNow = [...nowQ].filter(q => !youQ.has(q));
  return { shared, onlyYou, onlyNow };
}

export function OnyxYou({
  nowChord,
  placeLat,
  placeLon,
  onBack,
}: {
  nowChord: Composition;
  placeLat: number;
  placeLon: number;
  onBack: () => void;
}) {
  const [birth, setBirth] = useState<BirthRecord | null>(() => loadBirth());
  const [year, setYear] = useState(String(birth?.year ?? ""));
  const [month, setMonth] = useState(String(birth?.month ?? ""));
  const [day, setDay] = useState(String(birth?.day ?? ""));
  const [placeLabel, setPlaceLabel] = useState(birth?.placeLabel ?? "");
  const [error, setError] = useState<string | null>(null);

  const personal = useMemo(() => {
    if (!birth) return null;
    return composePerson(birth);
  }, [birth]);

  const compare = useMemo(() => {
    if (!personal) return null;
    return overlap(nowChord, personal.chord);
  }, [nowChord, personal]);

  function persist() {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isFinite(y) || y < 1900 || y > 2100) {
      setError("Enter a birth year between 1900 and 2100.");
      return;
    }
    if (!Number.isFinite(m) || m < 1 || m > 12) {
      setError("Enter month 1–12.");
      return;
    }
    if (!Number.isFinite(d) || d < 1 || d > 31) {
      setError("Enter day 1–31.");
      return;
    }
    const next: BirthRecord = {
      year: y,
      month: m,
      day: d,
      placeLabel: placeLabel.trim() || undefined,
      lat: placeLat,
      lon: placeLon,
    };
    saveBirth(next);
    setBirth(next);
    setError(null);
  }

  function wipe() {
    clearBirth();
    setBirth(null);
    setYear("");
    setMonth("");
    setDay("");
    setPlaceLabel("");
    setError(null);
  }

  return (
    <div className="onyx-root">
      <div className="onyx-device" style={{ overflow: "auto" }}>
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          close
        </button>
        <div className="onyx-overlay">
          <p className="onyx-eyebrow">YOU</p>
          <p className="onyx-layer-lead">
            Opt-in natal chord. Birth data stays on this device — computed here, never sent.
          </p>

          <div className="onyx-form">
            <label>
              Year
              <input
                inputMode="numeric"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="1990"
              />
            </label>
            <label>
              Month
              <input
                inputMode="numeric"
                value={month}
                onChange={e => setMonth(e.target.value)}
                placeholder="7"
              />
            </label>
            <label>
              Day
              <input
                inputMode="numeric"
                value={day}
                onChange={e => setDay(e.target.value)}
                placeholder="24"
              />
            </label>
            <label className="onyx-form-wide">
              Place label (optional)
              <input
                value={placeLabel}
                onChange={e => setPlaceLabel(e.target.value)}
                placeholder="City name only — not uploaded"
              />
            </label>
          </div>

          {error && <p className="onyx-form-err">{error}</p>}

          <div className="onyx-form-actions">
            <button type="button" className="onyx-primary-btn" onClick={persist}>
              Save locally
            </button>
            {birth && (
              <button type="button" className="onyx-ghost-btn" onClick={wipe}>
                Clear device data
              </button>
            )}
          </div>

          {personal && (
            <>
              <hr className="onyx-seam" />
              <p className="onyx-eyebrow">YOUR CHORD</p>
              <p className="onyx-layer-phrase">{distillTemplate(personal.chord)}</p>
              <p className="onyx-layer-meta">
                {personal.entries.map(e => e.name).join(" · ") || "No render-tier birth signs matched."}
              </p>

              {compare && (
                <>
                  <p className="onyx-eyebrow" style={{ marginTop: 20 }}>
                    WITH NOW
                  </p>
                  {compare.shared.length > 0 && (
                    <p className="onyx-layer-meta">
                      Resonates · {compare.shared.slice(0, 8).join(", ")}
                    </p>
                  )}
                  {compare.onlyYou.length > 0 && (
                    <p className="onyx-layer-meta">
                      Yours alone · {compare.onlyYou.slice(0, 6).join(", ")}
                    </p>
                  )}
                  {compare.onlyNow.length > 0 && (
                    <p className="onyx-layer-meta">
                      Moment alone · {compare.onlyNow.slice(0, 6).join(", ")}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
