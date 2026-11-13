"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nearestPlaceLabel } from "../lib/geo/placeSearch";

export type LaunchPhase = "void" | "awakening" | "ripple" | "calibration" | "transition" | "done";

export type LogoStage = "void" | "axis" | "eye" | "stars" | "moon" | "full";

const PHASE_MS: Record<LaunchPhase, number> = {
  void: 0,
  awakening: 350,
  ripple: 850,
  calibration: 1200,
  transition: 2600,
  done: 3100,
};

export function useLaunchSequence(onComplete: () => void, telemetryReady: boolean) {
  const [phase, setPhase] = useState<LaunchPhase>("void");
  const [logoStage, setLogoStage] = useState<LogoStage>("void");
  const [progress, setProgress] = useState(0);
  const [ringsVisible, setRingsVisible] = useState(false);
  const [ringsExpanded, setRingsExpanded] = useState(false);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("done");
    onCompleteRef.current();
  }, []);

  // Stage timeline
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("awakening"), PHASE_MS.awakening),
      setTimeout(() => setLogoStage("axis"), PHASE_MS.awakening + 80),
      setTimeout(() => setLogoStage("eye"), PHASE_MS.awakening + 280),
      setTimeout(() => setLogoStage("stars"), PHASE_MS.awakening + 480),
      setTimeout(() => setLogoStage("moon"), PHASE_MS.awakening + 620),
      setTimeout(() => setLogoStage("full"), PHASE_MS.awakening + 720),
      setTimeout(() => {
        setPhase("ripple");
        setRingsVisible(true);
      }, PHASE_MS.ripple),
      setTimeout(() => setRingsExpanded(true), PHASE_MS.ripple + 120),
      setTimeout(() => setPhase("calibration"), PHASE_MS.calibration),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Calibration progress (~1.4s crawl, accelerates when telemetry ready)
  useEffect(() => {
    if (phase !== "calibration" && phase !== "transition") return;
    if (phase === "transition") return;

    const id = window.setInterval(() => {
      setProgress(p => {
        const bump = telemetryReady ? 4.5 : 2.2;
        const next = Math.min(100, p + bump);
        if (next >= 100) {
          window.clearInterval(id);
          setPhase("transition");
        }
        return next;
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [phase, telemetryReady]);

  // Transition exit
  useEffect(() => {
    if (phase !== "transition") return;
    const t = setTimeout(finish, 520);
    return () => clearTimeout(t);
  }, [phase, finish]);

  // Hard cap — never block longer than 3.5s
  useEffect(() => {
    const cap = setTimeout(() => {
      setProgress(100);
      setPhase("transition");
    }, 3500);
    return () => clearTimeout(cap);
  }, []);

  return {
    phase,
    logoStage,
    progress,
    ringsVisible,
    ringsExpanded,
    exiting: phase === "transition" || phase === "done",
  };
}

/** Names where the person is from the bundled place list: their coordinates never leave the device. */
export async function reversePlaceLabel(lat: number, lon: number): Promise<string> {
  try {
    return await nearestPlaceLabel(lat, lon);
  } catch {
    return "OBSERVATORY";
  }
}
