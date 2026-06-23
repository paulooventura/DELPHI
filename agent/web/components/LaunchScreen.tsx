"use client";

import { useCallback, useEffect, useState } from "react";
import { OracleLogo } from "./oracle/OracleLogo";
import { SplashRings } from "./oracle/SplashRings";
import { reversePlaceLabel, useLaunchSequence } from "../hooks/useLaunchSequence";

function formatSplashDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase();
}

function formatSplashTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase();
}

export function LaunchScreen({
  now,
  lat,
  lon,
  telemetryReady,
  onComplete,
}: {
  now: Date;
  lat: number;
  lon: number;
  telemetryReady: boolean;
  onComplete: () => void;
}) {
  const { logoStage, progress, ringsVisible, ringsExpanded, exiting, phase } = useLaunchSequence(onComplete, telemetryReady);
  const [placeLabel, setPlaceLabel] = useState("UNVEILING THE ORACLE");

  useEffect(() => {
    void reversePlaceLabel(lat, lon).then(label => setPlaceLabel(label));
  }, [lat, lon]);

  const showRings = ringsVisible || phase === "ripple" || phase === "calibration" || phase === "transition";

  return (
    <div
      className={`cp-launch${phase !== "void" ? " cp-launch-visible" : ""}${exiting ? " cp-launch-exit" : ""}`}
      role="dialog"
      aria-label="Delphi launch sequence"
      aria-busy={!exiting}
    >
      <div className="cp-launch-bg" aria-hidden />
      <div className="cp-launch-galaxy" aria-hidden />

      <div className="cp-launch-body">
        <div className={`cp-launch-logo-wrap${exiting ? " cp-launch-logo-exit" : ""}`}>
          {showRings && (
            <div className="cp-launch-rings-wrap">
              <SplashRings visible={showRings} expanded={ringsExpanded} size={300} />
            </div>
          )}
          <OracleLogo size={100} stage={logoStage} className="cp-launch-oracle" />
        </div>

        <h1 className="cp-launch-title">DELPHI</h1>
        <p className="cp-launch-tagline">COSMIC CLOCK | ASTRONOMICAL GUIDANCE</p>

        <div className="cp-launch-telemetry">
          <p className="cp-launch-date">{formatSplashDate(now)}</p>
          <p className="cp-launch-clock">{formatSplashTime(now)}</p>
          <p className="cp-launch-status">
            {placeLabel} | UNVEILING THE ORACLE
          </p>
        </div>

        <div className="cp-launch-progress-wrap">
          <div className="cp-launch-progress-track">
            <div className="cp-launch-progress-fill" style={{ width: `${progress}%` }} />
            <div className="cp-launch-progress-knob" style={{ left: `${progress}%` }} />
          </div>
          <span className="cp-launch-progress-pct">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}

const LAUNCH_KEY = "delphi-launched";

export function useShowLaunch(): [boolean, () => void] {
  const [show, setShow] = useState(() => {
    try {
      return !sessionStorage.getItem(LAUNCH_KEY);
    } catch {
      return true;
    }
  });

  const complete = useCallback(() => {
    try { sessionStorage.setItem(LAUNCH_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }, []);

  return [show, complete];
}

export { LAUNCH_KEY };
