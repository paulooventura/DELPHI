"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearBirth,
  loadBirth,
  saveBirth,
  type BirthRecord,
} from "../../lib/lore/birthStore";
import { composePerson } from "../../lib/lore/resolvePerson";
import { distillTemplate, type Composition } from "../../lib/lore/compose";
import { searchPlaces, type PlaceHit } from "../../lib/geo/placeSearch";
import type { EmbracedCast } from "../../lib/lore/castStore";
import { OnyxStarfield } from "./OnyxStarfield";

function overlap(a: Composition, b: Composition) {
  const nowQ = new Set(a.activeQualities);
  const youQ = new Set(b.activeQualities);
  const shared = [...nowQ].filter(q => youQ.has(q));
  const onlyYou = [...youQ].filter(q => !nowQ.has(q));
  const onlyNow = [...nowQ].filter(q => !youQ.has(q));
  return { shared, onlyYou, onlyNow };
}

function daysInMonth(year: number, month: number): number {
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return 31;
  return new Date(year, month, 0).getDate();
}

function parseOptionalHour(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 23) return NaN;
  return Math.floor(n);
}

function parseOptionalMinute(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 59) return NaN;
  return Math.floor(n);
}

export function OnyxYou({
  nowChord,
  onBack,
  onBirthSaved,
  expandDivinations = false,
  heldCasts = [],
  onOpenCast,
}: {
  nowChord: Composition;
  /** @deprecated kept for call-site compat; birth place comes from city pick */
  placeLat?: number;
  placeLon?: number;
  onBack: () => void;
  /** Fired after local save/clear so home can re-distill with color lean. */
  onBirthSaved?: (birth: BirthRecord | null) => void;
  /** Divinations are an expansion of You, not a home-compass door. */
  expandDivinations?: boolean;
  heldCasts?: EmbracedCast[];
  onOpenCast?: () => void;
}) {
  const [birth, setBirth] = useState<BirthRecord | null>(() => loadBirth());
  const [year, setYear] = useState(String(birth?.year ?? ""));
  const [month, setMonth] = useState(String(birth?.month ?? ""));
  const [day, setDay] = useState(String(birth?.day ?? ""));
  const [hour, setHour] = useState(birth?.hour !== undefined ? String(birth.hour) : "");
  const [minute, setMinute] = useState(birth?.minute !== undefined ? String(birth.minute) : "");
  const [knowsHour, setKnowsHour] = useState(birth?.hour !== undefined);
  const [placeLabel, setPlaceLabel] = useState(birth?.placeLabel ?? "");
  const [placeLat, setPlaceLat] = useState<number | undefined>(birth?.lat);
  const [placeLon, setPlaceLon] = useState<number | undefined>(birth?.lon);
  const [placeLocked, setPlaceLocked] = useState(
    () => Boolean(birth?.placeLabel && birth?.lat != null && birth?.lon != null),
  );
  const [suggestions, setSuggestions] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [divinationsOpen, setDivinationsOpen] = useState(expandDivinations);

  useEffect(() => {
    if (expandDivinations) setDivinationsOpen(true);
  }, [expandDivinations]);
  const abortRef = useRef<AbortController | null>(null);
  const placeWrapRef = useRef<HTMLDivElement>(null);

  const personal = useMemo(() => {
    if (!birth) return null;
    return composePerson(birth);
  }, [birth]);

  const compare = useMemo(() => {
    if (!personal) return null;
    return overlap(nowChord, personal.chord);
  }, [nowChord, personal]);

  // Debounced city typeahead
  useEffect(() => {
    if (placeLocked) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const q = placeLabel.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      void searchPlaces(q, { count: 6, signal: ac.signal }).then(hits => {
        if (ac.signal.aborted) return;
        setSuggestions(hits);
        setListOpen(true);
        setSearching(false);
      });
    }, 280);
    return () => {
      window.clearTimeout(t);
      abortRef.current?.abort();
    };
  }, [placeLabel, placeLocked]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!placeWrapRef.current?.contains(e.target as Node)) setListOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function lockPlace(hit: PlaceHit) {
    setPlaceLabel(hit.label);
    setPlaceLat(hit.lat);
    setPlaceLon(hit.lon);
    setPlaceLocked(true);
    setSuggestions([]);
    setListOpen(false);
    setError(null);
  }

  function unlockPlace() {
    setPlaceLocked(false);
    setPlaceLat(undefined);
    setPlaceLon(undefined);
    setListOpen(true);
  }

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
    const maxDay = daysInMonth(y, m);
    if (!Number.isFinite(d) || d < 1 || d > maxDay) {
      setError(`Enter day 1–${maxDay} for that month.`);
      return;
    }
    if (placeLabel.trim() && !placeLocked) {
      setError("Pick a city from the list to lock birth place — or clear the field.");
      return;
    }

    let h: number | undefined;
    let min: number | undefined;
    if (knowsHour) {
      h = parseOptionalHour(hour);
      min = parseOptionalMinute(minute || "0");
      if (h === undefined || Number.isNaN(h)) {
        setError("Enter birth hour 0–23, or turn off birth time.");
        return;
      }
      if (min === undefined || Number.isNaN(min)) {
        setError("Enter birth minute 0–59.");
        return;
      }
    }

    const next: BirthRecord = {
      year: y,
      month: m,
      day: d,
      ...(h !== undefined ? { hour: h, minute: min ?? 0 } : {}),
      placeLabel: placeLabel.trim() || undefined,
      lat: placeLocked ? placeLat : undefined,
      lon: placeLocked ? placeLon : undefined,
    };
    saveBirth(next);
    setBirth(next);
    setError(null);
    onBirthSaved?.(next);
    // Parent returns to home so the moment retunes immediately.
  }

  function wipe() {
    clearBirth();
    setBirth(null);
    setYear("");
    setMonth("");
    setDay("");
    setHour("");
    setMinute("");
    setKnowsHour(false);
    setPlaceLabel("");
    setPlaceLat(undefined);
    setPlaceLon(undefined);
    setPlaceLocked(false);
    setSuggestions([]);
    setError(null);
    onBirthSaved?.(null);
  }

  const personalPhrase = personal
    ? distillTemplate(personal.chord, { colorLean: personal.galactic.tribe.color })
    : null;

  return (
    <div className="onyx-root">
      <div className="onyx-device" style={{ overflow: "auto" }}>
        <OnyxStarfield />
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          close
        </button>
        <div className="onyx-overlay onyx-you">
          <p className="onyx-eyebrow">YOU</p>
          <p className="onyx-layer-lead">Your natal chord — private, on this device</p>

          <div className="onyx-you-divinations">
            <button
              type="button"
              className="onyx-row"
              aria-expanded={divinationsOpen}
              onClick={() => setDivinationsOpen(v => !v)}
            >
              <span>Divinations</span>
              <span className="onyx-row-r">{divinationsOpen ? "▴" : "▾"}</span>
            </button>
            {divinationsOpen && (
              <div className="onyx-you-divinations-body">
                <p className="onyx-layer-meta">
                  Draws live here — an expansion of You, not a home door. They colour a labeled
                  layer through you. They never rewrite the sky clock.
                </p>
                {heldCasts.length > 0 && (
                  <p className="onyx-layer-meta">
                    Held · {heldCasts.map(h => h.label).join(" · ")}
                  </p>
                )}
                {onOpenCast && (
                  <button type="button" className="onyx-primary-btn" onClick={onOpenCast}>
                    Draw
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="onyx-about-block onyx-you-blurb">
            Birth date, hour, and place are computed here and stored in this browser only. Nothing is
            uploaded. Pick a city so the chord uses that sky; add your hour for rising / decan math.
          </div>

          <p className="onyx-eyebrow">BIRTH DATE</p>
          <div className="onyx-form onyx-form-date">
            <label>
              Year
              <input
                inputMode="numeric"
                value={year}
                onChange={e => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1990"
                autoComplete="bday-year"
              />
            </label>
            <label>
              Month
              <input
                inputMode="numeric"
                value={month}
                onChange={e => setMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="7"
                autoComplete="bday-month"
              />
            </label>
            <label>
              Day
              <input
                inputMode="numeric"
                value={day}
                onChange={e => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="24"
                autoComplete="bday-day"
              />
            </label>
          </div>

          <p className="onyx-eyebrow">BIRTH HOUR</p>
          <div className="onyx-form onyx-form-date">
            <label className="onyx-form-wide onyx-form-check">
              <span className="onyx-check-row">
                <input
                  type="checkbox"
                  checked={knowsHour}
                  onChange={e => setKnowsHour(e.target.checked)}
                />
                I know my birth hour
              </span>
              <span className="onyx-form-hint">
                Optional — shapes rising / decan math. Off uses noon.
              </span>
            </label>
            {knowsHour && (
              <>
                <label>
                  Hour
                  <input
                    inputMode="numeric"
                    value={hour}
                    onChange={e => setHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="14"
                    aria-label="Birth hour 0 to 23"
                  />
                </label>
                <label>
                  Minute
                  <input
                    inputMode="numeric"
                    value={minute}
                    onChange={e => setMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="30"
                    aria-label="Birth minute 0 to 59"
                  />
                </label>
                <label>
                  <span className="onyx-form-spacer" />
                  <span className="onyx-form-hint" style={{ paddingTop: 10 }}>
                    Local clock · 24h
                  </span>
                </label>
              </>
            )}
          </div>

          <p className="onyx-eyebrow">BIRTH PLACE</p>
          <div className="onyx-place" ref={placeWrapRef}>
            <label className="onyx-place-label">
              City
              <div className="onyx-place-field">
                <input
                  value={placeLabel}
                  onChange={e => {
                    setPlaceLabel(e.target.value);
                    if (placeLocked) unlockPlace();
                    setListOpen(true);
                  }}
                  onFocus={() => {
                    if (!placeLocked && suggestions.length > 0) setListOpen(true);
                  }}
                  placeholder="Start typing a city…"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={listOpen && suggestions.length > 0}
                />
                {placeLocked && (
                  <button
                    type="button"
                    className="onyx-place-clear"
                    onClick={() => {
                      setPlaceLabel("");
                      unlockPlace();
                    }}
                    aria-label="Clear city"
                  >
                    clear
                  </button>
                )}
              </div>
            </label>

            {placeLocked && placeLat != null && placeLon != null && (
              <p className="onyx-place-locked">
                Locked · {placeLat.toFixed(2)}°, {placeLon.toFixed(2)}°
              </p>
            )}

            {!placeLocked && listOpen && (suggestions.length > 0 || searching) && (
              <ul className="onyx-place-list" role="listbox">
                {searching && suggestions.length === 0 && (
                  <li className="onyx-place-idle">Searching…</li>
                )}
                {suggestions.map(hit => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      role="option"
                      className="onyx-place-hit"
                      onClick={() => lockPlace(hit)}
                    >
                      <span className="onyx-place-hit-name">{hit.name}</span>
                      <span className="onyx-place-hit-meta">
                        {[hit.admin1, hit.country].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
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

          {!birth && (
            <>
              <hr className="onyx-seam" />
              <p className="onyx-eyebrow">WHAT THIS UNLOCKS</p>
              <ul className="onyx-about-list onyx-you-unlocks">
                <li>
                  <b>Natal chord</b> — calendar and sky signs for your birth moment, scored with the
                  same honesty tiers as Now.
                </li>
                <li>
                  <b>Your color</b> — Dreamspell tribe color retunes the distilled phrase toward your
                  register (without naming the color on the street).
                </li>
                <li>
                  <b>Birth hour</b> — optional; shapes rising / decan math when you know it.
                </li>
                <li>
                  <b>On-device only</b> — localStorage; birth never leaves this browser.
                </li>
              </ul>
            </>
          )}

          {personal && personalPhrase && (
            <>
              <hr className="onyx-seam" />
              <p className="onyx-eyebrow">YOUR COLOR</p>
              <p className="onyx-layer-meta">
                Kin {personal.galactic.kin} · {personal.galactic.tone.name}{" "}
                <b style={{ color: "var(--onyx-core)" }}>
                  {personal.galactic.tribe.color} {personal.galactic.tribe.name}
                </b>
              </p>
              <p className="onyx-eyebrow" style={{ marginTop: 16 }}>
                YOUR CHORD
              </p>
              <p className="onyx-layer-phrase">{personalPhrase}</p>
              {birth?.placeLabel && (
                <p className="onyx-layer-meta">Born under · {birth.placeLabel}</p>
              )}
              <p className="onyx-layer-meta">
                {personal.entries.map(e => e.name).join(" · ") ||
                  "No render-tier birth signs matched."}
              </p>
              {personal.timeIsApproximate && (
                <p className="onyx-layer-meta">
                  Hour unknown — noon used. Add your birth hour for rising-sensitive math.
                </p>
              )}
              {personal.warnings.slice(0, 2).map(w => (
                <p key={w} className="onyx-layer-meta">
                  {w}
                </p>
              ))}

              {personal.entries.slice(0, 4).map(e => (
                <article key={e.id} className="onyx-decomp-card onyx-you-voice">
                  <p className="onyx-decomp-name">
                    {e.name}
                    <span>{e.system}</span>
                  </p>
                  {e.source && <p className="onyx-decomp-source">{e.source}</p>}
                </article>
              ))}

              {compare && (
                <>
                  <p className="onyx-eyebrow" style={{ marginTop: 20 }}>
                    WITH NOW
                  </p>
                  <div className="onyx-you-compare">
                    {compare.shared.length > 0 && (
                      <div className="onyx-you-chip-row">
                        <span className="onyx-you-chip-label">Resonates</span>
                        {compare.shared.slice(0, 8).map(q => (
                          <span key={`s-${q}`} className="onyx-you-chip">
                            {q}
                          </span>
                        ))}
                      </div>
                    )}
                    {compare.onlyYou.length > 0 && (
                      <div className="onyx-you-chip-row">
                        <span className="onyx-you-chip-label">Yours alone</span>
                        {compare.onlyYou.slice(0, 6).map(q => (
                          <span key={`y-${q}`} className="onyx-you-chip quiet">
                            {q}
                          </span>
                        ))}
                      </div>
                    )}
                    {compare.onlyNow.length > 0 && (
                      <div className="onyx-you-chip-row">
                        <span className="onyx-you-chip-label">Moment alone</span>
                        {compare.onlyNow.slice(0, 6).map(q => (
                          <span key={`n-${q}`} className="onyx-you-chip quiet">
                            {q}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
