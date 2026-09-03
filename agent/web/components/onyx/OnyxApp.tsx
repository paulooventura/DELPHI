"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import type { CosmicClockState } from "../../lib/cosmic";
import type { CycleSnapshot } from "../../lib/cycleSystems";
import type { CycleReading, WorldCyclePreferences } from "../../lib/worldCycles";
import { presetById } from "../../lib/worldCycles";
import type { SkyWeatherSlot } from "../../lib/cosmic/skyWeather";
import { jdFromDate } from "../../lib/phase/timeResolution";
import { skyPeriodAt } from "../../lib/skyPeriod";
import {
  composeLayers,
  provenance,
  takeSnapshot,
  type DistillOptions,
  type LayerId,
  type MomentSnapshot,
} from "../../lib/lore/compose";
import { resolveMoment } from "../../lib/lore/resolveMoment";
import { phraseCacheKeyFrom, phraseForMoment, requestBrainAvailability, requestPhraseBrain, writeCachedPhrase } from "../../lib/lore/distillPhrase";
import { loadBirth, type BirthRecord } from "../../lib/lore/birthStore";
import {
  clearEmbraced,
  loadEmbraced,
  releaseEmbraced,
  type EmbracedCast,
} from "../../lib/lore/castStore";
import { natalGalactic, resolvePerson } from "../../lib/lore/resolvePerson";
import {
  anyBrain,
  loadDistillPrefs,
  saveDistillPrefs,
  type BrainAvailability,
  type DistillPrefs,
} from "../../lib/lore/distillPrefs";
import { byId } from "../../lib/lore/qualia";
import type { RingSelectHandler } from "../CosmicClockWheel";
import type { LiveAttitude } from "../CelestialSkyView";
import { AtlasPanel } from "../AtlasPanel";
import { OnyxTimeCompendium } from "./OnyxTimeCompendium";
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
import { OnyxStarfield } from "./OnyxStarfield";
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

const ONYX_MODES: readonly OnyxMode[] = [
  "home",
  "sky",
  "rings",
  "tools",
  "atlas",
  "senses",
  "oracle",
  "you",
  "cast",
  "about",
  "decompose",
];

const MODE_ALIASES: Record<string, OnyxMode> = {
  sky: "sky",
  clock: "rings",
  rings: "rings",
  me: "you",
  you: "you",
  home: "home",
  moment: "home",
  cast: "cast",
  atlas: "atlas",
  senses: "senses",
  oracle: "oracle",
  tools: "tools",
  about: "about",
  decompose: "decompose",
};

function parseOnyxMode(raw: string | null): OnyxMode | null {
  if (!raw) return null;
  const alias = MODE_ALIASES[raw];
  if (alias) return alias;
  return ONYX_MODES.includes(raw as OnyxMode) ? (raw as OnyxMode) : null;
}

function modeFromSearch(): OnyxMode {
  if (typeof window === "undefined") return "home";
  const q = new URLSearchParams(window.location.search);
  return parseOnyxMode(q.get("mode") || q.get("tab")) ?? "home";
}

function writeModeToUrl(mode: OnyxMode) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (mode === "home") url.searchParams.delete("mode");
  else url.searchParams.set("mode", mode);
  url.searchParams.delete("tab");
  const next = `${url.pathname}${url.search}${url.hash}`;
  const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== now) window.history.replaceState(null, "", next);
}

