"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import type { CosmicClockState } from "../../lib/cosmic";
import type { CycleSnapshot } from "../../lib/cycleSystems";
import type { CycleReading, WorldCyclePreferences } from "../../lib/worldCycles";
import type { SkyWeatherSlot } from "../../lib/cosmic/skyWeather";
import { jdFromDate } from "../../lib/phase/timeResolution";
import { composeMoment } from "../../lib/lore/compose";
import { resolveMoment } from "../../lib/lore/resolveMoment";
import {
  fetchModelPhrase,
  phraseCacheKey,
  phraseForMoment,
  writeCachedPhrase,
} from "../../lib/lore/distillPhrase";
import { loadBirth, type BirthRecord } from "../../lib/lore/birthStore";
import {
  castLeanKey,
  latestCastLean,
  loadEmbraced,
  type EmbracedCast,
} from "../../lib/lore/castStore";
import { natalGalactic } from "../../lib/lore/resolvePerson";
import { DashboardContainer } from "../DashboardContainer";
import type { RingSelectHandler } from "../CosmicClockWheel";
import type { LiveAttitude } from "../CelestialSkyView";
import { AtlasPanel } from "../AtlasPanel";
import { SensorArray, type SensorArrayProps } from "../SensorArray";
import { EmfReader } from "../EmfReader";
import { PauloVenturaHub } from "../PauloVenturaHub";
import { OnyxHome } from "./OnyxHome";
import { OnyxSky } from "./OnyxSky";
import { OnyxSplash } from "./OnyxSplash";
import { OnyxYou } from "./OnyxYou";
import { OnyxCast } from "./OnyxCast";
import { OnyxAbout } from "./OnyxAbout";
import { OnyxDecompose } from "./OnyxDecompose";
import { DeviceAccessGate } from "./DeviceAccessGate";
import "./onyx.css";

export type OnyxMode =
  | "home"
  | "sky"
  | "rings"
  | "tools"
  | "atlas"
  | "senses"
  | "oracle"
  | "you"
  | "cast"
  | "about"
  | "decompose";

