"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CycleSnapshot } from "../lib/cycleSystems";
import { getCycleSnapshot } from "../lib/cycleSystems";
import { CelestialSkyView } from "../components/CelestialSkyView";
import type { ResearchTier, ConfidenceResult, SourceResult, ScoredClaim, ConfidenceLabel } from "../lib/researchEngine";
import { getLocation, requestOrientationPermission, watchDeviceOrientation, getMagneticField, getNetworkInfo, watchLocation, type GeoFix } from "../lib/localSignals";
import { watchMagnetometer, magnetometerSupported } from "../lib/deviceSensors";
import { hasAccessThisSession, requestDeviceAccessPermissions } from "../lib/deviceAccess";
import { resetOrientationCalibration, restoreOrientationCalibration, describeSkyPose, skyPoseHintMessage, getIosAlphaOffset, compassNeedsPortraitLock, type SkyPoseHint } from "../lib/sphericalView";
import {
  setMagneticDeclinationDeg,
  setUserAzimuthOffsetDeg,
} from "../lib/orientationCalibration";
import { computeCelestialBodies } from "../lib/cosmic/celestialBodies";
import { fetchDeclinationDeg } from "../lib/magneticDeclination";
import { geoDistanceM } from "../lib/sensorSmoothing";
import { altAzToEnu, enuToAltAz } from "../lib/sphericalView";
import { DashboardContainer } from "../components/DashboardContainer";
import { COSMIC_CLOCK_OUTER_RADIUS, type RingSelectMeta } from "../components/CosmicClockWheel";
import type { ClockRingData } from "../lib/timeEngine";
import { RingFocusPanel, zoomForRingRadius, fitMobileClockZoom } from "../components/RingFocusPanel";
import { muteClockAudio } from "../lib/clockSfx";
import { useClockSfx } from "../hooks/useClockSfx";
import { useCosmicClock } from "../hooks/useCosmicClock";
import { useSpringValue } from "../hooks/useSpringValue";
import { useScreenWakeLock } from "../hooks/useScreenWakeLock";
import { useShowLaunch } from "../components/LaunchScreen";
import { OnyxApp } from "../components/onyx/OnyxApp";
import { installHapticLifecycle, muteHaptics, cancelHaptic } from "../lib/haptics";
import { HOME_LAT as FALLBACK_LAT, HOME_LON as FALLBACK_LON } from "../lib/observerHome";
import { OracleLogo } from "../components/oracle/OracleLogo";
import { AmbientPulse } from "../components/AmbientPulse";
import { ClockAmbience } from "../components/ClockAmbience";
import { EmfReader } from "../components/EmfReader";
import { SensorArray } from "../components/SensorArray";
import { MomentReading } from "../components/MomentReading";
import { AtlasPanel } from "../components/AtlasPanel";
import { NowStrip } from "../components/NowStrip";
import { BottomNav, type AppTab } from "../components/BottomNav";
import { PauloVenturaHub } from "../components/PauloVenturaHub";
import {
  defaultEnabledIds,
  loadPreferences,
  nowStripReadings,
  resolveWorldCycles,
  savePreferences,
  synthesizeMultiVoice,
  type WorldCyclePreferences,
} from "../lib/worldCycles";
import { WIX_HOME } from "../lib/site";
import { SkyCompass } from "../components/SkyCompass";
import { SkyCatalog } from "../components/SkyCatalog";
import { labelForDistanceRank } from "../lib/starmap";
import { estimateOutdoorLux } from "../lib/platform";
import { weatherAdjustedLux, weatherSlotForHour } from "../lib/cosmic/skyWeather";

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Sensor toggles ───────────────────────────────────────────────────────────

type SensorToggles = {
  skyMap: boolean;
  compass: boolean;
  location: boolean;
  heading: boolean;
  network: boolean;
  emf: boolean;
};

const DEFAULT_TOGGLES: SensorToggles = {
  skyMap: true,
  compass: true,
  location: true,
  heading: true,
  network: true,
  emf: true,
};

const TOGGLES_STORAGE_KEY = "cp-sensor-toggles-v2";
const RESEARCH_TIER_KEY = "cp-research-tier";
const MANUAL_HEADING_KEY = "cp-manual-heading";
const SKY_AZ_OFFSET_KEY = "cp-sky-az-offset";

// ─── Research tiers (mirrors TIER_CONFIG in lib/researchEngine.ts) ──────────────
// The user picks the computation tier per query. instant/standard are free and
// run with zero API keys; deep/max layer in paid synthesis (Valyu/Perplexity)
// when keys are configured, otherwise gracefully fall back to standard.
const RESEARCH_TIERS: { id: ResearchTier; label: string; latency: string; free: boolean; blurb: string }[] = [
  { id: "instant",  label: "Instant",  latency: "~1–3s",     free: true,  blurb: "Fast fact-grounded single pass" },
  { id: "standard", label: "Standard", latency: "~5–15s",    free: true,  blurb: "Full free cross-referenced pipeline" },
  { id: "deep",     label: "Deep",     latency: "~1–5 min",  free: false, blurb: "+ Valyu & Perplexity deep synthesis" },
  { id: "max",      label: "Max",      latency: "~3–10 min", free: false, blurb: "Heaviest synthesis + full corroboration" },
];

const CONFIDENCE_COLORS: Record<ConfidenceLabel, string> = {
  Verified: "#34d399",
  Likely: "#a3e635",
  Contested: "#fbbf24",
  Unsupported: "#f87171",
};

