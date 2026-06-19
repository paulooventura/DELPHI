"use client";

import { useMemo } from "react";
import {
  buildSpacetimeSnapshot,
  formatDegrees,
  formatMeters,
  formatSpeedMps,
} from "../lib/spacetime";

import type { CosmicClockState } from "../lib/cosmic";

export type SpacetimeReadoutProps = {
  now: Date;
  lat: number;
  lon: number;
  liveCoords: boolean;
  usingFallback: boolean;
  locationDenied: boolean;
  locationEnabled: boolean;
  accuracyM: number | null;
  altM: number | null;
  altAccuracyM: number | null;
  speedMps: number | null;
  gpsHeading: number | null;
  locationAtMs: number | null;
  compassHeading: number | null;
  pitchDeg: number | null;
  emfUt: number | null;
  cosmic?: CosmicClockState | null;
};

function fmtTime(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function ReadoutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cp-st-row">
      <span className="cp-st-label">{label}</span>
      <span className="cp-st-value">{value}</span>
    </div>
  );
}

export function SpacetimeReadout(props: SpacetimeReadoutProps) {
  const snap = useMemo(
    () => buildSpacetimeSnapshot(props.now, props.lat, props.lon),
    [props.now, props.lat, props.lon],
  );

  const spaceParts: string[] = [snap.lat, snap.lon];
  if (props.accuracyM != null) spaceParts.push(`±${props.accuracyM.toFixed(2)} m`);
  if (props.altM != null) {
    const alt = formatMeters(props.altM);
    const altAcc = formatMeters(props.altAccuracyM);
    spaceParts.push(`alt ${alt}${altAcc ? ` ±${altAcc.replace(" m", "")} m` : ""}`);
  }
  if (props.usingFallback) spaceParts.push("(fallback)");
  if (props.locationDenied) spaceParts.push("(denied)");
  if (!props.locationEnabled) spaceParts.push("(location off)");

  const motionParts: string[] = [];
  if (props.cosmic?.sensors.pressureHpa != null) {
    motionParts.push(`baro ${props.cosmic.sensors.pressureHpa.toFixed(1)} hPa (Δ${props.cosmic.sensors.pressureDeltaHpa?.toFixed(1) ?? "0"})`);
  }
  if (props.cosmic?.sensors.lux != null) {
    motionParts.push(`lux ${props.cosmic.sensors.lux.toFixed(0)}`);
  }
  const speed = formatSpeedMps(props.speedMps);
  if (speed) motionParts.push(speed);
  if (props.compassHeading != null) motionParts.push(`compass ${formatDegrees(props.compassHeading, 2)}`);
  if (props.gpsHeading != null) motionParts.push(`GPS ${formatDegrees(props.gpsHeading, 2)}`);
  if (props.pitchDeg != null) motionParts.push(`pitch ${formatDegrees(props.pitchDeg, 1)}`);
  if (props.emfUt != null) motionParts.push(`EMF ${props.emfUt.toFixed(2)} µT`);
  if (props.locationAtMs != null) {
    const age = Math.max(0, props.now.getTime() - props.locationAtMs);
    motionParts.push(`fix age ${age < 1000 ? `${age} ms` : `${(age / 1000).toFixed(2)} s`}`);
  }

  return (
    <div className="cp-spacetime cp-tabular" aria-live="off">
      <ReadoutRow
        label="TIME"
        value={`${snap.localTime} local · ${snap.tzName} (${snap.tzOffset})`}
      />
      <ReadoutRow
        label="UTC"
        value={`${snap.utcTime} · unix ${snap.unixMs} · JD ${snap.julianDay}`}
      />
      <ReadoutRow
        label="SKY"
        value={`GMST ${snap.gmst}° · LST ${snap.lst}°`}
      />
      {props.cosmic && (
        <>
          <ReadoutRow
            label="SOLAR"
            value={`noon ${fmtTime(props.cosmic.solar.solarNoon)} · rise ${fmtTime(props.cosmic.solar.sunrise)} · set ${fmtTime(props.cosmic.solar.sunset)} · day ${props.cosmic.solarDayAngleDeg.toFixed(3)}°`}
          />
          <ReadoutRow
            label="CYCLES"
            value={`☽ ${(props.cosmic.lunarPhaseFraction * 100).toFixed(1)}% · tide ${props.cosmic.tideLabel} · muhurta ${props.cosmic.muhurtaIndex + 1}/30 · ☉ ${props.cosmic.sunTropicalLongitudeDeg.toFixed(2)}° ${String(props.cosmic.layers.find(l => l.id === "sun-ecliptic")?.meta.sign ?? "")}`}
          />
          <ReadoutRow
            label="EPOCH"
            value={`precession ${props.cosmic.precessionAngleDeg.toFixed(6)}° · Great Year ~25,772 yr`}
          />
        </>
      )}
      <ReadoutRow
        label="SPACE"
        value={spaceParts.join(" · ")}
      />
      {motionParts.length > 0 && (
        <ReadoutRow label="MOTION" value={motionParts.join(" · ")} />
      )}
      {props.liveCoords && (
        <p className="cp-st-live">● live GPS</p>
      )}
    </div>
  );
}