export function OnyxApp({
  bootReady = true,
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
  /** False until sessionStorage is read — hold black so returns don't flash splash. */
  bootReady?: boolean;
  showSplash: boolean;
  onSplashDone: () => void;
  /** Sync from splash tap — iOS sensor permission must stay on the gesture. */
  onPrimeAccess?: () => void;
  /** After splash, once per app open until Allow. */
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
  const [mode, setModeState] = useState<OnyxMode>(modeFromSearch);
  const setMode = (next: OnyxMode) => {
    setModeState(next);
    writeModeToUrl(next);
  };
  const [distilled, setDistilled] = useState<string>("");
  const [birth, setBirth] = useState<BirthRecord | null>(null);
  const [embraced, setEmbraced] = useState<EmbracedCast[]>([]);
  /** Sticky user choice; undefined = deepest available (Addendum 2). */
  const [activeLayerChoice, setActiveLayerChoice] = useState<LayerId | undefined>();
  /** Locked Layer-0 reading — taken on home open / return, never per-tick. */
  const [homeSnap, setHomeSnap] = useState<MomentSnapshot | null>(null);
  /** Clock-entry film — plays each time the user swipes into the orrery. */
  const [orreryIntro, setOrreryIntro] = useState(true);
  /** Cast opens as an expansion of You, not a home-compass door. */
  const [castReturn, setCastReturn] = useState<"home" | "you">("you");
  const [youExpandCast, setYouExpandCast] = useState(false);
  const [distillPrefs, setDistillPrefs] = useState<DistillPrefs>(loadDistillPrefs);
  const [brains, setBrains] = useState<BrainAvailability | null>(null);

  const openStudies = () => {
    window.location.href = "/studies";
  };
  const openTonal = () => {
    window.location.href = "/tonal";
  };
  const openYou = (expandCast = false) => {
    setYouExpandCast(expandCast);
    setMode("you");
  };
  const openCastFromYou = () => {
    setCastReturn("you");
    setYouExpandCast(true);
    setMode("cast");
  };

  // Natal + embraced casts stay on-device as records. Home folds them into
  // labeled layers; the phrase brain only receives axis math + quality words.

  useEffect(() => {
    setBirth(loadBirth());
    setEmbraced(loadEmbraced());
    setDistillPrefs(loadDistillPrefs());
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void requestBrainAvailability(ac.signal).then(next => {
      if (next) setBrains(next);
    });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    writeModeToUrl(modeFromSearch());
  }, []);

  function resetHeldDivinations() {
    setEmbraced(clearEmbraced());
    setActiveLayerChoice(prev => (prev === "with-drawn" ? undefined : prev));
  }

  const phaseFraction = cosmic?.lunarPhaseFraction ?? cycles?.lunar?.fraction ?? 0.35;
  const homeReady = bootReady && !showAccessGate && !showSplash;
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

  const skyTick = Math.floor(now.getTime() / 60_000);
  const skyPeriod = useMemo(
    () => skyPeriodAt(new Date(skyTick * 60_000), lat, lon),
    [skyTick, lat, lon],
  );

  useEffect(() => {
    document.documentElement.dataset.sky = skyPeriod;
    return () => {
      delete document.documentElement.dataset.sky;
    };
  }, [skyPeriod]);

  const natal = useMemo(() => (birth ? natalGalactic(birth) : null), [birth]);

  const natalEntries = useMemo(() => {
    if (!birth) return [];
    return resolvePerson(birth).entries.filter(e => e.honesty === "render");
  }, [birth]);

  const colorLean = natal?.tribe?.color;

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

  const distillOpts = useMemo<DistillOptions>(() => {
    const opts: DistillOptions = { voice: distillPrefs.voice };
    if (layered.active !== "moment" && colorLean) opts.colorLean = colorLean;
    if (layered.active === "with-drawn") {
      const held = [...new Set(embraced.flatMap(c => c.qualities ?? []))]
        .map(q => q.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
      if (held.length) opts.castLean = held;
    }
    return opts;
  }, [layered.active, colorLean, embraced, distillPrefs.voice]);

  const mouthKey = `${distillPrefs.voice}:${distillPrefs.depth}:${distillPrefs.brain}`;

  // Local speak() immediately; phrase brain upgrades when Deep is on and a key exists.
  useEffect(() => {
    if (!homeSnap || lockedMomentEntries.length === 0) return;
    const { phrase, source } = phraseForMoment(
      activeReading.chord,
      civilYmd,
      lat,
      lon,
      distillOpts,
      layerCacheKey,
      mouthKey,
    );
    setDistilled(phrase);
    if (source === "cache") return;
    if (brains === null) return;
    if (distillPrefs.depth !== "deep" || !anyBrain(brains)) return;

    const ac = new AbortController();
    void requestPhraseBrain(activeReading.chord, distillOpts, {
      signal: ac.signal,
      prefer: distillPrefs.brain,
    }).then(voiced => {
      if (!voiced?.phrase) return;
      writeCachedPhrase(
        phraseCacheKeyFrom(civilYmd, lat, lon, distillOpts, layerCacheKey, mouthKey),
        voiced.phrase,
      );
      setDistilled(voiced.phrase);
    });
    return () => ac.abort();
  }, [
    homeSnap,
    lockedMomentEntries.length,
    activeReading,
    layered.active,
    civilYmd,
    lat,
    lon,
    layerCacheKey,
    distillOpts,
    mouthKey,
    distillPrefs.depth,
    distillPrefs.brain,
    brains,
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

  // Splash + Allow once per app open. Later door trips skip both.
  if (!bootReady) {
    return (
      <div className="onyx-root" role="status" aria-label="Delphi" aria-busy="true">
        <div className="onyx-device">
          <div className="onyx-splash-veil on" aria-hidden />
        </div>
      </div>
    );
  }

  if (showSplash) {
    return (
      <OnyxSplash onEnter={onSplashDone} onPrimeAccess={onPrimeAccess} />
    );
  }

  if (showAccessGate && onAllowAccess) {
    return <DeviceAccessGate onAllow={onAllowAccess} busy={accessBusy} />;
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
        onPulseEnabledChange={onPulseEnabledChange}
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
        onOpenTonal={() => { window.location.href = "/tonal"; }}
        hapticsEnabled={pulseEnabled}
      />
    );
  }

  if (mode === "tools") {
    return (
      <div className="onyx-root">
        <div className="onyx-device">
          <OnyxStarfield />
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
              <button
                type="button"
                className="onyx-tool-btn"
                onClick={() => {
                  const preset = presetById("time_compendium");
                  if (preset) {
                    onCyclePrefsChange({
                      ...cyclePrefs,
                      presetId: preset.id,
                      enabledIds: [...preset.systemIds],
                    });
                  }
                  setMode("atlas");
                }}
              >
                Time units
                <span>Helek · ghaṭi · kè · .beat</span>
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
        expandDivinations={youExpandCast}
        heldCasts={embraced}
        onOpenCast={openCastFromYou}
        onBack={() => setMode("home")}
        onBirthSaved={next => {
          setBirth(next);
          setActiveLayerChoice(undefined); // deepen to through-you
          // stay on You screen so user can see the chord that just resolved
        }}
      />
    );
  }

  if (mode === "cast") {
    return (
      <OnyxCast
        onBack={() => setMode(castReturn)}
        held={embraced}
        onEmbraced={list => {
          setEmbraced(list);
          setActiveLayerChoice(undefined); // deepen to with-drawn
          setCastReturn("you");
          setYouExpandCast(true);
          setMode("you");
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
          <OnyxStarfield />
          <button type="button" className="onyx-overlay-close" onClick={() => setMode("home")}>
            close
          </button>
          <div className="onyx-overlay">
            <OnyxTimeCompendium prefs={cyclePrefs} onChange={onCyclePrefsChange} />
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
          <OnyxStarfield />
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
          <OnyxStarfield />
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
      distillPrefs={distillPrefs}
      brains={brains}
      onDistillPrefs={next => setDistillPrefs(saveDistillPrefs(next))}
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
      onOpenYou={() => openYou(false)}
      onOpenCast={openCastFromYou}
      onOpenStudies={openStudies}
      onOpenTonal={openTonal}
      pulseEnabled={pulseEnabled}
      onPulseEnabledChange={onPulseEnabledChange}
      sensorsUnlocked={sensorsUnlocked}
    />
  );
}
