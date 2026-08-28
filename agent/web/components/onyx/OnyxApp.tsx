"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import type { CosmicClockState } from "../../lib/cosmic";
import type { CycleSnapshot } from "../../lib/cycleSystems";
import type { CycleReading, WorldCyclePreferences } from "../../lib/worldCycles";
import type { SkyWeatherSlot } from "../../lib/cosmic/skyWeather";
import { jdFromDate } from "../../lib/phase/timeResolution";
import {
  composeLayers,
  provenance,
  takeSnapshot,
  type LayerId,
  type MomentSnapshot,
} from "../../lib/lore/compose";
import { resolveMoment } from "../../lib/lore/resolveMoment";
import { phraseForMoment } from "../../lib/lore/distillPhrase";
import { loadBirth, type BirthRecord } from "../../lib/lore/birthStore";
import {
  clearEmbraced,
  loadEmbraced,
  releaseEmbraced,
  type EmbracedCast,
} from "../../lib/lore/castStore";
import { natalGalactic, resolvePerson } from "../../lib/lore/resolvePerson";
import { byId } from "../../lib/lore/qualia";
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
import { OnyxOrrery } from "./OnyxOrrery";
import { OnyxOrrerySplash } from "./OnyxOrrerySplash";
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
  sensorsUnlocked = false,
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
  sensorDiag,
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
  /** True after Allow access — crystal + sky can bind to DeviceOrientation. */
  sensorsUnlocked?: boolean;
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
  sensorDiag?: { events: number; status: "none" | "ok" | "event-but-null" | "denied" };
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
  /** Locked Layer-0 reading — taken on home open / return, never per-tick. */
  const [homeSnap, setHomeSnap] = useState<MomentSnapshot | null>(null);
  /** Clock-entry film — plays each time the user swipes into the orrery. */
  const [orreryIntro, setOrreryIntro] = useState(true);

  // Local-only natal + embraced casts — never sent; fold into labeled layers.
  useEffect(() => {
    setBirth(loadBirth());
    setEmbraced(loadEmbraced());
  }, []);

  function resetHeldDivinations() {
    setEmbraced(clearEmbraced());
    setActiveLayerChoice(prev => (prev === "with-drawn" ? undefined : prev));
  }

  const phaseFraction = cosmic?.lunarPhaseFraction ?? cycles?.lunar?.fraction ?? 0.35;
  const homeReady = !showAccessGate && !showSplash;
  void onRingSelect;

  // Snapshot locks when home opens or when the user returns — not on the clock tick.
  useEffect(() => {
    if (!homeReady || mode !== "home") return;
    const jd = jdFromDate(new Date());
    const resolved = resolveMoment(jd, lat, lon);
    setHomeSnap(takeSnapshot(resolved.entries, lat, lon));
  }, [homeReady, mode, lat, lon]);

  const civilYmd = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [now]);

  const natal = useMemo(() => (birth ? natalGalactic(birth) : null), [birth]);

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

  const lockedMomentEntries = homeSnap?.ordered ?? [];

  const layered = useMemo(
    () =>
      composeLayers(lockedMomentEntries, {
        natal: natalEntries,
        drawn: drawnEntries,
        active: activeLayerChoice,
      }),
    [lockedMomentEntries, natalEntries, drawnEntries, activeLayerChoice],
  );

  const activeReading = useMemo(
    () => layered.layers.find(l => l.id === layered.active) ?? layered.layers[0]!,
    [layered],
  );

  const snapProvenance = useMemo(
    () => (homeSnap ? provenance(homeSnap) : null),
    [homeSnap],
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
    const snapFp = homeSnap?.takenAt ?? 0;
    return `${layered.active}:${snapFp}:${natalFp}:${drawnFp}`;
  }, [layered.active, natalEntries, drawnEntries, homeSnap?.takenAt]);

  // Local speak() on the ACTIVE layer chord — no fetch, no API key (Addendum 5).
  useEffect(() => {
    if (!homeSnap || lockedMomentEntries.length === 0) return;
    const { phrase } = phraseForMoment(
      activeReading.chord,
      civilYmd,
      lat,
      lon,
      undefined,
      layerCacheKey,
    );
    setDistilled(phrase);
  }, [
    homeSnap,
    lockedMomentEntries.length,
    activeReading,
    layered.active,
    civilYmd,
    lat,
    lon,
    layerCacheKey,
  ]);

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

  // Access gate FIRST on every load — before splash/home — so OS prompts
  // always ride a user gesture at open, not after navigating back to home.
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
        sensorDiag={sensorDiag}
        onBack={() => setMode("home")}
      />
    );
  }

  if (mode === "rings") {
    if (orreryIntro) {
      return <OnyxOrrerySplash onEnter={() => setOrreryIntro(false)} />;
    }
    return (
      <OnyxOrrery
        lat={lat}
        lon={lon}
        onBack={() => {
          setOrreryIntro(true);
          setMode("home");
        }}
        hapticsEnabled={pulseEnabled}
      />
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
                Orrery
                <span>Stacked lanes · read the now-line</span>
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
              <button type="button" className="onyx-tool-btn" onClick={() => { window.location.href = "/studies"; }}>
                Studies
                <span>Polarity · Materia · Medica</span>
              </button>
              <button type="button" className="onyx-tool-btn" onClick={() => { window.location.href = "/tonal"; }}>
                Tonal
                <span>Covenant · roles · the ground</span>
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
        nowChord={homeSnap?.chord ?? activeReading.chord}
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
        held={embraced}
        onEmbraced={list => {
          setEmbraced(list);
          setActiveLayerChoice(undefined); // deepen to with-drawn
          setMode("home");
        }}
        onResetHeld={resetHeldDivinations}
      />
    );
  }

  if (mode === "about") {
    return <OnyxAbout onBack={() => setMode("home")} />;
  }

  if (mode === "decompose") {
    return (
      <OnyxDecompose
        chord={activeReading.chord}
        provenanceLine={snapProvenance?.line}
        onBack={() => setMode("home")}
      />
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
    homeSnap && homeSnap.landCalendar.length > 0
      ? `Land calendar · ${homeSnap.landCalendar[0]!.name}`
      : null;
  const landAcknowledgment = homeSnap?.acknowledgment
    ? {
        text: homeSnap.acknowledgment.text,
        people: homeSnap.acknowledgment.people,
        pointTo: homeSnap.acknowledgment.pointTo,
      }
    : null;

  return (
    <OnyxHome
      now={now}
      phaseFraction={phaseFraction}
      zodiacSign={zodiacSign}
      momentLine={momentLine}
      provenanceLine={snapProvenance?.line}
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
      onResetHeld={() => {
        resetHeldDivinations();
      }}
      onReleaseHeld={id => {
        const next = releaseEmbraced(id);
        setEmbraced(next);
        if (next.length === 0) {
          setActiveLayerChoice(prev => (prev === "with-drawn" ? undefined : prev));
        }
      }}
      onOpenSky={openSky}
      onOpenRings={() => setMode("rings")}
      onOpenTools={() => setMode("tools")}
      onOpenWhy={() => setMode("decompose")}
      onOpenYou={() => setMode("you")}
      onOpenCast={() => setMode("cast")}
      pulseEnabled={pulseEnabled}
      onPulseEnabledChange={onPulseEnabledChange}
      sensorsUnlocked={sensorsUnlocked}
    />
  );
}
