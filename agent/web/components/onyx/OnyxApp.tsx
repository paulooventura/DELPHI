"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from "react";
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
import { birthToDate, loadBirth, type BirthRecord } from "../../lib/lore/birthStore";
import {
  clearEmbraced,
  loadEmbraced,
  type EmbracedCast,
} from "../../lib/lore/castStore";
import { natalGalactic, natalOrreryCycles, resolvePerson } from "../../lib/lore/resolvePerson";
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
import { OnyxSkySplash } from "./OnyxSkySplash";
import { OnyxAgonSplash } from "./OnyxAgonSplash";
import { OnyxPsycheSplash } from "./OnyxPsycheSplash";
import { OnyxSplash } from "./OnyxSplash";
import { OnyxYou } from "./OnyxYou";
import { OnyxCast } from "./OnyxCast";
import { OnyxAbout } from "./OnyxAbout";
import { OnyxDecompose } from "./OnyxDecompose";
import { OnyxOrrery } from "./OnyxOrrery";
import { OnyxOrrerySplash } from "./OnyxOrrerySplash";
import { OnyxStarfield } from "./OnyxStarfield";
import { DeviceAccessGate } from "./DeviceAccessGate";
import { TreasurySheet, type TreasuryPick } from "./TreasurySheet";
import { OnyxPronaos, hasBeenWelcomed, markWelcomed } from "./OnyxPronaos";
import { ChamberHeader, ChamberNavContext, type ChamberDoor, type ChamberNav, type CompassLit } from "./ChamberHeader";
import { trackEvent, trackScreen } from "../../lib/telemetry/client";
import { VAULT_APPLIED_EVENT } from "../../lib/vault/sync";
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

/** Telemetry names match the public screen names (Sessions sheet columns). */
const TRACK_SCREEN: Record<OnyxMode, string> = {
  home: "home",
  sky: "aether",
  rings: "heliodrome",
  tools: "tools",
  atlas: "atlas",
  senses: "senses",
  oracle: "oracle",
  you: "psyche",
  cast: "cast",
  about: "about",
  decompose: "other",
};

