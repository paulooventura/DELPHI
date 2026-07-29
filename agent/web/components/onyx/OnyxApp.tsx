"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import type { CosmicClockState } from "../../lib/cosmic";
import type { CycleSnapshot } from "../../lib/cycleSystems";
import type { CycleReading, WorldCyclePreferences } from "../../lib/worldCycles";
import type { SkyWeatherSlot } from "../../lib/cosmic/skyWeather";
import { jdFromDate } from "../../lib/phase/timeResolution";
import {
  composeLayers,
  composeMoment,
  type LayerId,
} from "../../lib/lore/compose";
import { resolveMoment } from "../../lib/lore/resolveMoment";
import {
  fetchModelPhrase,
  phraseCacheKey,
  phraseForMoment,
  writeCachedPhrase,
} from "../../lib/lore/distillPhrase";
import { loadBirth, type BirthRecord } from "../../lib/lore/birthStore";
import { loadEmbraced, type EmbracedCast } from "../../lib/lore/castStore";
import { natalGalactic, resolvePerson } from "../../lib/lore/resolvePerson";
import { byId } from "../../lib/lore/qualia";
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
  /** Sticky user choice; undefined = deepest available (Addendum 2). */
  const [activeLayerChoice, setActiveLayerChoice] = useState<LayerId | undefined>();

  // Local-only natal + embraced casts — never sent; fold into labeled layers.
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

  const momentBundle = useMemo(() => {
    const jd = jdFromDate(now);
    const resolved = resolveMoment(jd, lat, lon);
    return composeMoment(resolved.entries, lat, lon, {
      localMonth: now.getMonth() + 1,
    });
  }, [now, lat, lon]);

  const natalEntries = useMemo(() => {
    if (!birth) return [];
    return resolvePerson(birth).entries.filter(e => e.honesty === "render");
  }, [birth]);

  const drawnEntries = useMemo(() => {
    const seen = new Set<string>();
    const out = [];
    for (const cast of embraced) {
      for (const id of cast.entryIds ?? []) {
        if (seen.has(id)) continue;
        const e = byId(id);
        if (e?.nature === "cast") {
          seen.add(id);
          out.push(e);
        }
      }
    }
    return out;
  }, [embraced]);

  const layered = useMemo(
    () =>
      composeLayers(momentBundle.ordered, {
        natal: natalEntries,
        drawn: drawnEntries,
        active: activeLayerChoice,
      }),
    [momentBundle.ordered, natalEntries, drawnEntries, activeLayerChoice],
  );

  const activeReading = useMemo(
    () => layered.layers.find(l => l.id === layered.active) ?? layered.layers[0]!,
    [layered],
  );

  const layerCacheKey = useMemo(() => {
    const natalFp = natalEntries
      .map(e => e.id)
      .sort()
      .join("+") || "none";
    const drawnFp = drawnEntries
      .map(e => e.id)
      .sort()
      .join("+") || "none";
    return `${layered.active}:${natalFp}:${drawnFp}`;
  }, [layered.active, natalEntries, drawnEntries]);

  // Distill the ACTIVE layer only. Layer 0 stays computed-only in composeLayers.
  useEffect(() => {
    const chord = activeReading.chord;
    const { phrase } = phraseForMoment(chord, civilYmd, lat, lon, undefined, layerCacheKey);
    setDistilled(phrase);
    // Personal layers keep the deterministic template so the model cannot
    // overwrite a natal/cast chord with a generic sky-only sentence.
    if (layered.active !== "moment") return;
    const key = phraseCacheKey(civilYmd, lat, lon, null, "none", layerCacheKey);
    let cancelled = false;
    void (async () => {
      const model = await fetchModelPhrase(chord);
      if (cancelled || !model) return;
      writeCachedPhrase(key, model);
      setDistilled(model);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeReading, layered.active, civilYmd, lat, lon, layerCacheKey]);

  const zodiacSign = cycles?.westernZodiac?.sign ?? "the sky";
  // Home street line = distilled chorus of the active reading layer.
  // Calendar name-drops stay under the clock rows — never concatenated here.
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
                <span>Draw — colours a labeled reading layer</span>
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
        nowChord={layered.layers[0]!.chord}
        onBack={() => setMode("home")}
        onBirthSaved={next => {
          setBirth(next);
          setActiveLayerChoice(undefined); // deepen to through-you
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
          setActiveLayerChoice(undefined); // deepen to with-drawn
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
      <OnyxDecompose chord={activeReading.chord} onBack={() => setMode("home")} />
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
      readingLayerLabel={activeReading.label}
      readingLayers={layered.layers.map(l => ({ id: l.id, label: l.label }))}
      activeLayerId={layered.active}
      onSelectLayer={id => setActiveLayerChoice(id)}
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
