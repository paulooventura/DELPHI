"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  CelestialSkyView,
  type LiveAttitude,
} from "../CelestialSkyView";
import type { SkyWeatherSlot } from "../../lib/cosmic/skyWeather";
import { OnyxAudioStone } from "./OnyxAudioStone";
import { cardinalFromHeading } from "./onyxCopy";

const DIRS = ["N", "·", "NE", "·", "E", "·", "SE", "·", "S", "·", "SW", "·", "W", "·", "NW", "·", "N", "·", "NE", "·", "E"];
const CARD = ["N", "E", "S", "W", "NE", "SE", "SW", "NW"];
const EXIT_MS = 480;

export function OnyxSky({
  now,
  lat,
  lon,
  altM,
  headingDeg,
  pitchDeg,
  liveAttitudeRef,
  liveHeading = false,
  livePitch = false,
  arPoseReady = true,
  hapticsEnabled = true,
  onPulseEnabledChange,
  warmth = 0.55,
  weather = null,
  sensorDiag,
  onBack,
}: {
  now: Date;
  lat: number;
  lon: number;
  altM: number;
  headingDeg: number;
  pitchDeg: number;
  liveAttitudeRef?: RefObject<LiveAttitude>;
  liveHeading?: boolean;
  livePitch?: boolean;
  arPoseReady?: boolean;
  hapticsEnabled?: boolean;
  onPulseEnabledChange?: (on: boolean) => void;
  warmth?: number;
  weather?: SkyWeatherSlot | null;
  sensorDiag?: { events: number; status: "none" | "ok" | "event-but-null" | "denied" };
  onBack: () => void;
}) {
  const live = liveHeading || livePitch || Boolean(liveAttitudeRef);
  const look = cardinalFromHeading(headingDeg);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const pitchLabel = Number.isFinite(pitchDeg) ? Math.round(pitchDeg) : 0;
  const az = ((headingDeg % 360) + 360) % 360;
  const ribbonX = -(az / 360) * (DIRS.length * 44) + 195 - 22;

  const [phase, setPhase] = useState<"enter" | "live" | "exit">("enter");
  const leavingRef = useRef(false);
  const swipeY0 = useRef<number | null>(null);
  const swipeIgnore = useRef(false);
  const wheelLock = useRef(false);

  const dust = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const top = Math.pow(((i * 19) % 100) / 100, 1.4) * 100;
        const left = (i * 41) % 100;
        const s = i % 10 === 0 ? 1.1 + (i % 3) * 0.25 : 0.35 + (i % 5) * 0.1;
        return { top, left, s, o: 0.14 + (i % 6) * 0.05, tw: 3 + (i % 5), d: (i % 5) * 0.8, key: i };
      }),
    [],
  );

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase("live");
      return;
    }
    const t = window.setTimeout(() => setPhase("live"), 720);
    return () => clearTimeout(t);
  }, []);

  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onBack();
      return;
    }
    setPhase("exit");
    window.setTimeout(() => onBack(), EXIT_MS);
  }, [onBack]);

  const swipeTargetIgnored = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el?.closest) return false;
    // Detail sheet / chrome controls own their gestures.
    return Boolean(el.closest(".onyx-sky-back, .onyx-stone-track, .cp-sky-object-panel, button, a, input, textarea"));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "touch" && e.isPrimary === false) {
      swipeIgnore.current = true;
      swipeY0.current = null;
      return;
    }
    if (swipeTargetIgnored(e.target)) {
      swipeIgnore.current = true;
      swipeY0.current = null;
      return;
    }
    swipeIgnore.current = false;
    swipeY0.current = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (swipeIgnore.current || swipeY0.current == null) {
      swipeIgnore.current = false;
      swipeY0.current = null;
      return;
    }
    const dy = e.clientY - swipeY0.current;
    swipeY0.current = null;
    // Finger moves down → back to the street (inverse of home → sky).
    if (dy > 72) leave();
  };

  const onPointerCancel = () => {
    swipeY0.current = null;
    swipeIgnore.current = false;
  };

  const phaseClass =
    phase === "enter" ? " onyx-sky-enter" : phase === "exit" ? " onyx-sky-exit" : "";

  return (
    <div className={`onyx-root${phaseClass}`}>
      <div
        className="onyx-device onyx-sky-device"
        role="application"
        aria-label="Delphi sky view"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={e => {
          if (wheelLock.current) return;
          if (e.deltaY <= 40) return;
          wheelLock.current = true;
          window.setTimeout(() => {
            wheelLock.current = false;
          }, 700);
          leave();
        }}
        onKeyDown={e => {
          if (e.key === "Escape" || e.key === "ArrowDown") leave();
        }}
        tabIndex={0}
      >
        <button type="button" className="onyx-sky-back" onClick={leave}>
          ← home
        </button>
        <OnyxAudioStone enabled={hapticsEnabled} onEnabledChange={onPulseEnabledChange} />

        <div className="onyx-sky-live">
          <CelestialSkyView
            lat={lat}
            lon={lon}
            observerAltM={altM}
            headingDeg={headingDeg}
            pitchDeg={pitchDeg}
            liveAttitudeRef={liveAttitudeRef}
            observationTime={now}
            liveHeading={liveHeading}
            livePitch={livePitch}
            arPoseReady={arPoseReady}
            hapticsEnabled={hapticsEnabled}
            warmth={warmth}
            weather={weather}
          />
        </div>

        {/* Soft purple dust veil over the live canvas */}
        <div className="onyx-sky-drift" aria-hidden>
          {dust.map(d => (
            <span
              key={d.key}
              className="onyx-dust"
              style={{
                top: `${d.top}%`,
                left: `${d.left}%`,
                width: d.s,
                height: d.s,
                ["--o" as string]: d.o,
                ["--tw" as string]: `${d.tw}s`,
                ["--d" as string]: `${d.d}s`,
              }}
            />
          ))}
        </div>

        <div className="onyx-reticle" aria-hidden>
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r="20" fill="none" stroke="var(--onyx-edge)" strokeWidth="0.5" />
            <line x1="23" y1="4" x2="23" y2="12" stroke="var(--onyx-edge-bright)" strokeWidth="0.75" />
            <line x1="23" y1="34" x2="23" y2="42" stroke="var(--onyx-edge-bright)" strokeWidth="0.75" />
            <line x1="4" y1="23" x2="12" y2="23" stroke="var(--onyx-edge-bright)" strokeWidth="0.75" />
            <line x1="34" y1="23" x2="42" y2="23" stroke="var(--onyx-edge-bright)" strokeWidth="0.75" />
          </svg>
        </div>

        <div className="onyx-sky-top">
          <span className="onyx-wordmark">DELPHI</span>
        </div>
        <div className="onyx-sky-coords">
          <span>
            {Math.abs(lat).toFixed(2)}°{lat >= 0 ? "N" : "S"} · looking {look} · {pitchLabel}°
          </span>
          <span>{time}</span>
        </div>

        <div className="onyx-heading-mark" aria-hidden>
          <svg width="12" height="8">
            <path d="M6 8 L0 0 L12 0 Z" fill="var(--onyx-core)" />
          </svg>
        </div>
        <div className="onyx-heading" aria-hidden>
          <div className="onyx-ribbon" style={{ transform: `translateX(${ribbonX}px)` }}>
            {DIRS.map((d, i) => (
              <span key={`${d}-${i}`} className={`onyx-tick${CARD.includes(d) ? " card" : ""}`}>
                {d}
              </span>
            ))}
          </div>
        </div>

        <p className="onyx-sky-hint">
          {live
            ? arPoseReady
              ? "Live AR — aim the phone · swipe down for home"
              : "Hold the phone more upright to lock AR pose"
            : "Allow motion & location — then aim the phone at the sky"}
        </p>
        {sensorDiag ? (
          <p className="onyx-sky-sensor" aria-live="polite">
            sensor: {sensorDiag.events} events · {sensorDiag.status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