export function OnyxApp({
  showSplash,
  onSplashDone,
  onPrimeAccess,
  showAccessGate = false,
  onAllowAccess,
  accessBusy = false,
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
  skyWeather = null,
  skyWarmth = 0.55,
  onEnterSky,
  cycles,
  cosmic,
  stripReadings,
  multiVoice,
  cyclePrefs,
  onCyclePrefsChange,
  onRingSelect,
  onTellMore,
  emfUt,
  emfLive,
  emfMethod,
  sensorProps,
  oracleExtra,
  pulseEnabled = true,
  onPulseEnabledChange,
}: {
  showSplash: boolean;
  onSplashDone: () => void;
  /** Sync from splash tap — iOS sensor permission must stay on the gesture. */
  onPrimeAccess?: () => void;
  /** Fallback when splash was skipped / auto-ended before priming. */
  showAccessGate?: boolean;
  onAllowAccess?: () => void;
  accessBusy?: boolean;
  now: Date;
  lat: number;
  lon: number;
  altM: number | null;
  headingDeg: number;
  pitchDeg: number;
  liveAttitudeRef?: RefObject<LiveAttitude>;
  liveHeading?: boolean;
  livePitch?: boolean;
  arPoseReady?: boolean;
  skyWeather?: SkyWeatherSlot | null;
  skyWarmth?: number;
  /** Start orientation/location watches from the sky-open gesture. */
  onEnterSky?: () => void;
  cycles: CycleSnapshot | null;
  cosmic: CosmicClockState | null;
  stripReadings: CycleReading[];
  multiVoice?: string;
  cyclePrefs: WorldCyclePreferences;
  onCyclePrefsChange: (next: WorldCyclePreferences) => void;
  onRingSelect?: RingSelectHandler;
  onTellMore?: (name: string) => void;
  emfUt?: number | null;
  emfLive?: boolean;
  emfMethod?: string | null;
  sensorProps?: SensorArrayProps;
  oracleExtra?: ReactNode;
  pulseEnabled?: boolean;
  onPulseEnabledChange?: (on: boolean) => void;
}) {
  const [mode, setMode] = useState<OnyxMode>("home");
  const [distilled, setDistilled] = useState<string>("");
  const [birth, setBirth] = useState<BirthRecord | null>(null);
  const [embraced, setEmbraced] = useState<EmbracedCast[]>([]);

  // Local-only natal + embraced casts — never sent; retune the street phrase.
  useEffect(() => {
    setBirth(loadBirth());
    setEmbraced(loadEmbraced());
  }, []);

  const phaseFraction = cosmic?.lunarPhaseFraction ?? cycles?.lunar?.fraction ?? 0.35;

  const civilYmd = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [now]);

  const natal = useMemo(() => (birth ? natalGalactic(birth) : null), [birth]);
  const colorLean = natal?.tribe.color;
  const castLean = useMemo(() => latestCastLean(embraced), [embraced]);
  const distillOpts = useMemo(() => {
    if (!colorLean && castLean.length === 0) return undefined;
    return {
      ...(colorLean ? { colorLean } : {}),
      ...(castLean.length ? { castLean } : {}),
    };
  }, [colorLean, castLean]);
  const leanCacheKey = useMemo(() => castLeanKey(embraced), [embraced]);

  const momentBundle = useMemo(() => {
    const jd = jdFromDate(now);
    const resolved = resolveMoment(jd, lat, lon);
    return composeMoment(resolved.entries, lat, lon, {
      localMonth: now.getMonth() + 1,
    });
  }, [now, lat, lon]);

  // Birth color + embraced casts retune the street phrase locally.
  // When personal lean is active, the deterministic template wins — the model
  // must not overwrite a leaned phrase with a generic sky-only sentence.
  useEffect(() => {
    const { phrase } = phraseForMoment(momentBundle.chord, civilYmd, lat, lon, distillOpts);
    setDistilled(phrase);
    const hasPersonalLean = Boolean(
      distillOpts?.colorLean || (distillOpts?.castLean && distillOpts.castLean.length > 0),
    );
    if (hasPersonalLean) return;
    const key = phraseCacheKey(civilYmd, lat, lon, distillOpts?.colorLean, leanCacheKey);
    let cancelled = false;
    void (async () => {
      const model = await fetchModelPhrase(momentBundle.chord, distillOpts);
      if (cancelled || !model) return;
      writeCachedPhrase(key, model);
      setDistilled(model);
    })();
    return () => {
      cancelled = true;
    };
  }, [momentBundle, civilYmd, lat, lon, distillOpts, leanCacheKey]);

  const zodiacSign = cycles?.westernZodiac?.sign ?? "the sky";
  // Home / NOW street line = distilled chorus of mainframe qualities only.
  // Calendar name-drops (Leo, Fire Horse, Kin…) stay under the clock rows
  // via calendarReadings / Atlas multiVoice — never concatenated here.
  const momentLine = distilled || "Reading the sky…";
  void multiVoice;

  const dayGalactic = cycles?.galactic;
  const selfTone = natal ? (
    <>
      You are Kin {natal.kin} —
      <br />
      {natal.tone.name} {natal.tribe.name}.
    </>
  ) : dayGalactic ? (
    <>
      Today is Kin {dayGalactic.kin} —
      <br />
      {dayGalactic.tone.name} {dayGalactic.tribe.name}.
    </>
  ) : (
    <>
      You are near the close
      <br />
      of a long orbit.
    </>
  );
  const selfRet = natal ? (
    <>
      Tone <b>{natal.tone.tone}</b> {natal.tone.name}.
      <br />
      {natal.tribe.color} {natal.tribe.name} · {natal.tribe.mayaSign}.
      <br />
      {birth?.hour !== undefined
        ? "Your hour shapes the rising chord beneath this kin."
        : "Add your birth hour in You — it shapes rising math."}
    </>
  ) : dayGalactic ? (
    <>
      Tone <b>{dayGalactic.tone.tone}</b> {dayGalactic.tone.name}.
      <br />
      {dayGalactic.tribe.color} {dayGalactic.tribe.name} · {dayGalactic.tribe.mayaSign}.
      <br />
      Save your birth in You to hear this in your color.
    </>
  ) : (
    <>Hold still. The sky is still reading you.</>
  );

  // Access gate is first — before splash — so permissions land on open.
  if (showAccessGate && onAllowAccess) {
    return <DeviceAccessGate onAllow={onAllowAccess} busy={accessBusy} />;
  }

  if (showSplash) {
    return (
      <OnyxSplash onEnter={onSplashDone} onPrimeAccess={onPrimeAccess} />
    );
  }

  const openSky = () => {
    // Must stay on the user gesture path for iOS DeviceOrientation permission.
    onEnterSky?.();
    setMode("sky");
  };

  if (mode === "sky") {
    return (
      <OnyxSky
        now={now}
        lat={lat}
        lon={lon}
        altM={altM ?? 0}
        headingDeg={headingDeg}
        pitchDeg={pitchDeg}
        liveAttitudeRef={liveAttitudeRef}
        liveHeading={liveHeading}
        livePitch={livePitch}
        arPoseReady={arPoseReady}
        hapticsEnabled={pulseEnabled}
        warmth={skyWarmth}
        weather={skyWeather}
        onBack={() => setMode("home")}
      />
    );
  }

  if (mode === "rings" && cosmic) {
    return (
      <div className="onyx-root">
        <div className="onyx-device onyx-device-scroll" style={{ background: "#000" }}>
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div style={{ paddingTop: 48 }}>
            <DashboardContainer
              lat={lat}
              lon={lon}
              cosmic={cosmic}
              onRingSelect={onRingSelect}
              weather={
                cycles?.weather
                  ? {
                      emoji: cycles.weather.emoji,
                      condition: cycles.weather.condition,
                      tempC: cycles.weather.tempC ?? null,
                    }
                  : null
              }
              atlasReadings={stripReadings.filter(r =>
                ["hijri", "hebrew", "persian", "ethiopian", "chinese_lunisolar"].includes(r.systemId),
              )}
              showAtlasOnWheel={true}
              liveCoords
              usingFallback={false}
              locationDenied={false}
              locationEnabled
              accuracyM={null}
              altM={altM}
              altAccuracyM={null}
              speedMps={null}
              gpsHeading={null}
              locationAtMs={null}
              compassHeading={headingDeg}
              compassOffsetDeg={0}
              declinationDeg={0}
              pitchDeg={pitchDeg}
              emfUt={emfUt ?? null}
            />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "tools") {
    return (
      <div className="onyx-root">
        <div className="onyx-device">
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div className="onyx-overlay" style={{ position: "relative", background: "transparent" }}>
            <p className="onyx-eyebrow" style={{ marginTop: 8 }}>
              INSTRUMENTS
            </p>
            <div className="onyx-tools-grid">
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("rings")}>
                The rings
                <span>Cosmic clock wheel</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("atlas")}>
                Atlas
                <span>World cycle calendars</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("senses")}>
                Senses
                <span>Device instruments</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("oracle")}>
                Oracle
                <span>Ask / research</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={openSky}>
                Sky
                <span>Live sky with object details</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("you")}>
                You
                <span>Natal chord — local only, never sent</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("cast")}>
                Cast
                <span>Side-door draw — not the home chord</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => setMode("about")}>
                About
                <span>Honesty tiers & integrity</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "you") {
    return (
      <OnyxYou
        nowChord={momentBundle.chord}
        onBack={() => setMode("home")}
        onBirthSaved={next => {
          setBirth(next);
          setMode("home");
        }}
      />
    );
  }

  if (mode === "cast") {
    return (
      <OnyxCast
        onBack={() => setMode("home")}
        onEmbraced={list => {
          setEmbraced(list);
          setMode("home");
        }}
      />
    );
  }

  if (mode === "about") {
    return <OnyxAbout onBack={() => setMode("home")} />;
  }

  if (mode === "decompose") {
    return (
      <OnyxDecompose chord={momentBundle.chord} onBack={() => setMode("home")} />
    );
  }

  if (mode === "atlas") {
    return (
      <div className="onyx-root">
        <div className="onyx-device onyx-device-scroll">
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div className="onyx-overlay">
            <AtlasPanel prefs={cyclePrefs} onChange={onCyclePrefsChange} />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "senses") {
    return (
      <div className="onyx-root">
        <div className="onyx-device onyx-device-scroll">
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div className="onyx-overlay">
            <EmfReader
              className="cp-card"
              emfUt={emfUt ?? null}
              live={Boolean(emfLive)}
              method={emfMethod ?? null}
              latDeg={lat}
            />
            <SensorArray className="cp-card" autoAwaken {...sensorProps} />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "oracle") {
    return (
      <div className="onyx-root">
        <div className="onyx-device onyx-device-scroll">
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div className="onyx-overlay">
            <PauloVenturaHub className="cp-card" />
            {oracleExtra}
          </div>
        </div>
      </div>
    );
  }

  const landCalendarLine =
    momentBundle.landCalendar.length > 0
      ? `Land calendar · ${momentBundle.landCalendar[0]!.name}`
      : null;
  const landAcknowledgment = momentBundle.acknowledgment
    ? {
        text: momentBundle.acknowledgment.text,
        people: momentBundle.acknowledgment.people,
        pointTo: momentBundle.acknowledgment.pointTo,
      }
    : null;

  return (
    <OnyxHome
      now={now}
      phaseFraction={phaseFraction}
      zodiacSign={zodiacSign}
      momentLine={momentLine}
      selfTone={selfTone}
      selfRet={selfRet}
      calendarReadings={stripReadings.slice(0, 8)}
      landCalendarLine={landCalendarLine}
      landAcknowledgment={landAcknowledgment}
      heldCasts={embraced.slice(0, 3)}
      onOpenSky={openSky}
      onOpenRings={() => setMode("rings")}
      onOpenTools={() => setMode("tools")}
      onOpenWhy={() => setMode("decompose")}
      onOpenYou={() => setMode("you")}
      onOpenCast={() => setMode("cast")}
      pulseEnabled={pulseEnabled}
      onPulseEnabledChange={onPulseEnabledChange}
    />
  );
}