const MODE_ALIASES: Record<string, OnyxMode> = {
  sky: "sky",
  clock: "rings",
  rings: "rings",
  me: "you",
  you: "you",
  account: "you",
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

/** One level up — the place each screen's back button names and returns to. */
export const MODE_PARENT: Record<OnyxMode, OnyxMode | null> = {
  home: null,
  sky: "home",
  rings: "home",
  tools: "home",
  you: "home",
  cast: "you",
  atlas: "tools",
  senses: "tools",
  oracle: "tools",
  about: "tools",
  decompose: "tools",
};

/** Names used by back labels and the chamber header. */
export const MODE_NAME: Record<OnyxMode, string> = {
  home: "Omphalos",
  sky: "Aether",
  rings: "Heliodrome",
  tools: "Treasury",
  you: "Psyche",
  cast: "Cast",
  atlas: "Atlas",
  senses: "Senses",
  oracle: "Oracle",
  about: "About",
  decompose: "Why this chord",
};

const MODE_LIT: Partial<Record<OnyxMode, CompassLit>> = {
  sky: "up",
  rings: "right",
  you: "centre",
  cast: "centre",
};

type ModeHistoryState = { pm: 1; mode: OnyxMode; depth: number };

function readHistoryState(): ModeHistoryState | null {
  const s = window.history.state as Partial<ModeHistoryState> | null;
  return s && s.pm === 1 && s.mode && typeof s.depth === "number" ? (s as ModeHistoryState) : null;
}

function modeUrl(mode: OnyxMode): string {
  const url = new URL(window.location.href);
  if (mode === "home") url.searchParams.delete("mode");
  else url.searchParams.set("mode", mode);
  url.searchParams.delete("tab");
  return `${url.pathname}${url.search}${url.hash}`;
}

function pushMode(mode: OnyxMode) {
  const depth = (readHistoryState()?.depth ?? 0) + 1;
  window.history.pushState({ pm: 1, mode, depth } satisfies ModeHistoryState, "", modeUrl(mode));
}

function replaceMode(mode: OnyxMode, depth: number) {
  window.history.replaceState({ pm: 1, mode, depth } satisfies ModeHistoryState, "", modeUrl(mode));
}

/** Cold deep link: seed the parent chain so phone Back lands inside the app. */
function seedModeHistory(start: OnyxMode) {
  if (readHistoryState()) return;
  const chain: OnyxMode[] = [];
  for (let m: OnyxMode | null = start; m; m = MODE_PARENT[m]) chain.unshift(m);
  replaceMode(chain[0]!, 0);
  for (const m of chain.slice(1)) pushMode(m);
}

export function OnyxApp({
  bootReady = true,
  showSplash,
  onSplashDone,
  onPrimeAccess,
  showAccessGate = false,
  onAllowAccess,
  onLaterAccess,
  accessBusy = false,
  sensorsUnlocked = false,
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
  skyWeather = null,
  skyWarmth = 0.55,
  sensorDiag,
  onAllowMotion,
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
  onArmAudio,
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
  /** "Not now": skip the up-front ask; features ask when first used. */
  onLaterAccess?: () => void;
  accessBusy?: boolean;
  /** True after Allow access — crystal + sky can bind to DeviceOrientation. */
  sensorsUnlocked?: boolean;
  now: Date;
  lat: number;
  lon: number;
  altM: number | null;
  /** True when lat/lon came from the device GPS (not Nashville fallback). */
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
  skyWeather?: SkyWeatherSlot | null;
  skyWarmth?: number;
  sensorDiag?: { events: number; status: "none" | "ok" | "event-but-null" | "denied" };
  /** Ask for motion again from a tap on the sky's "Compass off" line. */
  onAllowMotion?: () => void;
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
  /** Re-arm Web Audio after Allow / when entering Heliodrome. */
  onArmAudio?: () => void;
}) {
  const [mode, setModeState] = useState<OnyxMode>(modeFromSearch);
  const setMode = (next: OnyxMode) => {
    if (next === mode) return;
    setModeState(next);
    pushMode(next);
  };
  /** Up one level: same as phone Back when the level above is in history. */
  const goBack = () => {
    const parent = MODE_PARENT[mode] ?? "home";
    const s = readHistoryState();
    if (s && s.depth > 0) {
      window.history.back();
      return;
    }
    setModeState(parent);
    replaceMode(parent, 0);
  };
  /** The opening ran in this load, so the gate holds on the cake's last frame. */
  const [openingPlayed, setOpeningPlayed] = useState(false);
  /** First-run welcome over the live home; once per device (localStorage pm-welcomed). */
  const [pronaosOpen, setPronaosOpen] = useState(() => !hasBeenWelcomed());
  /** Set while history unwinds to the Omphalos entry; popstate then pushes this mode. */
  const pendingJump = useRef<OnyxMode | null>(null);
  /** Sideways jumps unwind to home first, so Back from the new chamber always names its real parent. */
  const travel = (target: OnyxMode) => {
    if (target === mode) return;
    const s = readHistoryState();
    if (!s || s.depth === 0) {
      setModeState(target);
      if (target === "home") replaceMode("home", 0);
      else pushMode(target);
      return;
    }
    pendingJump.current = target;
    window.history.go(-s.depth);
  };
  const [distilled, setDistilled] = useState<string>("");
  const [birth, setBirth] = useState<BirthRecord | null>(null);
  const [embraced, setEmbraced] = useState<EmbracedCast[]>([]);
  /** Sticky user choice; undefined = deepest available (Addendum 2). */
  const [activeLayerChoice, setActiveLayerChoice] = useState<LayerId | undefined>();
  /** Locked Layer-0 reading — taken on home open / return, never per-tick. */
  const [homeSnap, setHomeSnap] = useState<MomentSnapshot | null>(null);
  /** Clock-entry film — once per tab session, first time we open the orrery. */
  const [orreryIntro, setOrreryIntro] = useState(() => {
    try {
      return sessionStorage.getItem("delphi-orrery-intro-seen") !== "1";
    } catch {
      return true;
    }
  });
  /** Aether plate — once per tab session, first time we open the sky map. */
  const [skyIntro, setSkyIntro] = useState(() => {
    try {
      return sessionStorage.getItem("delphi-sky-intro-seen") !== "1";
    } catch {
      return true;
    }
  });
  /** Agon film — once per tab session, first time we open Show Thyself. */
  const [agonIntro, setAgonIntro] = useState(() => {
    try {
      return sessionStorage.getItem("delphi-agon-intro-seen") !== "1";
    } catch {
      return true;
    }
  });
  const [agonSplashPending, setAgonSplashPending] = useState(false);
  /** Psyche film — once per tab session, first intentional open of You. */
  const [youIntro, setYouIntro] = useState(() => {
    try {
      return sessionStorage.getItem("delphi-you-intro-seen") !== "1";
    } catch {
      return true;
    }
  });
  const [youExpandCast, setYouExpandCast] = useState(false);
  const [distillPrefs, setDistillPrefs] = useState<DistillPrefs>(loadDistillPrefs);
  const [brains, setBrains] = useState<BrainAvailability | null>(null);
  /** Bumped when the encrypted backup writes data in — remounts Psyche's form. */
  const [vaultEpoch, setVaultEpoch] = useState(0);

  const openStudies = () => {
    window.location.href = "/studies";
  };
  const openTonal = () => {
    if (agonIntro) {
      setAgonSplashPending(true);
      return;
    }
    window.location.href = "/tonal";
  };
  const openYou = (expandCast = false) => {
    setYouExpandCast(expandCast);
    setMode("you");
  };
  const openCastFromYou = () => {
    setYouExpandCast(true);
    setMode("cast");
  };

  // Natal + embraced casts stay on-device as records. Home folds them into
  // labeled layers; the phrase brain only receives axis math + quality words.

  useEffect(() => {
    const reload = () => {
      setBirth(loadBirth());
      setEmbraced(loadEmbraced());
      setDistillPrefs(loadDistillPrefs());
    };
    reload();
    const onVault = () => {
      reload();
      setVaultEpoch(n => n + 1);
    };
    window.addEventListener(VAULT_APPLIED_EVENT, onVault);
    return () => window.removeEventListener(VAULT_APPLIED_EVENT, onVault);
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void requestBrainAvailability(ac.signal).then(next => {
      if (next) setBrains(next);
    });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    seedModeHistory(modeFromSearch());
    const onPop = () => {
      const landed = readHistoryState()?.mode ?? modeFromSearch();
      const target = pendingJump.current;
      pendingJump.current = null;
      if (target && target !== "home" && landed === "home") {
        setModeState(target);
        pushMode(target);
        return;
      }
      setModeState(landed);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goBackRef = useRef(goBack);
  const modeRef = useRef(mode);
  useEffect(() => {
    goBackRef.current = goBack;
    modeRef.current = mode;
  });
  // Esc: a screen's own sheet handles it first (and preventDefaults); otherwise it is Back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      window.setTimeout(() => {
        if (e.defaultPrevented || modeRef.current === "home") return;
        if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
        goBackRef.current();
      }, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function resetHeldDivinations() {
    setEmbraced(clearEmbraced());
    setActiveLayerChoice(prev => (prev === "with-drawn" ? undefined : prev));
  }

  const phaseFraction = cosmic?.lunarPhaseFraction ?? cycles?.lunar?.fraction ?? 0.35;
  const homeReady = bootReady && !showAccessGate && !showSplash;
  void onRingSelect;

  useEffect(() => {
    if (!bootReady) return;
    trackScreen(showSplash ? "splash" : showAccessGate ? "gate" : TRACK_SCREEN[mode]);
  }, [bootReady, showSplash, showAccessGate, mode]);

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
    if (birth && colorLean) opts.colorLean = colorLean;
    const held = [...new Set(embraced.flatMap(c => c.qualities ?? []))]
      .map(q => q.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
    if (held.length) opts.castLean = held;
    if (birth) {
      opts.natalSeed = natalOrreryCycles(birth)
        .map(r => `${r.id}:${r.label}`)
        .join("|");
    }
    return opts;
  }, [birth, colorLean, embraced, distillPrefs.voice]);

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

  // Distilled chorus of the active reading layer — what Share sends. No tradition names.
  const momentLine = distilled || "Reading the chord…";
  void multiVoice;

  // Splash + Allow once per app open. Later door trips skip both.
  if (!bootReady) {
    return (
      <div className="onyx-root" role="status" aria-label="Pneuma Mundi" aria-busy="true">
        <div className="onyx-device">
          <div className="onyx-splash-veil on" aria-hidden />
        </div>
      </div>
    );
  }

  if (showSplash) {
    return (
      <OnyxSplash
        onEnter={() => {
          setOpeningPlayed(true);
          onSplashDone();
        }}
        onPrimeAccess={onPrimeAccess}
        endsAtGate={showAccessGate}
      />
    );
  }

  if (showAccessGate && onAllowAccess) {
    return (
      <DeviceAccessGate
        fromCake={openingPlayed}
        onAllow={() => {
          trackEvent("allow_access");
          onAllowAccess();
        }}
        onLater={
          onLaterAccess
            ? () => {
                trackEvent("access_later");
                onLaterAccess();
              }
            : undefined
        }
        busy={accessBusy}
      />
    );
  }

  if (agonSplashPending && agonIntro) {
    return (
      <OnyxAgonSplash
        onEnter={() => {
          try {
            sessionStorage.setItem("delphi-agon-intro-seen", "1");
          } catch {
            /* private mode */
          }
          setAgonIntro(false);
          setAgonSplashPending(false);
          window.location.href = "/tonal";
        }}
      />
    );
  }

  const openSky = () => {
    // Must stay on the user gesture path for iOS DeviceOrientation permission.
    onEnterSky?.();
    setMode("sky");
  };

  const jumpDoor = (door: ChamberDoor) => {
    if (door === "tonal") return openTonal();
    if (door === "studies") return openStudies();
    if (door === "sky") onEnterSky?.();
    if (door === "you") setYouExpandCast(false);
    travel(door);
  };
  const parentMode = MODE_PARENT[mode] ?? "home";
  const nav: ChamberNav = {
    backLabel: MODE_NAME[parentMode],
    onBack: goBack,
    onHome: () => travel("home"),
    onJump: jumpDoor,
    lit: MODE_LIT[mode] ?? null,
    pulseEnabled: Boolean(pulseEnabled),
    onPulseEnabledChange,
  };
  const chamber = (el: ReactNode) => (
    <ChamberNavContext.Provider value={nav}>{el}</ChamberNavContext.Provider>
  );

  if (mode === "sky") {
    if (skyIntro) {
      return (
        <OnyxSkySplash
          onEnter={() => {
            try {
              sessionStorage.setItem("delphi-sky-intro-seen", "1");
            } catch {
              /* private mode */
            }
            setSkyIntro(false);
          }}
        />
      );
    }
    return chamber(
      <OnyxSky
        now={now}
        lat={lat}
        lon={lon}
        altM={altM ?? 0}
        locationLive={locationLive}
        locationAccuracyM={locationAccuracyM}
        locationDenied={locationDenied}
        magneticDeclinationDeg={magneticDeclinationDeg}
        skyAzOffsetDeg={skyAzOffsetDeg}
        skyLockName={skyLockName}
        sunAboveHorizon={sunAboveHorizon}
        moonAboveHorizon={moonAboveHorizon}
        onCalibrateSun={onCalibrateSun}
        onCalibrateMoon={onCalibrateMoon}
        onCalibrateLookToObject={onCalibrateLookToObject}
        onResetSkyCalibration={onResetSkyCalibration}
        headingDeg={headingDeg}
        pitchDeg={pitchDeg}
        liveAttitudeRef={liveAttitudeRef}
        skyLookRef={skyLookRef}
        skyLookSnapRef={skyLookSnapRef}
        liveHeading={liveHeading}
        livePitch={livePitch}
        arPoseReady={arPoseReady}
        hapticsEnabled={pulseEnabled}
        onPulseEnabledChange={onPulseEnabledChange}
        warmth={skyWarmth}
        weather={skyWeather}
        sensorDiag={sensorDiag}
        onAllowMotion={onAllowMotion}
        onBack={goBack}
      />
    );
  }

  if (mode === "rings") {
    if (orreryIntro) {
      return (
        <OnyxOrrerySplash
          onEnter={() => {
            try {
              sessionStorage.setItem("delphi-orrery-intro-seen", "1");
            } catch {
              /* private mode */
            }
            if (pulseEnabled) onArmAudio?.();
            setOrreryIntro(false);
          }}
        />
      );
    }
    return chamber(
      <OnyxOrrery
        lat={lat}
        lon={lon}
        onBack={goBack}
        natalDate={birth ? birthToDate(birth) : null}
        birth={birth}
        onBirthChange={next => setBirth(next)}
        hapticsEnabled={pulseEnabled}
        onArmAudio={pulseEnabled ? onArmAudio : undefined}
      />
    );
  }

  if (mode === "you") {
    if (youIntro) {
      return (
        <OnyxPsycheSplash
          onEnter={() => {
            try {
              sessionStorage.setItem("delphi-you-intro-seen", "1");
            } catch {
              /* private mode */
            }
            setYouIntro(false);
          }}
        />
      );
    }
    return chamber(
      <OnyxYou
        key={vaultEpoch}
        nowChord={homeSnap?.chord ?? activeReading.chord}
        expandDivinations={youExpandCast}
        heldCasts={embraced}
        onOpenCast={openCastFromYou}
        onBack={goBack}
        onBirthSaved={next => {
          setBirth(next);
          setActiveLayerChoice(undefined); // deepen to through-you
          // stay on You screen so user can see the chord that just resolved
        }}
      />
    );
  }

  if (mode === "cast") {
    return chamber(
      <OnyxCast
        onBack={goBack}
        held={embraced}
        onEmbraced={list => {
          setEmbraced(list);
          setActiveLayerChoice(undefined); // deepen to with-drawn
          setYouExpandCast(true);
          // Skip Psyche entry film when returning from a draw.
          try {
            sessionStorage.setItem("delphi-you-intro-seen", "1");
          } catch {
            /* private mode */
          }
          setYouIntro(false);
          goBack();
        }}
        onResetHeld={resetHeldDivinations}
      />
    );
  }

  if (mode === "about") {
    return chamber(<OnyxAbout />);
  }

  if (mode === "decompose") {
    return chamber(
      <OnyxDecompose chord={activeReading.chord} provenanceLine={snapProvenance?.line} />,
    );
  }

  // Land acknowledgment + land calendar at the location fix: calendar framing, never personality.
  const landAck = homeSnap?.acknowledgment ?? null;
  const landCalendar = homeSnap?.landCalendar[0]?.name ?? null;

  if (mode === "atlas") {
    return chamber(
      <div className="onyx-root">
        <div className="onyx-device onyx-device-scroll">
          <OnyxStarfield />
          <ChamberHeader title="Atlas" />
          <div className="onyx-overlay">
            {landAck && (
              <p className="onyx-land-ack">
                {landAck.text}
                {landAck.pointTo && (
                  <>
                    {" "}
                    <a href={landAck.pointTo} target="_blank" rel="noopener noreferrer">
                      Learn more
                    </a>
                  </>
                )}
              </p>
            )}
            {landCalendar && <p className="onyx-land-cal">Land calendar · {landCalendar}</p>}
            <OnyxTimeCompendium prefs={cyclePrefs} onChange={onCyclePrefsChange} />
            <AtlasPanel prefs={cyclePrefs} onChange={onCyclePrefsChange} />
          </div>
        </div>
      </div>
    );
  }

  if (mode === "senses") {
    return chamber(
      <div className="onyx-root">
        <div className="onyx-device onyx-device-scroll">
          <OnyxStarfield />
          <ChamberHeader title="Senses" />
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
    return chamber(
      <div className="onyx-root">
        <div className="onyx-device onyx-device-scroll">
          <OnyxStarfield />
          <ChamberHeader title="Oracle" />
          <div className="onyx-overlay">
            <PauloVenturaHub className="cp-card" />
            {oracleExtra}
          </div>
        </div>
      </div>
    );
  }

  const pickTreasury = (id: TreasuryPick) => {
    if (id === "welcome") {
      setPronaosOpen(true);
      return;
    }
    if (id === "time") {
      const preset = presetById("time_compendium");
      if (preset) {
        onCyclePrefsChange({ ...cyclePrefs, presetId: preset.id, enabledIds: [...preset.systemIds] });
      }
      setMode("atlas");
      return;
    }
    setMode(id);
  };

  const homeScreen = (
    <OnyxHome
      now={now}
      phaseFraction={phaseFraction}
      momentLine={momentLine}
      distillPrefs={distillPrefs}
      brains={brains}
      onDistillPrefs={next => setDistillPrefs(saveDistillPrefs(next))}
      onOpenSky={openSky}
      onOpenRings={() => setMode("rings")}
      onOpenTools={() => setMode("tools")}
      onOpenYou={() => openYou(false)}
      onOpenStudies={openStudies}
      onOpenTonal={openTonal}
      pulseEnabled={pulseEnabled}
      onPulseEnabledChange={onPulseEnabledChange}
      sensorsUnlocked={sensorsUnlocked}
      headingDeg={headingDeg}
      attitudeRef={liveAttitudeRef}
    />
  );

  return (
    <>
      {homeScreen}
      {mode === "tools" && <TreasurySheet onClose={goBack} onPick={pickTreasury} />}
      {mode === "home" && homeReady && pronaosOpen && (
        <OnyxPronaos
          onDone={meet => {
            markWelcomed();
            setPronaosOpen(false);
            if (meet) openYou(false);
          }}
        />
      )}
    </>
  );
}
