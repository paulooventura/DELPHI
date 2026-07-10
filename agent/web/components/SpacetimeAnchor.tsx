"use client";

import { useMemo, useState } from "react";
import type { CosmicClockState } from "../lib/cosmic";
import type { CosmicTimeSnapshot } from "../lib/timeEngine";
import { buildNavigationReference } from "../lib/spacetimeReference";
import { SpacetimeReadout } from "./SpacetimeReadout";

export type SpacetimeAnchorProps = {
  now: Date;
  lat: number;
  lon: number;
  snapshot: CosmicTimeSnapshot;
  cosmic: CosmicClockState | null;
  liveCoords: boolean;
  locationEnabled: boolean;
  locationDenied: boolean;
  accuracyM: number | null;
  altM: number | null;
  altAccuracyM: number | null;
  speedMps: number | null;
  gpsHeading: number | null;
  locationAtMs: number | null;
  compassHeading: number | null;
  compassOffsetDeg: number;
  declinationDeg: number;
  pitchDeg: number | null;
  emfUt: number | null;
};

const FIX_LABEL: Record<string, string> = {
  live: "LIVE FIX",
  fallback: "APPROX",
  denied: "DENIED",
  off: "OFF",
};

const COMPASS_LABEL: Record<string, string> = {
  high: "Compass · tight",
  medium: "Compass · fair",
  low: "Compass · loose",
  unknown: "Compass · —",
};

const TIER_LABEL: Record<string, string> = {
  measured: "Measured",
  computed: "Computed",
  cultural: "Cultural",
};

export function SpacetimeAnchor(props: SpacetimeAnchorProps) {
  const [expanded, setExpanded] = useState(false);

  const nav = useMemo(
    () =>
      buildNavigationReference({
        now: props.now,
        lat: props.lat,
        lon: props.lon,
        snapshot: props.snapshot,
        cosmic: props.cosmic,
        liveCoords: props.liveCoords,
        locationEnabled: props.locationEnabled,
        locationDenied: props.locationDenied,
        accuracyM: props.accuracyM,
        altM: props.altM,
        compassHeading: props.compassHeading,
        compassOffsetDeg: props.compassOffsetDeg,
      }),
    [
      props.now,
      props.lat,
      props.lon,
      props.snapshot,
      props.cosmic,
      props.liveCoords,
      props.locationEnabled,
      props.locationDenied,
      props.accuracyM,
      props.altM,
      props.compassHeading,
      props.compassOffsetDeg,
    ],
  );

  return (
    <section className="cp-spacetime-anchor" aria-label="Where you are in space and time">
      <div className="cp-st-anchor-header">
        <span className={`cp-st-fix cp-st-fix-${nav.fixQuality}`}>{FIX_LABEL[nav.fixQuality]}</span>
        <span className={`cp-st-compass cp-st-compass-${nav.compassConfidence}`}>
          {COMPASS_LABEL[nav.compassConfidence]}
        </span>
        {nav.nextEvent && (
          <span className="cp-st-next-event">
            {nav.nextEvent.label} {nav.nextEvent.countdown}
          </span>
        )}
      </div>

      <p className="cp-st-place">{nav.fixDetail}</p>
      <p className="cp-st-narrative">{nav.narrative}</p>

      <div className="cp-st-chips" role="list">
        {nav.chips.map(chip => (
          <span
            key={`${chip.label}-${chip.value}`}
            className={`cp-st-chip cp-st-chip-${chip.tier}`}
            role="listitem"
            title={TIER_LABEL[chip.tier]}
          >
            <span className="cp-st-chip-label">{chip.label}</span>
            <span className="cp-st-chip-value">{chip.value}</span>
          </span>
        ))}
      </div>

      <div className="cp-st-anchor-actions">
        <p className="cp-st-provenance-hint">
          Measured = GPS & sensors · Computed = ephemeris & sky math · Cultural = traditional calendars
        </p>
        <button
          type="button"
          className="cp-st-expand-btn"
          aria-expanded={expanded}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? "Hide technical readout" : "Technical readout"}
        </button>
      </div>

      {expanded && (
        <div className="cp-st-expanded">
          <SpacetimeReadout
            now={props.now}
            lat={props.lat}
            lon={props.lon}
            liveCoords={props.liveCoords}
            usingFallback={nav.fixQuality === "fallback"}
            locationDenied={props.locationDenied}
            locationEnabled={props.locationEnabled}
            accuracyM={props.accuracyM}
            altM={props.altM}
            altAccuracyM={props.altAccuracyM}
            speedMps={props.speedMps}
            gpsHeading={props.gpsHeading}
            locationAtMs={props.locationAtMs}
            compassHeading={props.compassHeading}
            pitchDeg={props.pitchDeg}
            emfUt={props.emfUt}
            cosmic={props.cosmic}
          />
          {props.compassHeading != null && (
            <p className="cp-st-compass-note">
              {nav.compassDetail}
              {props.declinationDeg !== 0 && ` · declination ${props.declinationDeg > 0 ? "+" : ""}${props.declinationDeg.toFixed(1)}°`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
