"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from "react";
import {
  CelestialSkyView,
  type AimedSkyObject,
  type LiveAttitude,
} from "../CelestialSkyView";
import { SkyObjectDetailPanel, type SkyObjectDetail } from "../SkyObjectDetailPanel";
import type { SkyWeatherSlot } from "../../lib/cosmic/skyWeather";
import { pulseHaptic } from "../../lib/haptics";
import { meanLookAzAlt } from "../../lib/orientationCalibration";
import { altAzToEnu, enuToAltAz } from "../../lib/sphericalView";
import { SKY_RIBBON_DIRS, skyRibbonTranslateX } from "../../lib/skyRibbon";
import { ChamberHeader } from "./ChamberHeader";
import { cardinalFromHeading } from "./onyxCopy";
import { SkyOrrery } from "./SkyOrrery";

const LOCK_HOLD_MS = 3000;
const LOCK_SAMPLE_MS = 400;

type PendingSkyLock = {
  kind: "object" | "sun" | "moon";
  az: number;
  alt: number;
  name: string;
  id?: string;
};

const CARD = ["N", "E", "S", "W", "NE", "SE", "SW", "NW"];
const EXIT_MS = 480;
const PULL_ARM_MS = 1600;
const PULL_DISTANCE_PX = 60;

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
  skyLookRef,
  skyLookSnapRef,
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
  onCalibrateLookToObject?: (az: number, alt: number, name?: string, id?: string) => void;
  onResetSkyCalibration?: () => void;
  headingDeg: number;
  pitchDeg: number;
  liveAttitudeRef?: RefObject<LiveAttitude>;
  skyLookRef?: MutableRefObject<{ az: number; alt: number } | null>;
  skyLookSnapRef?: MutableRefObject<boolean>;
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
  const openAimedDetailRef = useRef<(() => void) | null>(null);
  const [skyDetail, setSkyDetail] = useState<SkyObjectDetail | null>(null);
  const [lockHold, setLockHold] = useState<PendingSkyLock | null>(null);
  const [lockRemainMs, setLockRemainMs] = useState(0);
  const lookSamplesRef = useRef<Array<{ t: number; az: number; alt: number }>>([]);
  const headingRef = useRef(headingDeg);
  const pitchRef = useRef(pitchDeg);
  headingRef.current = headingDeg;
  pitchRef.current = pitchDeg;
  const fireLockRef = useRef<(pending: PendingSkyLock) => void>(() => {});
  fireLockRef.current = pending => {
    if (hapticsEnabled) void pulseHaptic("deep");
    if (pending.kind === "sun") onCalibrateSun?.();
    else if (pending.kind === "moon") onCalibrateMoon?.();
    else onCalibrateLookToObject?.(pending.az, pending.alt, pending.name, pending.id);
  };

  const beginLockHold = useCallback((pending: PendingSkyLock) => {
    lookSamplesRef.current = [];
    setSkyDetail(null);
    setLockRemainMs(LOCK_HOLD_MS);
    setLockHold(pending);
  }, []);

  useEffect(() => {
    if (!lockHold) return;
    const started = performance.now();
    lookSamplesRef.current = [];
    let raf = 0;
    let lastShown = -1;
    const tick = (now: number) => {
      const view = liveAttitudeRef?.current?.view;
      const look = view
        ? enuToAltAz(view)
        : { az: headingRef.current, alt: pitchRef.current };
      lookSamplesRef.current.push({ t: now, az: look.az, alt: look.alt });
      const cutoff = now - LOCK_SAMPLE_MS;
      while (lookSamplesRef.current.length && lookSamplesRef.current[0].t < cutoff) {
        lookSamplesRef.current.shift();
      }
      const remain = Math.max(0, LOCK_HOLD_MS - (now - started));
      const shown = Math.max(1, Math.ceil(remain / 1000));
      if (shown !== lastShown) {
        lastShown = shown;
        setLockRemainMs(remain);
      }
      if (remain <= 0) {
        const mean = meanLookAzAlt(lookSamplesRef.current);
        if (mean && liveAttitudeRef?.current) {
          liveAttitudeRef.current.view = altAzToEnu(mean.az, mean.alt);
        }
        const pending = lockHold;
        setLockHold(null);
        fireLockRef.current(pending);
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [lockHold, liveAttitudeRef]);

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

  // The orrery is a sub-view with its own history entry, so phone/browser Back closes it.
  const [orreryOpen, setOrreryOpen] = useState(false);
  const [orreryRise, setOrreryRise] = useState(false);
  const [pullArm, setPullArm] = useState(0);
  useEffect(() => {
    const sync = () => {
      const s = window.history.state as { skyOrrery?: number } | null;
      setOrreryOpen(Boolean(s?.skyOrrery));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const openOrrery = useCallback((rise = false) => {
    const s = (window.history.state ?? {}) as { depth?: number };
    window.history.pushState(
      { ...s, depth: (s.depth ?? 0) + 1, skyOrrery: 1 },
      "",
      window.location.href,
    );
    setSkyDetail(null);
    setPullArm(0);
    setOrreryRise(rise);
    setOrreryOpen(true);
  }, []);

  // Centre tap arms a short window; a scroll / swipe UP inside it pulls back into the orrery.
  // Without the tap, scrolling stays inert.
  const onEmptySkyTap = useCallback((x: number, y: number, w: number, h: number) => {
    if (Math.abs(x - w / 2) > w * 0.15 || Math.abs(y - h / 2) > h * 0.15) return;
    setPullArm(n => n + 1);
  }, []);
  useEffect(() => {
    if (!pullArm || orreryOpen) return;
    const expire = window.setTimeout(() => setPullArm(0), PULL_ARM_MS);
    let wheelUp = 0;
    let swipe: { id: number; x: number; y: number } | null = null;
    const onWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      if (e.deltaY < 0) wheelUp += -e.deltaY * unit;
      if (wheelUp >= PULL_DISTANCE_PX) openOrrery(true);
    };
    const onDown = (e: PointerEvent) => {
      swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      const up = swipe.y - e.clientY;
      const side = Math.abs(e.clientX - swipe.x);
      if (up >= PULL_DISTANCE_PX && side < up * 0.6) {
        swipe = null;
        openOrrery(true);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (swipe && e.pointerId === swipe.id) swipe = null;
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.clearTimeout(expire);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pullArm, orreryOpen, openOrrery]);
  const closeOrrery = useCallback(() => {
    const s = window.history.state as { skyOrrery?: number } | null;
    if (s?.skyOrrery) window.history.back();
    else setOrreryOpen(false);
  }, []);

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

  const phaseClass =
    phase === "enter" ? " onyx-sky-enter" : phase === "exit" ? " onyx-sky-exit" : "";

  const hint = !locationLive
    ? "Waiting on GPS — stars use approx location until a fix lands"
    : live
      ? arPoseReady
        ? aimed
          ? `${aimed.name} in the reticle · open it, then Lock and hold still`
          : skyLockName
            ? `Locked to ${skyLockName} · tap an object for details`
            : "Tap a planet or star for details, then Lock and hold still on it"
        : "Hold the phone more upright to lock AR pose"
      : "Allow motion & location — then aim the phone at the sky";

  return (
    <div className={`onyx-root${phaseClass}`}>
      <div
        className={`onyx-device onyx-sky-device${lockHold ? " is-lock-hold" : ""}`}
        role="application"
        aria-label="Pneuma Mundi sky view"
        tabIndex={0}
      >
        <ChamberHeader title="Aether" onBack={leave} />

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
            onLockLookToObject={
              onCalibrateLookToObject
                ? (az, alt, name, id) =>
                    beginLockHold({ kind: "object", az, alt, name, id })
                : undefined
            }
            aimedLiveRef={aimedLiveRef}
            skyLookRef={skyLookRef}
            skyLookSnapRef={skyLookSnapRef}
            onSelectDetail={setSkyDetail}
            openAimedDetailRef={openAimedDetailRef}
            paused={orreryOpen}
            onEmptyTap={onEmptySkyTap}
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
          <span className="onyx-wordmark">Pneuma Mundi</span>
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

        {!skyDetail && !lockHold ? (
          <div className="onyx-sky-align" role="group" aria-label="Sky perspective lock">
            {aimed ? (
              <button
                type="button"
                className="onyx-sky-align-btn onyx-sky-lock-btn"
                onClick={() => openAimedDetailRef.current?.()}
                title="Open details, then lock this view"
              >
                {aimed.name}
              </button>
            ) : null}
            <div className="onyx-sky-align-row">
              <button
                type="button"
                className="onyx-sky-align-btn onyx-sky-orrery-btn"
                onClick={() => openOrrery(false)}
                title="Pull back and watch the planets and moons cycle on their real orbits"
              >
                Orrery
              </button>
              <button
                type="button"
                className="onyx-sky-align-btn"
                disabled={!sunAboveHorizon || !onCalibrateSun}
                onClick={() =>
                  beginLockHold({ kind: "sun", name: "Sun", id: "sun", az: 0, alt: 0 })
                }
                title="Point at the sun, then tap — hold still while it counts down"
              >
                Align sun
              </button>
              <button
                type="button"
                className="onyx-sky-align-btn"
                disabled={!moonAboveHorizon || !onCalibrateMoon}
                onClick={() =>
                  beginLockHold({ kind: "moon", name: "Moon", id: "moon", az: 0, alt: 0 })
                }
                title="Point at the moon, then tap — hold still while it counts down"
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
        ) : null}

        {!skyDetail && !lockHold ? <p className="onyx-sky-hint">{hint}</p> : null}
        {sensorDiag ? (
          <p className="onyx-sky-sensor" aria-live="polite">
            sensor: {sensorDiag.events} events · {sensorDiag.status}
          </p>
        ) : null}

        {skyDetail ? (
          <SkyObjectDetailPanel
            detail={skyDetail}
            onClose={() => setSkyDetail(null)}
            onLockLook={
              onCalibrateLookToObject
                ? (az, alt, name, id) =>
                    beginLockHold({ kind: "object", az, alt, name, id })
                : undefined
            }
          />
        ) : null}

        {lockHold ? (
          <div className="onyx-sky-lock-hold" role="status" aria-live="assertive">
            <p className="onyx-sky-lock-hold-count">
              {Math.max(1, Math.ceil(lockRemainMs / 1000))}
            </p>
            <p className="onyx-sky-lock-hold-copy">Hold still on {lockHold.name}</p>
            <button
              type="button"
              className="onyx-sky-lock-hold-cancel"
              onClick={() => setLockHold(null)}
            >
              Cancel
            </button>
          </div>
        ) : null}

        {pullArm > 0 && !orreryOpen ? (
          <div key={pullArm} className="onyx-sky-pull-cue" role="status" aria-live="polite">
            <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
              <circle cx="22" cy="22" r="19" fill="none" stroke="var(--onyx-edge-bright)" strokeWidth="0.75" />
              <path d="M15 25 L22 18 L29 25" fill="none" stroke="var(--onyx-core)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span>scroll up to pull back</span>
          </div>
        ) : null}

        {orreryOpen ? <SkyOrrery onClose={closeOrrery} rise={orreryRise} /> : null}
      </div>
    </div>
  );
}
