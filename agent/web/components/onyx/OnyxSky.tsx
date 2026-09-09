"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  CelestialSkyView,
  type AimedSkyObject,
  type LiveAttitude,
} from "../CelestialSkyView";
import type { SkyWeatherSlot } from "../../lib/cosmic/skyWeather";
import { enuToAltAz } from "../../lib/sphericalView";
import { SKY_RIBBON_DIRS, skyRibbonTranslateX } from "../../lib/skyRibbon";
import { OnyxAudioStone } from "./OnyxAudioStone";
import { cardinalFromHeading } from "./onyxCopy";

const CARD = ["N", "E", "S", "W", "NE", "SE", "SW", "NW"];
const EXIT_MS = 480;

function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns} ${Math.abs(lon).toFixed(4)}°${ew}`;
}

export function OnyxSky({
  now,
  lat,
  lon,
  altM,
  locationLive = false,
  locationAccuracyM = null,
  locationDenied = false,
  magneticDeclinationDeg = 0,
  skyAzOffsetDeg = 0,
  skyLockName = "",
  sunAboveHorizon = false,
  moonAboveHorizon = false,
  onCalibrateSun,
  onCalibrateMoon,
  onCalibrateLookToObject,
  onResetSkyCalibration,
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
  locationLive?: boolean;
  locationAccuracyM?: number | null;
  locationDenied?: boolean;
  magneticDeclinationDeg?: number;
  skyAzOffsetDeg?: number;
  skyLockName?: string;
  sunAboveHorizon?: boolean;
  moonAboveHorizon?: boolean;
  onCalibrateSun?: () => void;
  onCalibrateMoon?: () => void;
  onCalibrateLookToObject?: (az: number, alt: number, name?: string) => void;
  onResetSkyCalibration?: () => void;
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
  const ribbonRef = useRef<HTMLDivElement>(null);
  const [lookAz, setLookAz] = useState(() => ((headingDeg % 360) + 360) % 360);
  const [lookAlt, setLookAlt] = useState(() => pitchDeg);
  const [aimed, setAimed] = useState<AimedSkyObject | null>(null);
  const aimedLiveRef = useRef<AimedSkyObject | null>(null);

  useEffect(() => {
    let raf = 0;
    let lastLabel = 0;
    const tick = (t: number) => {
      const view = liveAttitudeRef?.current?.view;
      const look = view ? enuToAltAz(view) : { az: headingDeg, alt: pitchDeg };
      const el = ribbonRef.current;
      const bar = el?.parentElement?.clientWidth || 390;
      if (el) el.style.transform = `translateX(${skyRibbonTranslateX(look.az, bar).toFixed(2)}px)`;
      if (t - lastLabel > 120) {
        lastLabel = t;
        setLookAz(look.az);
        setLookAlt(look.alt);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [headingDeg, pitchDeg, liveAttitudeRef]);

  const look = cardinalFromHeading(lookAz);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const pitchLabel = Number.isFinite(lookAlt) ? Math.round(lookAlt) : 0;
  const az = ((lookAz % 360) + 360) % 360;
  const locLine = formatLatLon(lat, lon);
  const accLabel =
    locationLive && locationAccuracyM != null && Number.isFinite(locationAccuracyM)
      ? `±${Math.max(1, Math.round(locationAccuracyM))}m`
      : null;
  const locStatus = locationLive
    ? accLabel
      ? `GPS ${accLabel}`
      : "GPS"
    : locationDenied
      ? "approx · GPS denied"
      : "approx Nashville";
  const declLabel = `${magneticDeclinationDeg >= 0 ? "+" : ""}${magneticDeclinationDeg.toFixed(1)}° decl`;
  const offsetLabel =
    Math.abs(skyAzOffsetDeg) >= 0.15
      ? `align ${skyAzOffsetDeg >= 0 ? "+" : ""}${skyAzOffsetDeg.toFixed(1)}°`
      : null;
  const lockLabel = skyLockName ? `locked to ${skyLockName}` : null;

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
    return Boolean(el.closest(".onyx-sky-back, .onyx-stone-track, .onyx-sky-align, .cp-sky-object-panel, button, a, input, textarea"));
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

  const hint = !locationLive
    ? "Waiting on GPS — stars use approx location until a fix lands"
    : live
      ? arPoseReady
        ? aimed
          ? `${aimed.name} in the reticle · tap Lock — this is where you see it now`
          : skyLockName
            ? `Locked to ${skyLockName} · aim at another object to retune · swipe down for home`
            : "Aim at a star or object, then Lock — this is where you see it now"
        : "Hold the phone more upright to lock AR pose"
      : "Allow motion & location — then aim the phone at the sky";

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
          HOME
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
            onAimedObjectChange={setAimed}
            onLockLookToObject={onCalibrateLookToObject}
            aimedLiveRef={aimedLiveRef}
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
          <span className={!locationLive ? "onyx-sky-coords-warn" : undefined}>
            {locLine}
            <span className="onyx-sky-coords-meta"> · {locStatus}</span>
          </span>
          <span>{time}</span>
        </div>
        <div className="onyx-sky-meta" aria-live="polite">
          looking {look} · {Math.round(az)}° · pitch {pitchLabel}° · {declLabel}
          {offsetLabel ? ` · ${offsetLabel}` : ""}
          {lockLabel ? ` · ${lockLabel}` : ""}
        </div>

        <div className="onyx-heading-mark" aria-hidden>
          <svg width="12" height="8">
            <path d="M6 8 L0 0 L12 0 Z" fill="var(--onyx-core)" />
          </svg>
        </div>
        <div className="onyx-heading" aria-hidden>
          <div
            ref={ribbonRef}
            className="onyx-ribbon"
          >
            {SKY_RIBBON_DIRS.map((d, i) => (
              <span key={`${d}-${i}`} className={`onyx-tick${CARD.includes(d) ? " card" : ""}`}>
                {d}
              </span>
            ))}
          </div>
        </div>

        <div className="onyx-sky-align" role="group" aria-label="Sky perspective lock">
          {aimed && onCalibrateLookToObject ? (
            <button
              type="button"
              className="onyx-sky-align-btn onyx-sky-lock-btn"
              onClick={() => {
                const live = aimedLiveRef.current ?? aimed;
                if (!live) return;
                onCalibrateLookToObject(live.az, live.alt, live.name);
              }}
              title="Point at it in the real sky, then tap — the rest of the map snaps to this view"
            >
              Lock {aimed.name}
            </button>
          ) : null}
          <div className="onyx-sky-align-row">
            <button
              type="button"
              className="onyx-sky-align-btn"
              disabled={!sunAboveHorizon || !onCalibrateSun}
              onClick={() => onCalibrateSun?.()}
              title="Point at the sun, then tap — snaps the sky to that view"
            >
              Align sun
            </button>
            <button
              type="button"
              className="onyx-sky-align-btn"
              disabled={!moonAboveHorizon || !onCalibrateMoon}
              onClick={() => onCalibrateMoon?.()}
              title="Point at the moon, then tap — snaps the sky to that view"
            >
              Align moon
            </button>
            {onResetSkyCalibration && (Math.abs(skyAzOffsetDeg) >= 0.15 || Boolean(skyLockName)) ? (
              <button
                type="button"
                className="onyx-sky-align-btn ghost"
                onClick={() => onResetSkyCalibration()}
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>

        <p className="onyx-sky-hint">{hint}</p>
        {sensorDiag ? (
          <p className="onyx-sky-sensor" aria-live="polite">
            sensor: {sensorDiag.events} events · {sensorDiag.status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