const PROVIDER_TIER_META: Record<1 | 2 | 3 | 4, { label: string; color: string }> = {
  1: { label: "T1 · primary", color: "#34d399" },
  2: { label: "T2 · reference", color: "#38bdf8" },
  3: { label: "T3 · web", color: "#a78bfa" },
  4: { label: "T4 · signal", color: "#94a3b8" },
};

function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

const SENSOR_TOGGLE_DEFS: Array<{ key: keyof SensorToggles; label: string }> = [
  { key: "skyMap",   label: "Sky Map" },
  { key: "compass",  label: "Compass" },
  { key: "location", label: "Location" },
  { key: "heading",  label: "Heading" },
  { key: "network",  label: "Network" },
  { key: "emf",      label: "EMF" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Signals = {
  lat: number | null;
  lon: number | null;
  accuracyM: number | null;
  altM: number | null;
  altAccuracyM: number | null;
  speedMps: number | null;
  gpsHeading: number | null;
  locationAtMs: number | null;
  heading: number | null;
  pitch: number | null;
  network: string | null;
  emfUt: number | null;
  emfMethod: string | null;
};

function emptySignals(partial: Partial<Signals> = {}): Signals {
  return {
    lat: null,
    lon: null,
    accuracyM: null,
    altM: null,
    altAccuracyM: null,
    speedMps: null,
    gpsHeading: null,
    locationAtMs: null,
    heading: null,
    pitch: null,
    network: null,
    emfUt: null,
    emfMethod: null,
    ...partial,
  };
}

function applyGeoFix(prev: Signals | null, fix: GeoFix): Signals {
  return {
    lat: fix.latitude,
    lon: fix.longitude,
    accuracyM: fix.accuracyM,
    altM: fix.altitudeM,
    altAccuracyM: fix.altitudeAccuracyM,
    speedMps: fix.speedMps,
    gpsHeading: fix.headingDeg,
    locationAtMs: fix.timestampMs,
    heading: prev?.heading ?? null,
    pitch: prev?.pitch ?? null,
    network: prev?.network ?? null,
    emfUt: prev?.emfUt ?? null,
    emfMethod: prev?.emfMethod ?? null,
  };
}

// Each SSE message from /api/research/v2 is a partial ConfidenceResult plus a
// phase tag; we merge them so progress phases never wipe earlier fields.
type ResearchState = Partial<ConfidenceResult> & {
  phase?: string;
  complete?: boolean;
  error?: string;
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [minuteKey, setMinuteKey] = useState(0);

  const [cycles, setCycles]     = useState<CycleSnapshot | null>(() => getCycleSnapshot(new Date()));
  const [signals, setSignals]   = useState<Signals | null>(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [locDenied, setLocDenied] = useState(false);
  const [headingLive, setHeadingLive] = useState(false);
  const [pitchLive, setPitchLive] = useState(false);
  const [skyPose, setSkyPose] = useState<SkyPoseHint>("too-flat");
  const [manualHeading, setManualHeading] = useState(() => {
    try {
      const raw = localStorage.getItem(MANUAL_HEADING_KEY);
      const n = raw != null ? Number(raw) : 180;
      return Number.isFinite(n) ? normalizeHeading(n) : 180;
    } catch {
      return 180;
    }
  });
  const [wheelZoom, setWheelZoom] = useState(1);
  const springZoom = useSpringValue(wheelZoom);
  const [wheelPan, setWheelPan] = useState({ x: 0, y: 0 });
  const springPanX = useSpringValue(wheelPan.x);
  const springPanY = useSpringValue(wheelPan.y);
  const panDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const suppressRingClickRef = useRef(false);
  const touchPanRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [wheelDragging, setWheelDragging] = useState(false);
  const zoomBootstrapped = useRef(false);
  const wheelViewportRef = useRef<HTMLDivElement>(null);
  const viewportHeightRef = useRef(400);
  const viewportWidthRef = useRef(400);
  const outerRingR = COSMIC_CLOCK_OUTER_RADIUS;
  const heroZoomDefault = fitMobileClockZoom(outerRingR, viewportHeightRef.current);
  const [skyDistance, setSkyDistance] = useState(50);
  const [skyAzOffset, setSkyAzOffset] = useState(() => {
    try {
      const raw = localStorage.getItem(SKY_AZ_OFFSET_KEY);
      const v = raw != null ? Number(raw) : 0;
      if (Number.isFinite(v)) {
        setUserAzimuthOffsetDeg(v);
        return v;
      }
    } catch { /* ignore */ }
    return 0;
  });
  const [declinationDeg, setDeclinationDeg] = useState(0);
  const [compassCalibrated, setCompassCalibrated] = useState(() => getIosAlphaOffset() != null);
  const [hoverRing, setHoverRing] = useState<string | null>(null);
  const [focusRing, setFocusRing] = useState<string | null>(null);
  const [focusRingData, setFocusRingData] = useState<ClockRingData | null>(null);
  const [clockSfxOn, setClockSfxOn] = useState(true);
  const [toggles, setToggles] = useState<SensorToggles>(DEFAULT_TOGGLES);

  const [query, setQuery]       = useState("");
  const [tier, setTier]         = useState<ResearchTier>(() => {
    try {
      const raw = localStorage.getItem(RESEARCH_TIER_KEY);
      return RESEARCH_TIERS.some(t => t.id === raw) ? (raw as ResearchTier) : "standard";
    } catch {
      return "standard";
    }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recency, setRecency]   = useState<"any" | "day" | "week" | "month" | "year">("any");
  const [academicOnly, setAcademicOnly] = useState(false);
  const [domainFilter, setDomainFilter] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [res, setRes]           = useState<ResearchState | null>(null);
  const [resLoading, setResLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pinchStartRef = useRef<number | null>(null);
  const pinchZoomRef = useRef(1);
  const headingCleanupRef = useRef<(() => void) | null>(null);
  const locationCleanupRef = useRef<(() => void) | null>(null);
  const emfCleanupRef = useRef<(() => void) | null>(null);
  const liveAttitudeRef = useRef({ view: altAzToEnu(180, 0), roll: 0 });
  const attitudeHudMs = useRef(0);
  const rawOrientCleanupRef = useRef<(() => void) | null>(null);
  const [sensorDiag, setSensorDiag] = useState<{ events: number; status: "none" | "ok" | "event-but-null" | "denied" }>({
    events: 0,
    status: "none",
  });
  const loadCyclesRef = useRef<(lat?: number, lon?: number) => Promise<void>>(async () => {});
  const togglesRef = useRef(toggles);
  const observerRef = useRef({ lat: FALLBACK_LAT, lon: FALLBACK_LON });
  const { active: sfxActive, enable: enableSfx } = useClockSfx(clockSfxOn, observerRef);
  const [showLaunch, completeLaunch, launchReady] = useShowLaunch();
  /** After splash: true until this app session has granted (or just granted). */
  const [needsAccessGate, setNeedsAccessGate] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  /** Choir / Tina iframe — skip splash + gate so the sky can fill their canvas. */
  const [chorusEmbed, setChorusEmbed] = useState(false);
  const resumedSessionRef = useRef(false);
  useLayoutEffect(() => {
    try {
      const embed = new URLSearchParams(window.location.search).get("embed") === "1";
      setChorusEmbed(embed);
      setNeedsAccessGate(!embed && !hasAccessThisSession());
    } catch {
      setNeedsAccessGate(true);
    }
    setAccessReady(true);
  }, []);
  const [accessBusy, setAccessBusy] = useState(false);
  const primingAccessRef = useRef(false);
  useScreenWakeLock(!chorusEmbed);

  // ── Tabbed app shell (Clock · Sky · Moment · Atlas · Senses · Oracle)
  const isAppTab = (v: string | null): v is AppTab =>
    v === "clock" || v === "sky" || v === "moment" || v === "atlas" || v === "senses" || v === "oracle";

  const [tab, setTab] = useState<AppTab>(() => {
    try {
      const raw = localStorage.getItem("cp-active-tab");
      return isAppTab(raw) ? raw : "clock";
    } catch {
      return "clock";
    }
  });

  const [cyclePrefs, setCyclePrefs] = useState<WorldCyclePreferences>(() =>
    loadPreferences(defaultEnabledIds()),
  );

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (isAppTab(q)) setTab(q);
  }, []);
  useEffect(() => {
    try { localStorage.setItem("cp-active-tab", tab); } catch {}
  }, [tab]);

  const updateCyclePrefs = useCallback((next: WorldCyclePreferences) => {
    setCyclePrefs(next);
    savePreferences(next);
  }, []);

  const TAB_SUBTITLE: Record<AppTab, string> = {
    clock: "COSMIC CLOCK",
    sky: "ASTRONOMICAL GUIDANCE",
    moment: "THE MOMENT",
    atlas: "WORLD CYCLES",
    senses: "ORACLE SENSES",
    oracle: "UNVEILING THE ORACLE",
  };

  // Live ambient readings from the device sensor array (lux + barometric
  // pressure), fed into the cosmic engine so the sky's warmth/breath respond
  // to the real environment when the hardware exposes it.
  const [deviceAmbient, setDeviceAmbient] = useState<{ lux: number | null; pressureHpa: number | null }>({
    lux: null,
    pressureHpa: null,
  });
  const handleAmbient = useCallback((a: { lux: number | null; pressureHpa: number | null }) => {
    setDeviceAmbient(prev => (prev.lux === a.lux && prev.pressureHpa === a.pressureHpa ? prev : a));
  }, []);

  const { now: animNow, state: cosmic, engine: cosmicEngine } = useCosmicClock({
    lat: signals?.lat ?? FALLBACK_LAT,
    lon: signals?.lon ?? FALLBACK_LON,
    headingDeg: signals?.heading ?? manualHeading,
    altitudeM: signals?.altM ?? null,
    pressureHpa: deviceAmbient.pressureHpa ?? cycles?.weather?.pressureHpa ?? null,
    lux: deviceAmbient.lux,
  });

  useEffect(() => { togglesRef.current = toggles; }, [toggles]);

  useEffect(() => {
    if (!zoomBootstrapped.current && cycles) {
      zoomBootstrapped.current = true;
      setWheelZoom(heroZoomDefault);
    }
  }, [cycles, heroZoomDefault]);

  useEffect(() => {
    if (tab !== "clock") return;
    const el = wheelViewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const h = rect.height;
      const w = rect.width;
      if (h < 80) return;
      viewportHeightRef.current = h;
      viewportWidthRef.current = w;
      const fit = fitMobileClockZoom(COSMIC_CLOCK_OUTER_RADIUS, h, w);
      if (!zoomBootstrapped.current) {
        setWheelZoom(fit);
        zoomBootstrapped.current = true;
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [cycles, tab]);

  // Cycle sonics: Schumann + civil ticks + lane marks. Unlock after splash
  // (or immediately in the Chorus iframe — stone stays on).
  useEffect(() => {
    if (!showLaunch && clockSfxOn) {
      void enableSfx();
    }
  }, [showLaunch, clockSfxOn, enableSfx]);

  // Same-session return (Studies/Tonal → home) skipped splash, so start
  // watches here. First open still waits for splash + Allow.
  useEffect(() => {
    if (!launchReady || !accessReady) return;
    if (showLaunch || chorusEmbed) return;
    if (resumedSessionRef.current) return;
    if (!hasAccessThisSession()) return;
    resumedSessionRef.current = true;
    void captureSensors();
    void startOrientationWatch();
  }, [launchReady, accessReady, showLaunch, chorusEmbed]);

  // ── Digital clock (1 second tick)
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNow(n);
      if (n.getSeconds() === 0) setMinuteKey(k => k + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Sensor toggles: persist on every change (initial load happens in captureSensors' mount effect below).
  useEffect(() => {
    try { localStorage.setItem(TOGGLES_STORAGE_KEY, JSON.stringify(toggles)); } catch {}
  }, [toggles]);

  useEffect(() => {
    try { localStorage.setItem(MANUAL_HEADING_KEY, String(manualHeading)); } catch {}
  }, [manualHeading]);

  useEffect(() => {
    try { localStorage.setItem(RESEARCH_TIER_KEY, tier); } catch {}
  }, [tier]);

  const snapshotOpts = useMemo(
    () => ({
      enabledIds: cyclePrefs.enabledIds,
      ayanamsa: cyclePrefs.ayanamsa,
      lat: signals?.lat ?? undefined,
      lon: signals?.lon ?? undefined,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    [cyclePrefs, signals?.lat, signals?.lon],
  );

  // ── Fetch cycles
  const loadCycles = useCallback(async (lat?: number, lon?: number) => {
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const local = new Date();
    const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    const qParts = [`tz=${tz}`, `date=${date}`];
    if (lat != null && lon != null) qParts.unshift(`lat=${lat}`, `lon=${lon}`);
    const data = await fetch(`/api/cycles?${qParts.join("&")}`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
    const weather = data?.weather as CycleSnapshot["weather"] | undefined;
    setCycles(getCycleSnapshot(new Date(), weather, {
      ...snapshotOpts,
      lat: lat ?? snapshotOpts.lat,
      lon: lon ?? snapshotOpts.lon,
    }));
  }, [snapshotOpts]);

  useEffect(() => { loadCyclesRef.current = loadCycles; }, [loadCycles]);

  useEffect(() => { void loadCycles(); }, [loadCycles]);

  // Recompute calendar layers every minute (preserve latest weather).
  useEffect(() => {
    setCycles(prev => getCycleSnapshot(new Date(), prev?.weather, snapshotOpts));
  }, [minuteKey, snapshotOpts]);

  const worldNow = useMemo(() => {
    const date = cosmic?.now ?? animNow;
    return resolveWorldCycles({
      date,
      timeZone: snapshotOpts.timeZone,
      lat: snapshotOpts.lat,
      lon: snapshotOpts.lon,
      ayanamsa: snapshotOpts.ayanamsa,
    });
  }, [minuteKey, cosmic?.now, animNow, snapshotOpts]);

  const stripReadings = useMemo(
    () => nowStripReadings(worldNow, cyclePrefs.enabledIds),
    [worldNow, cyclePrefs.enabledIds],
  );

  const multiVoice = useMemo(
    () => synthesizeMultiVoice(worldNow, cyclePrefs.enabledIds),
    [worldNow, cyclePrefs.enabledIds],
  );

  // ── Refresh cadence: keep sky/cycles current every minute. Heading is a
  // continuous live stream (see startHeadingWatch), not a periodic sample.
  useEffect(() => {
    const id = setInterval(() => {
      setMinuteKey(k => k + 1);
      const needsCapture =
        (toggles.location && (signals?.lat == null || signals?.lon == null)) ||
        (toggles.network && !signals?.network) ||
        (toggles.emf && signals?.emfUt == null);
      if (needsCapture) void captureSensors();
      void loadCycles(signals?.lat ?? undefined, signals?.lon ?? undefined);
    }, 60000);
    return () => clearInterval(id);
  }, [signals?.lat, signals?.lon, signals?.network, signals?.emfUt, toggles, loadCycles]);

  // Live EMF stream — keeps the gauge and clock hub honest while the toggle is on.
  useEffect(() => {
    emfCleanupRef.current?.();
    emfCleanupRef.current = null;
    if (!toggles.emf) return;

    if (!magnetometerSupported()) {
      setSignals(prev => ({
        ...(prev ?? emptySignals()),
        emfMethod: "magnetometer-api-unavailable",
      }));
      return;
    }

    const sub = watchMagnetometer(
      (ut) => {
        setSignals(prev => ({
          ...(prev ?? emptySignals()),
          emfUt: Number(ut.toFixed(1)),
          emfMethod: "magnetometer",
        }));
      },
      (reason) => {
        setSignals(prev => ({
          ...(prev ?? emptySignals()),
          emfMethod: reason === "NotAllowedError" ? "magnetometer-denied" : "magnetometer-api-unavailable",
        }));
      },
    );
    emfCleanupRef.current = () => sub.stop();
    return () => {
      emfCleanupRef.current?.();
      emfCleanupRef.current = null;
    };
  }, [toggles.emf]);

  // ── Capture one-shot signals: each piece is requested only when its toggle is on.
  // Heading is excluded here — it's a continuous stream, see startHeadingWatch.
  function stopLocationWatch() {
    locationCleanupRef.current?.();
    locationCleanupRef.current = null;
  }

  function startLocationWatch() {
    stopLocationWatch();
    let lastLat = NaN;
    let lastLon = NaN;
    let lastAcc = 40;
    locationCleanupRef.current = watchLocation(
      (fix) => {
        if (fix.latitude == null || fix.longitude == null) return;
        setLocDenied(false);
        setSignals(prev => applyGeoFix(prev, fix));
        const acc = fix.accuracyM ?? lastAcc;
        lastAcc = acc;
        const moved = !Number.isFinite(lastLat) || geoDistanceM(
          lastLat,
          lastLon,
          fix.latitude,
          fix.longitude,
        ) > Math.max(45, acc * 1.8);
        if (moved) {
          lastLat = fix.latitude;
          lastLon = fix.longitude;
          void loadCyclesRef.current(fix.latitude, fix.longitude);
          void fetchDeclinationDeg(fix.latitude, fix.longitude).then(d => {
            setMagneticDeclinationDeg(d);
            setDeclinationDeg(d);
          });
        }
      },
      () => setLocDenied(true),
    );
  }

  async function captureSensors(t: SensorToggles = toggles) {
    setSigLoading(true);
    setLocDenied(false);
    try {
      const [location, emf] = await Promise.all([
        t.location ? getLocation() : Promise.resolve(null),
        t.emf ? getMagneticField() : Promise.resolve({ magneticFieldUt: null, method: "disabled" }),
      ]);
      if (t.location && (location == null || location.latitude == null)) setLocDenied(true);
      const network = t.network ? getNetworkInfo() : { effectiveType: null, downlinkMbps: null, rttMs: null, hint5G: "" };
      setSignals(prev => {
        let next = prev ?? emptySignals();
        if (t.location && location?.latitude != null) next = applyGeoFix(next, location);
        return {
          ...next,
          network: t.network ? network.effectiveType : next.network,
          emfUt: t.emf ? emf.magneticFieldUt : next.emfUt,
          emfMethod: t.emf ? emf.method : next.emfMethod,
        };
      });
      if (t.location && location?.latitude != null && location.longitude != null) {
        void loadCycles(location.latitude, location.longitude);
        void fetchDeclinationDeg(location.latitude, location.longitude).then(d => {
          setMagneticDeclinationDeg(d);
          setDeclinationDeg(d);
        });
        void startOrientationWatch();
        startLocationWatch();
      } else if (t.location) {
        startLocationWatch();
      }
    } finally {
      setSigLoading(false);
    }
  }

  // ── Live device orientation: heading + pitch from the same sensor stream.
  function stopOrientationWatch() {
    headingCleanupRef.current?.();
    headingCleanupRef.current = null;
    rawOrientCleanupRef.current?.();
    rawOrientCleanupRef.current = null;
  }

  function startRawOrientationDiag() {
    rawOrientCleanupRef.current?.();
    const onRaw = (event: Event) => {
      const e = event as DeviceOrientationEvent;
      setSensorDiag(prev => {
        const events = prev.events + 1;
        const status =
          e.alpha == null && e.beta == null && e.gamma == null ? "event-but-null" : "ok";
        if (prev.events === events && prev.status === status) return prev;
        return { events, status };
      });
    };
    window.addEventListener("deviceorientation", onRaw, true);
    if ("ondeviceorientationabsolute" in window) {
      window.addEventListener("deviceorientationabsolute", onRaw, true);
    }
    rawOrientCleanupRef.current = () => {
      window.removeEventListener("deviceorientation", onRaw, true);
      if ("ondeviceorientationabsolute" in window) {
        window.removeEventListener("deviceorientationabsolute", onRaw, true);
      }
    };
  }

  async function startOrientationWatch(options?: { resetCalibration?: boolean }) {
    const allowed = await requestOrientationPermission();
    if (!allowed) {
      stopOrientationWatch();
      setHeadingLive(false);
      setPitchLive(false);
      setSkyPose("too-flat");
      setSensorDiag({ events: 0, status: "denied" });
      return;
    }
    stopOrientationWatch();
    setSensorDiag({ events: 0, status: "none" });
    startRawOrientationDiag();
    if (options?.resetCalibration) {
      resetOrientationCalibration();
    } else {
      restoreOrientationCalibration();
    }
    const lat = signals?.lat ?? FALLBACK_LAT;
    const lon = signals?.lon ?? FALLBACK_LON;
    const d = await fetchDeclinationDeg(lat, lon);
    setMagneticDeclinationDeg(d);
    setDeclinationDeg(d);
    headingCleanupRef.current = watchDeviceOrientation((reading) => {
      const t = togglesRef.current;
      if (reading.view) {
        liveAttitudeRef.current.view = reading.view;
        liveAttitudeRef.current.roll = 0;
      }
      setSkyPose(reading.pose);

      const now = performance.now();
      if (now - attitudeHudMs.current < 250) return;
      attitudeHudMs.current = now;

      const h = reading.viewAz ?? reading.heading;
      const p = reading.viewAlt ?? reading.pitch;

      if (h != null && (t.heading || t.location)) {
        setHeadingLive(true);
        if (p != null) setPitchLive(true);
        setCompassCalibrated(getIosAlphaOffset() != null && !compassNeedsPortraitLock());
        setSignals(prev =>
          prev
            ? { ...prev, heading: h, pitch: p ?? prev.pitch }
            : emptySignals({ heading: h, pitch: p ?? 0 }),
        );
        return;
      }

      if (reading.heading != null && t.heading) {
        setHeadingLive(true);
        setSignals(prev => prev
          ? { ...prev, heading: reading.heading }
          : emptySignals({ heading: reading.heading }));
      }
      if (reading.pitch != null && t.location) {
        setPitchLive(true);
        setSignals(prev => prev ? { ...prev, pitch: reading.pitch } : prev);
      }
    });
  }

  function stopHeadingWatch() {
    stopOrientationWatch();
  }

  async function startHeadingWatch() {
    await startOrientationWatch();
  }

  function applyManualHeading(value: number) {
    setHeadingLive(false);
    setManualHeading(normalizeHeading(value));
  }

  // ── Flip a sensor toggle: clear its stale reading when turning off, re-capture when turning on.
  function setSensorEnabled(key: keyof SensorToggles, enabled: boolean) {
    setToggles(prev => ({ ...prev, [key]: enabled }));
    if (key === "skyMap" || key === "compass") return;
    if (key === "heading") {
      if (enabled) void startOrientationWatch();
      else {
        setHeadingLive(false);
        setSignals(prev => prev ? { ...prev, heading: null } : prev);
        if (!toggles.location) stopOrientationWatch();
      }
      return;
    }
    if (key === "location") {
      if (!enabled) {
        setPitchLive(false);
        stopLocationWatch();
        setSignals(prev => prev ? {
          ...prev,
          lat: null,
          lon: null,
          accuracyM: null,
          altM: null,
          altAccuracyM: null,
          speedMps: null,
          gpsHeading: null,
          locationAtMs: null,
          pitch: null,
        } : prev);
        if (!toggles.heading) stopOrientationWatch();
      } else {
        void captureSensors();
      }
      return;
    }
    if (!enabled) {
      setSignals(prev => {
        if (!prev) return prev;
        if (key === "network") return { ...prev, network: null };
        if (key === "emf") return { ...prev, emfUt: null, emfMethod: null };
        return prev;
      });
    } else {
      void captureSensors();
    }
  }

  /**
   * Permission ask from the Allow button (user gesture). After grant, this
   * page session skips the gate. Location starts inside
   * requestDeviceAccessPermissions before awaits.
   */
  async function primeDeviceAccess() {
    if (primingAccessRef.current) return;
    primingAccessRef.current = true;
    setAccessBusy(true);
    try {
      await requestDeviceAccessPermissions();
      setNeedsAccessGate(false);
      void captureSensors();
      void startOrientationWatch();
    } finally {
      primingAccessRef.current = false;
      setAccessBusy(false);
    }
  }

  useEffect(() => {
    installHapticLifecycle();
    let initial = { ...DEFAULT_TOGGLES };
    try {
      const raw = localStorage.getItem(TOGGLES_STORAGE_KEY);
      if (raw) initial = { ...DEFAULT_TOGGLES, ...JSON.parse(raw) };
    } catch { /* fresh session — all senses on */ }
    setToggles(initial);
    // Never requestPermission from mount — splash then the access gate own
    // the first-open gesture. Same-session resume (Studies/Tonal → home)
    // starts watches below without replaying splash.
    return () => {
      muteHaptics();
      cancelHaptic();
      stopOrientationWatch();
      stopLocationWatch();
    };
  }, []);

  useEffect(() => {
    if (tab === "sky" && (toggles.heading || toggles.location)) {
      void startOrientationWatch();
    }
  }, [tab, toggles.heading, toggles.location]);

  // ── Streaming research (tiered v2 engine). Each SSE message is a partial
  // ConfidenceResult; we merge so progress phases enrich rather than reset.
  async function runResearch() {
    if (!query.trim() || resLoading) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setResLoading(true);
    setRes({ phase: "init" });

    // Map the advanced controls to ResearchRequest fields the engine supports.
    const reqBody: Record<string, unknown> = { query, tier };
    if (recency !== "any") reqBody.recency = recency;
    if (academicOnly) reqBody.academicOnly = true;
    const domains = domainFilter.split(",").map(d => d.trim()).filter(Boolean);
    if (domains.length) reqBody.domainFilter = domains;
    const budget = Number(maxBudget);
    if (maxBudget.trim() && Number.isFinite(budget) && budget > 0) reqBody.maxBudgetUSD = budget;

    try {
      const resp = await fetch("/api/research/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: ctrl.signal,
      });
      if (!resp.body) return;
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let eol: number;
        while ((eol = buf.indexOf("\n\n")) !== -1) {
          const line = buf.slice(0, eol);
          buf = buf.slice(eol + 2);
          if (line.startsWith("data: ")) {
            try {
              const msg = JSON.parse(line.slice(6)) as ResearchState;
              setRes(prev => ({ ...(prev ?? {}), ...msg }));
            } catch {}
          }
        }
      }
    } catch (e: unknown) {
      if (!(e instanceof Error && e.name === "AbortError")) {
        setRes(prev => ({ ...(prev ?? {}), error: String(e) }));
      }
    } finally {
      setResLoading(false);
    }
  }

  const PHASE_LABELS: Record<string, string> = {
    init: "Initialising…",
    decompose: "Decomposing query into sub-claims…",
    fetch: "Fetching evidence across providers…",
    "cross-reference": "Cross-referencing & deduping sources…",
    "free-synthesis": "Synthesising free-tier answer…",
    "deep-synthesis": "Running deep synthesis (Valyu / Perplexity)…",
    complete: "Complete",
    result: "Complete",
    error: "Error",
  };

  // ── Wheel data

  const hasLiveHeading = headingLive && signals?.heading != null && (toggles.heading || toggles.location);
  const hasLivePitch = pitchLive && toggles.location;
  const orientationStreaming = headingLive || pitchLive;
  const hasLiveLocation = signals?.lat != null && signals?.lon != null;
  const mapLat = signals?.lat ?? FALLBACK_LAT;
  const mapLon = signals?.lon ?? FALLBACK_LON;
  observerRef.current = { lat: mapLat, lon: mapLon };

  function applySkyAzOffset(value: number) {
    const v = Math.max(-20, Math.min(20, value));
    setSkyAzOffset(v);
    setUserAzimuthOffsetDeg(v);
    try { localStorage.setItem(SKY_AZ_OFFSET_KEY, String(v)); } catch { /* ignore */ }
  }

  /** Camera look azimuth for sun/moon alignment — matches live AR sky view, not throttled HUD heading. */
  function viewAzForCalibration(): number | null {
    if (hasLiveHeading || hasLivePitch) {
      return enuToAltAz(liveAttitudeRef.current.view).az;
    }
    return manualHeading;
  }

  function calibrateCompassToSun() {
    const skyNow = cosmic?.now ?? animNow;
    const bodies = computeCelestialBodies(
      skyNow,
      mapLat,
      mapLon,
      signals?.altM ?? 0,
    );
    const sun = bodies.find(b => b.id === "sun");
    if (!sun || sun.alt < 3) return;
    const viewAz = viewAzForCalibration();
    if (viewAz == null) return;
    const delta = ((sun.az - viewAz + 540) % 360) - 180;
    applySkyAzOffset(skyAzOffset + delta);
  }

  function calibrateCompassToMoon() {
    const skyNow = cosmic?.now ?? animNow;
    const bodies = computeCelestialBodies(
      skyNow,
      mapLat,
      mapLon,
      signals?.altM ?? 0,
    );
    const moon = bodies.find(b => b.id === "moon");
    if (!moon || moon.alt < 8) return;
    const viewAz = viewAzForCalibration();
    if (viewAz == null) return;
    const delta = ((moon.az - viewAz + 540) % 360) - 180;
    applySkyAzOffset(skyAzOffset + delta);
  }

  const moonAboveHorizon = useMemo(() => {
    const moon = computeCelestialBodies(cosmic?.now ?? animNow, mapLat, mapLon, signals?.altM ?? 0)
      .find(b => b.id === "moon");
    return moon != null && moon.alt > 8;
  }, [cosmic?.now, animNow, mapLat, mapLon, signals?.altM]);

  const compassPortraitCalibrated = compassCalibrated;

  const sunAboveHorizon = useMemo(() => {
    const sun = computeCelestialBodies(cosmic?.now ?? animNow, mapLat, mapLon, signals?.altM ?? 0)
      .find(b => b.id === "sun");
    return sun != null && sun.alt > 3;
  }, [cosmic?.now, animNow, mapLat, mapLon, signals?.altM]);

  const magneticDeclination = declinationDeg;
  const activeHeading = orientationStreaming
    ? (signals?.heading ?? enuToAltAz(liveAttitudeRef.current.view).az)
    : manualHeading;
  const activePitch = orientationStreaming
    ? (signals?.pitch ?? enuToAltAz(liveAttitudeRef.current.view).alt)
    : (signals?.pitch ?? 0);
  const skyArPoseReady = skyPose === "ready" && !compassNeedsPortraitLock();
  const skyPoseHint = skyPoseHintMessage(skyPose);
  const spectrumWarmth = cosmic?.ui.warmth ?? cosmic?.sensors.lightSpectrum ?? 0.55;
  const atmosphericBreath = cosmic?.sensors.atmosphericBreath ?? 0;
  const sensesAwake = hasLiveLocation || hasLiveHeading || pitchLive || Boolean(signals?.network);
  const estimatedLux = estimateOutdoorLux(cosmic?.solarDayAngleDeg);
  const skyWeatherSlot = weatherSlotForHour(cycles?.weather ?? null, cosmic?.now ?? animNow);
  const weatherLux = weatherAdjustedLux(
    deviceAmbient.lux ?? estimatedLux,
    skyWeatherSlot?.cloudCover,
    skyWeatherSlot?.isDay ?? false,
  );

  useEffect(() => {
    void fetchDeclinationDeg(mapLat, mapLon).then(d => {
      setMagneticDeclinationDeg(d);
      setDeclinationDeg(d);
    });
  }, [mapLat, mapLon]);

  useEffect(() => {
    if (weatherLux != null) cosmicEngine?.setLux(weatherLux);
  }, [weatherLux, cosmicEngine]);

  function clampZoom(z: number) {
    return Math.max(0.75, Math.min(2.8, z));
  }

  const canPanWheel = springZoom > 1.04 || focusRing != null;

  function onWheelPanPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (tab !== "clock" || !canPanWheel) return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".cp-btn, .cp-wheel-controls-float")) return;

    panDragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      panX: wheelPan.x,
      panY: wheelPan.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onWheelPanPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (!drag?.active) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      drag.moved = true;
      setWheelDragging(true);
    }
    if (!drag.moved) return;
    e.preventDefault();
    setWheelPan({ x: drag.panX + dx, y: drag.panY + dy });
  }

  function finishWheelPan(e?: React.PointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (!drag?.active) return;
    if (drag.moved) suppressRingClickRef.current = true;
    panDragRef.current = null;
    setWheelDragging(false);
    setWheelPan({ x: 0, y: 0 });
    if (e) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    if (drag.moved) {
      window.setTimeout(() => { suppressRingClickRef.current = false; }, 0);
    }
  }

  function onWheelPanPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    finishWheelPan(e);
  }

  function onWheelPanPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    finishWheelPan(e);
  }

  function handleRingSelect(id: string, meta: RingSelectMeta) {
    if (suppressRingClickRef.current) return;
    setFocusRing(prev => {
      if (prev === id) {
        setFocusRingData(null);
        setWheelZoom(1);
        return null;
      }
      setFocusRingData(meta.ring);
      setWheelZoom(clampZoom(zoomForRingRadius(meta.radius, true)));
      setHoverRing(id);
      return id;
    });
  }

  function clearRingFocus() {
    setFocusRing(null);
    setFocusRingData(null);
    setWheelPan({ x: 0, y: 0 });
    setWheelZoom(heroZoomDefault);
  }

  function onWheelZoom(e: React.WheelEvent<HTMLDivElement>) {
    if (tab !== "clock") return;
    e.preventDefault();
    setWheelZoom(prev => clampZoom(prev + (e.deltaY < 0 ? 0.08 : -0.08)));
  }

  function touchDistance(touches: React.TouchList) {
    if (touches.length < 2) return null;
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function onTouchStartZoom(e: React.TouchEvent<HTMLDivElement>) {
    if (tab !== "clock") return;
    if (e.touches.length === 2) {
      touchPanRef.current = null;
      const d = touchDistance(e.touches);
      if (d == null) return;
      pinchStartRef.current = d;
      pinchZoomRef.current = wheelZoom;
      return;
    }
    if (e.touches.length === 1 && canPanWheel) {
      const t = e.touches[0]!;
      touchPanRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        panX: wheelPan.x,
        panY: wheelPan.y,
      };
    }
  }

  function onTouchMoveZoom(e: React.TouchEvent<HTMLDivElement>) {
    if (tab !== "clock") return;
    if (e.touches.length >= 2) {
      touchPanRef.current = null;
      const d = touchDistance(e.touches);
      if (d == null || pinchStartRef.current == null) return;
      e.preventDefault();
      const ratio = d / pinchStartRef.current;
      setWheelZoom(clampZoom(pinchZoomRef.current * ratio));
      return;
    }
    const pan = touchPanRef.current;
    if (!pan || e.touches.length !== 1) return;
    const t = e.touches[0]!;
    const dx = t.clientX - pan.startX;
    const dy = t.clientY - pan.startY;
    if (Math.hypot(dx, dy) <= 6) return;
    e.preventDefault();
    suppressRingClickRef.current = true;
    setWheelPan({ x: pan.panX + dx, y: pan.panY + dy });
  }

  function onTouchEndZoom(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 0) {
      if (touchPanRef.current) {
        setWheelPan({ x: 0, y: 0 });
        window.setTimeout(() => { suppressRingClickRef.current = false; }, 0);
      }
      touchPanRef.current = null;
    }
    if (e.touches.length < 2) pinchStartRef.current = null;
  }

  return (
    <OnyxApp
      bootReady={launchReady && accessReady}
      showSplash={showLaunch && !chorusEmbed}
      onSplashDone={() => {
        if (hasAccessThisSession()) {
          setNeedsAccessGate(false);
          void captureSensors();
          void startOrientationWatch();
        }
        completeLaunch();
        if (clockSfxOn) void enableSfx();
      }}
      onPrimeAccess={() => {
        if (hasAccessThisSession()) void primeDeviceAccess();
      }}
      showAccessGate={needsAccessGate && !chorusEmbed}
      sensorsUnlocked={!needsAccessGate}
      onAllowAccess={() => {
        void primeDeviceAccess();
      }}
      accessBusy={accessBusy}
      now={cosmic?.now ?? animNow}
      lat={mapLat}
      lon={mapLon}
      altM={signals?.altM ?? null}
      headingDeg={activeHeading}
      pitchDeg={activePitch}
      liveAttitudeRef={liveAttitudeRef}
      liveHeading={hasLiveHeading || orientationStreaming}
      livePitch={hasLivePitch || orientationStreaming}
      arPoseReady={skyArPoseReady}
      skyWeather={skyWeatherSlot}
      skyWarmth={spectrumWarmth}
      sensorDiag={sensorDiag}
      onEnterSky={() => {
        // Retry watches if already primed; do not re-prompt from here.
        if (toggles.heading || toggles.location) void startOrientationWatch();
        void captureSensors();
      }}
      cycles={cycles}
      cosmic={cosmic}
      stripReadings={stripReadings}
      multiVoice={multiVoice}
      cyclePrefs={cyclePrefs}
      onCyclePrefsChange={updateCyclePrefs}
      onRingSelect={handleRingSelect}
      onTellMore={(name) => {
        setTab("oracle");
        setQuery((q) => (q?.trim() ? q : `Tell me about ${name}.`));
      }}
      emfUt={toggles.emf ? signals?.emfUt ?? null : null}
      emfLive={Boolean(toggles.emf && signals?.emfUt != null)}
      emfMethod={toggles.emf ? signals?.emfMethod ?? null : null}
      pulseEnabled={clockSfxOn}
      onPulseEnabledChange={on => {
        setClockSfxOn(on);
        if (on) void enableSfx();
        else muteClockAudio({ fadeMs: 120 });
      }}
      sensorProps={{
        autoAwaken: true,
        onAmbient: handleAmbient,
        weatherPressureHpa: cycles?.weather?.pressureHpa ?? null,
        estimatedLux,
        speedMps: signals?.speedMps ?? null,
        headingDeg: signals?.heading ?? manualHeading,
        onAwaken: async () => {
          if (toggles.heading || toggles.location) void startOrientationWatch();
          void captureSensors();
        },
      }}
    />
  );

}
