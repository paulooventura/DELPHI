"use client";

/**
 * Natal Triad panel — Sun · Moon · Rising for Heliodrome / Psyche.
 * Pure display + optional compact birth form (saves to local BirthRecord).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadBirth,
  saveBirth,
  type BirthRecord,
} from "../../lib/lore/birthStore";
import {
  computeNatalTriadFromBirth,
  searchPlaces,
  type PlaceHit,
} from "../../lib/natal/fromBirthRecord";
import {
  formatNatalPlacement,
  type NatalTriad,
} from "../../lib/natal/natalTriad";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function recordToForm(b: BirthRecord | null) {
  return {
    date: b ? `${b.year}-${pad2(b.month)}-${pad2(b.day)}` : "",
    time:
      b?.hour !== undefined
        ? `${pad2(b.hour)}:${pad2(b.minute ?? 0)}`
        : "",
    place: b?.placeLabel ?? "",
    lat: b?.lat,
    lon: b?.lon,
    locked: Boolean(b?.placeLabel && b?.lat != null && b?.lon != null),
  };
}

export function NatalTriadPanel({
  birth: birthProp,
  onBirthChange,
  compact = false,
  className = "",
}: {
  /** Controlled birth; falls back to loadBirth(). */
  birth?: BirthRecord | null;
  onBirthChange?: (b: BirthRecord) => void;
  /** Heliodrome header: denser layout. */
  compact?: boolean;
  className?: string;
}) {
  const [birth, setBirth] = useState<BirthRecord | null>(
    () => birthProp ?? loadBirth(),
  );
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(() => recordToForm(birthProp ?? loadBirth()).date);
  const [time, setTime] = useState(() => recordToForm(birthProp ?? loadBirth()).time);
  const [place, setPlace] = useState(() => recordToForm(birthProp ?? loadBirth()).place);
  const [lat, setLat] = useState<number | undefined>(() => recordToForm(birthProp ?? loadBirth()).lat);
  const [lon, setLon] = useState<number | undefined>(() => recordToForm(birthProp ?? loadBirth()).lon);
  const [locked, setLocked] = useState(() => recordToForm(birthProp ?? loadBirth()).locked);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (birthProp === undefined) return;
    setBirth(birthProp);
    const f = recordToForm(birthProp);
    setDate(f.date);
    setTime(f.time);
    setPlace(f.place);
    setLat(f.lat);
    setLon(f.lon);
    setLocked(f.locked);
  }, [birthProp]);

  useEffect(() => {
    if (locked || place.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      void searchPlaces(place.trim(), { count: 5, signal: ac.signal }).then(rows => {
        if (ac.signal.aborted) return;
        setHits(rows);
        setListOpen(true);
      });
    }, 280);
    return () => {
      window.clearTimeout(t);
      abortRef.current?.abort();
    };
  }, [place, locked]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setListOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const triad: NatalTriad | null = useMemo(
    () => computeNatalTriadFromBirth(birth),
    [birth],
  );

  function lockHit(hit: PlaceHit) {
    setPlace(hit.label);
    setLat(hit.lat);
    setLon(hit.lon);
    setLocked(true);
    setHits([]);
    setListOpen(false);
    setError(null);
  }

  function persist() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Use date YYYY-MM-DD.");
      return;
    }
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) {
      setError("Invalid date.");
      return;
    }
    if (!locked || lat == null || lon == null) {
      setError("Pick a birth place from the list.");
      return;
    }
    let hour: number | undefined;
    let minute: number | undefined;
    if (time.trim()) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
      if (!m) {
        setError("Time as HH:mm, or leave blank.");
        return;
      }
      hour = Number(m[1]);
      minute = Number(m[2]);
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        setError("Time out of range.");
        return;
      }
    }
    const next: BirthRecord = {
      year: y,
      month: m,
      day: d,
      ...(hour !== undefined ? { hour, minute: minute ?? 0 } : {}),
      placeLabel: place.trim() || undefined,
      lat,
      lon,
    };
    saveBirth(next);
    setBirth(next);
    setEditing(false);
    setError(null);
    onBirthChange?.(next);
  }

  return (
    <section
      className={`onyx-natal-triad${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      aria-label="Natal triad"
      ref={wrapRef}
    >
      <div className="onyx-natal-triad-head">
        <p className="onyx-natal-triad-kicker">Natal triad</p>
        <button
          type="button"
          className="onyx-natal-triad-edit"
          onClick={() => setEditing(e => !e)}
        >
          {editing ? "Close" : birth ? "Edit" : "Add birth"}
        </button>
      </div>

      {triad ? (
        <ul className="onyx-natal-triad-list">
          <li>
            <span className="onyx-natal-triad-glyph" aria-hidden>
              ☉
            </span>
            <span>{formatNatalPlacement("Sun", triad.sun)}</span>
          </li>
          <li>
            <span className="onyx-natal-triad-glyph" aria-hidden>
              ☽
            </span>
            <span>
              {formatNatalPlacement("Moon", triad.moon, {
                approximate: triad.moon.approximate,
              })}
            </span>
          </li>
          <li>
            <span className="onyx-natal-triad-glyph" aria-hidden>
              ↑
            </span>
            <span>
              {triad.asc
                ? formatNatalPlacement("Rising", triad.asc)
                : triad.ascMessage ?? "Rising needs an exact birth time."}
            </span>
          </li>
        </ul>
      ) : (
        <p className="onyx-natal-triad-empty">
          Save birth date, time, and place to read Sun · Moon · Rising.
        </p>
      )}

      {editing && (
        <div className="onyx-natal-triad-form">
          <label>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </label>
          <label>
            <span>Time</span>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </label>
          <label className="onyx-natal-triad-place">
            <span>Place</span>
            <input
              type="text"
              value={place}
              disabled={locked}
              placeholder="City…"
              onChange={e => {
                setPlace(e.target.value);
                setLocked(false);
                setLat(undefined);
                setLon(undefined);
              }}
              autoComplete="off"
            />
            {locked && (
              <button
                type="button"
                className="onyx-natal-triad-edit"
                onClick={() => {
                  setLocked(false);
                  setLat(undefined);
                  setLon(undefined);
                }}
              >
                Change
              </button>
            )}
          </label>
          {listOpen && hits.length > 0 && !locked && (
            <ul className="onyx-natal-triad-suggest" role="listbox">
              {hits.map(h => (
                <li key={`${h.label}-${h.lat}-${h.lon}`}>
                  <button type="button" onClick={() => lockHit(h)}>
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="onyx-natal-triad-error">{error}</p>}
          <button type="button" className="onyx-tool-btn" onClick={persist}>
            Save natal
          </button>
        </div>
      )}
    </section>
  );
}
