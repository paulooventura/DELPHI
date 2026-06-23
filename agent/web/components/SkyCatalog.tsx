"use client";

import { useEffect, useMemo, useState } from "react";
import { computeCelestialBodies, type CelestialBody } from "../lib/cosmic/celestialBodies";
import type { AircraftTrack } from "../lib/cosmic/aircraftTracking";
import { computeAircraftTracks, generateMockAircraft } from "../lib/cosmic/aircraftTracking";
import {
  computeSatelliteTracks,
  DEFAULT_TLE_CATALOG,
  parseTLECatalog,
  type SatelliteTrack,
} from "../lib/cosmic/satelliteTracking";

export type SkyCatalogProps = {
  lat: number;
  lon: number;
  observationTime: Date;
  className?: string;
};

type CatalogRow = {
  id: string;
  kind: "planet" | "satellite" | "aircraft";
  glyph: string;
  name: string;
  az: number;
  alt: number;
  detail?: string;
  visible: boolean;
};

function fmtAlt(alt: number): string {
  if (alt < 0) return `${Math.abs(Math.round(alt))}° below`;
  return `${Math.round(alt)}° up`;
}

function bodyGlyph(id: string): string {
  switch (id) {
    case "sun": return "☀️";
    case "moon": return "🌙";
    case "venus": return "♀";
    case "mars": return "♂";
    case "jupiter": return "♃";
    case "saturn": return "♄";
    default: return "✦";
  }
}

function CatalogSection({ title, rows }: { title: string; rows: CatalogRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="cp-sky-catalog-section">
      <h3 className="cp-sky-catalog-section-title">{title}</h3>
      <ul className="cp-sky-catalog-list">
        {rows.map(row => (
          <li key={row.id} className={`cp-sky-catalog-row${row.visible ? "" : " cp-sky-catalog-row-below"}`}>
            <span className="cp-sky-catalog-glyph" aria-hidden>{row.glyph}</span>
            <div className="cp-sky-catalog-body">
              <span className="cp-sky-catalog-name">{row.name}</span>
              <span className="cp-sky-catalog-meta">
                {Math.round(row.az)}° az · {fmtAlt(row.alt)}
                {row.detail ? ` · ${row.detail}` : ""}
              </span>
            </div>
            <span className={`cp-sky-catalog-badge${row.visible ? " cp-sky-catalog-badge-up" : ""}`}>
              {row.visible ? "visible" : "set"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkyCatalog({ lat, lon, observationTime, className = "" }: SkyCatalogProps) {
  const bodies = useMemo(
    () => computeCelestialBodies(observationTime, lat, lon),
    [observationTime, lat, lon],
  );
  const tleCatalog = useMemo(() => parseTLECatalog(DEFAULT_TLE_CATALOG), []);
  const [aircraft, setAircraft] = useState<AircraftTrack[]>([]);
  const [satellites, setSatellites] = useState<SatelliteTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const observer = { latDeg: lat, lonDeg: lon, altM: 200 };
    const load = async () => {
      try {
        const q = `lat=${lat}&lon=${lon}&alt=200`;
        const [acRes, satRes] = await Promise.all([
          fetch(`/api/sky/aircraft?${q}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/sky/satellites?${q}`).then(r => r.ok ? r.json() : null),
        ]);
        if (cancelled) return;
        if (acRes?.aircraft) setAircraft(acRes.aircraft);
        else {
          setAircraft(computeAircraftTracks(
            generateMockAircraft(observer, Math.floor(Date.now() / 60000), 12),
            observer,
          ));
        }
        if (satRes?.satellites) setSatellites(satRes.satellites);
        else {
          setSatellites(computeSatelliteTracks(tleCatalog, observer, observationTime));
        }
      } catch {
        if (!cancelled) {
          setAircraft(computeAircraftTracks(
            generateMockAircraft(observer, Math.floor(Date.now() / 60000), 8),
            observer,
          ));
          setSatellites(computeSatelliteTracks(tleCatalog, observer, observationTime));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [lat, lon, observationTime, tleCatalog]);

  const planets: CatalogRow[] = bodies.map((b: CelestialBody) => ({
    id: b.id,
    kind: "planet",
    glyph: bodyGlyph(b.id),
    name: b.name,
    az: b.az,
    alt: b.alt,
    detail: `mag ${b.magnitude.toFixed(1)}`,
    visible: b.alt > 0,
  }));

  const sats: CatalogRow[] = satellites.slice(0, 16).map(s => ({
    id: s.id,
    kind: "satellite",
    glyph: "🛰",
    name: s.name,
    az: s.az,
    alt: s.alt,
    detail: `${s.altKm.toFixed(0)} km`,
    visible: s.alt > 5,
  }));

  const planes: CatalogRow[] = aircraft.slice(0, 12).map(a => ({
    id: a.id,
    kind: "aircraft",
    glyph: "✈",
    name: a.callsign,
    az: a.az,
    alt: a.alt,
    detail: `${a.gsKnots} kt · ${a.baroAltFt.toFixed(0)} ft`,
    visible: a.alt > 0,
  }));

  const rootClass = className ? `cp-sky-catalog ${className}` : "cp-sky-catalog";

  return (
    <section className={rootClass}>
      <div className="cp-card-head">
        <h2 className="cp-card-title">Sky Objects</h2>
        {loading ? <span className="cp-muted" style={{ fontSize: "0.65rem" }}>updating…</span> : null}
      </div>
      <p className="cp-muted cp-sky-catalog-blurb">
        Planets, satellites, and aircraft overhead — point your phone at an object to lock it on the sky map.
      </p>
      <CatalogSection title="Planets & Moon" rows={planets} />
      <CatalogSection title={`Satellites (${satellites.length})`} rows={sats} />
      <CatalogSection title={`Aircraft (${aircraft.length})`} rows={planes} />
    </section>
  );
}
