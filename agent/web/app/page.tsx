"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CycleSnapshot } from "../lib/cycleSystems";
import { getCycleSnapshot } from "../lib/cycleSystems";
import { CelestialSkyView } from "../components/CelestialSkyView";
import type { ResearchTier, ConfidenceResult, SourceResult, ScoredClaim, ConfidenceLabel } from "../lib/researchEngine";
import { getLocation, requestOrientationPermission, watchDeviceOrientation, getMagneticField, getNetworkInfo, watchLocation, type GeoFix } from "../lib/localSignals";
import { WatchMovement } from "../components/WatchMovement";
import { SpacetimeReadout } from "../components/SpacetimeReadout";
import { RingFocusPanel, zoomForRingRadius } from "../components/RingFocusPanel";
import { useClockSfx } from "../hooks/useClockSfx";
import { useCosmicClock } from "../hooks/useCosmicClock";
import { useSpringValue } from "../hooks/useSpringValue";
import { LaunchScreen, useShowLaunch } from "../components/LaunchScreen";
import { OracleLogo } from "../components/oracle/OracleLogo";
import { SensorArray } from "../components/SensorArray";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLOCK_RINGS = [
  { id: "ms",  name: "ms (0–99)", color: "#fbbf24" },
  { id: "s",   name: "sec", color: "#f97316" },
  { id: "min", name: "min", color: "#ef4444" },
  { id: "h",   name: "hr",  color: "#d946ef" },
];

const DATE_RINGS = [
  { id: "weather", name: "weather", color: "#22d3ee" },
  { id: "day", name: "day", color: "#c084fc" },
  { id: "weekday", name: "weekday", color: "#94a3b8" },
  { id: "chinese-sign", name: "chinese", color: "#dc2626" },
  { id: "tzolkin", name: "tzolkin", color: "#7c3aed" },
  { id: "moon", name: "moon", color: "#94a3b8" },
];

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
  emf: false, // opt-in: magnetometer permission prompts are intrusive
};

const TOGGLES_STORAGE_KEY = "cp-sensor-toggles";
const RESEARCH_TIER_KEY = "cp-research-tier";
const MANUAL_HEADING_KEY = "cp-manual-heading";

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
const FALLBACK_LAT = 36.1627;
const FALLBACK_LON = -86.7816;

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
  const [skyPitch, setSkyPitch] = useState(35);
  const [skyDistance, setSkyDistance] = useState(50);
  const [hoverRing, setHoverRing] = useState<string | null>(null);
  const [focusRing, setFocusRing] = useState<string | null>(null);
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
  const loadCyclesRef = useRef<(lat?: number, lon?: number) => Promise<void>>(async () => {});
  const togglesRef = useRef(toggles);
  const { active: sfxActive, enable: enableSfx } = useClockSfx(clockSfxOn);
  const [showLaunch, completeLaunch] = useShowLaunch();

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

  const { now: animNow, state: cosmic } = useCosmicClock({
    lat: signals?.lat ?? FALLBACK_LAT,
    lon: signals?.lon ?? FALLBACK_LON,
    headingDeg: signals?.heading ?? manualHeading,
    altitudeM: signals?.altM ?? null,
    pressureHpa: deviceAmbient.pressureHpa ?? cycles?.weather?.pressureHpa ?? null,
    lux: deviceAmbient.lux,
  });

  useEffect(() => { togglesRef.current = toggles; }, [toggles]);

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
    setCycles(getCycleSnapshot(new Date(), weather));
  }, []);

  useEffect(() => { loadCyclesRef.current = loadCycles; }, [loadCycles]);

  useEffect(() => { void loadCycles(); }, [loadCycles]);

  // Recompute calendar layers every minute (preserve latest weather).
  useEffect(() => {
    setCycles(prev => getCycleSnapshot(new Date(), prev?.weather));
  }, [minuteKey]);

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
    locationCleanupRef.current = watchLocation(
      (fix) => {
        if (fix.latitude == null || fix.longitude == null) return;
        setLocDenied(false);
        setSignals(prev => applyGeoFix(prev, fix));
        const moved = Math.hypot(fix.latitude - lastLat, fix.longitude - lastLon) > 0.002;
        if (moved || !Number.isFinite(lastLat)) {
          lastLat = fix.latitude;
          lastLon = fix.longitude;
          void loadCyclesRef.current(fix.latitude, fix.longitude);
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
        };
      });
      if (t.location && location?.latitude != null && location.longitude != null) {
        void loadCycles(location.latitude, location.longitude);
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
  }

  async function startOrientationWatch() {
    stopOrientationWatch();
    setHeadingLive(false);
    setPitchLive(false);
    const allowed = await requestOrientationPermission();
    if (!allowed) return;
    headingCleanupRef.current = watchDeviceOrientation(({ heading, pitch }) => {
      const t = togglesRef.current;
      if (heading != null && t.heading) {
        setHeadingLive(true);
        setSignals(prev => prev
          ? { ...prev, heading }
          : emptySignals({ heading }));
      }
      if (pitch != null && t.location) {
        setPitchLive(true);
        setSkyPitch(pitch);
        setSignals(prev => prev ? { ...prev, pitch } : prev);
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
        if (key === "emf") return { ...prev, emfUt: null };
        return prev;
      });
    } else {
      void captureSensors();
    }
  }

  useEffect(() => {
    let initial = DEFAULT_TOGGLES;
    try {
      const raw = localStorage.getItem(TOGGLES_STORAGE_KEY);
      if (raw) initial = { ...DEFAULT_TOGGLES, ...JSON.parse(raw) };
    } catch {}
    setToggles(initial);
    void captureSensors(initial);
    if (initial.heading || initial.location) void startOrientationWatch();
    return () => {
      stopOrientationWatch();
      stopLocationWatch();
    };
  }, []);

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
  const calendarWheels = cycles?.wheelLayers ?? [];

  const hasLiveHeading = headingLive && signals?.heading != null && toggles.heading;
  const hasLivePitch = pitchLive && toggles.location;
  const activeHeading = hasLiveHeading ? signals!.heading! : manualHeading;
  const activePitch = skyPitch;
  const hasLiveLocation = signals?.lat != null && signals?.lon != null;
  const mapLat = signals?.lat ?? FALLBACK_LAT;
  const mapLon = signals?.lon ?? FALLBACK_LON;
  const spectrumWarmth = cosmic?.ui.warmth ?? cosmic?.sensors.lightSpectrum ?? 0.55;

  function clampZoom(z: number) {
    return Math.max(0.85, Math.min(2.8, z));
  }

  function handleRingSelect(id: string, meta: { radius: number }) {
    setFocusRing(prev => {
      if (prev === id) {
        setWheelZoom(1);
        return null;
      }
      setWheelZoom(clampZoom(zoomForRingRadius(meta.radius, true)));
      setHoverRing(id);
      return id;
    });
  }

  function clearRingFocus() {
    setFocusRing(null);
    setWheelZoom(1);
  }

  function onWheelZoom(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey) return;
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
    const d = touchDistance(e.touches);
    if (d == null) return;
    pinchStartRef.current = d;
    pinchZoomRef.current = wheelZoom;
  }

  function onTouchMoveZoom(e: React.TouchEvent<HTMLDivElement>) {
    const d = touchDistance(e.touches);
    if (d == null || pinchStartRef.current == null) return;
    const ratio = d / pinchStartRef.current;
    setWheelZoom(clampZoom(pinchZoomRef.current * ratio));
  }

  function onTouchEndZoom() {
    pinchStartRef.current = null;
  }

  return (
    <>
      {showLaunch && (
        <LaunchScreen
          now={animNow}
          lat={mapLat}
          lon={mapLon}
          telemetryReady={Boolean(cycles && cosmic)}
          onComplete={completeLaunch}
        />
      )}
    <main className={`cp-shell${showLaunch ? " cp-shell-under-launch" : ""}`}>
      <div className="cp-stack">

        {/* ── 1. CYCLE WHEELS + SKY (hero) ───────────────────────────────── */}
        <section
          className="cp-hero-wheel"
          style={cosmic ? { ["--cosmic-hue" as string]: String(Math.round(cosmic.ui.hue)) } : undefined}
        >
          <div className="cp-hero-wheel-head">
            <div className="cp-hero-brand">
              <OracleLogo size={42} className="cp-hero-mark" />
              <div className="cp-hero-brand-text">
                <h1 className="cp-hero-title">DELPHI</h1>
                <p className="cp-hero-subtitle">COSMIC CLOCK | ASTRONOMICAL GUIDANCE</p>
              </div>
            </div>
            <div className="cp-wheel-controls">
              <button className="cp-btn cp-btn-sm" onClick={() => setWheelZoom(z => clampZoom(z - 0.12))}>−</button>
              <span className="cp-zoom-label cp-tabular">{Math.round(springZoom * 100)}%</span>
              <button className="cp-btn cp-btn-sm" onClick={() => setWheelZoom(z => clampZoom(z + 0.12))}>+</button>
              <button className="cp-btn cp-btn-sm" onClick={() => { clearRingFocus(); setWheelZoom(1); }}>Reset</button>
              <button className="cp-btn cp-btn-sm"
                onClick={() => loadCycles(signals?.lat ?? undefined, signals?.lon ?? undefined)}>↺</button>
              <button
                className="cp-btn cp-btn-sm"
                onClick={() => {
                  if (toggles.heading || toggles.location) void startOrientationWatch();
                  void captureSensors();
                }}
                disabled={sigLoading}
              >
                {sigLoading ? "…" : "📍 Locate"}
              </button>
              <button
                className={`cp-btn cp-btn-sm${clockSfxOn ? " cp-toggle-on" : ""}`}
                onClick={() => {
                  if (!clockSfxOn) enableSfx();
                  setClockSfxOn(v => !v);
                }}
                title={sfxActive ? "Clock sound on" : "Click to enable clock sound"}
              >
                {clockSfxOn ? "🔊" : "🔇"}
              </button>
            </div>
          </div>

          <SpacetimeReadout
            now={animNow}
            lat={mapLat}
            lon={mapLon}
            liveCoords={hasLiveLocation && toggles.location}
            usingFallback={!hasLiveLocation && toggles.location}
            locationDenied={locDenied}
            locationEnabled={toggles.location}
            accuracyM={signals?.accuracyM ?? null}
            altM={signals?.altM ?? null}
            altAccuracyM={signals?.altAccuracyM ?? null}
            speedMps={signals?.speedMps ?? null}
            gpsHeading={signals?.gpsHeading ?? null}
            locationAtMs={signals?.locationAtMs ?? null}
            compassHeading={toggles.compass ? activeHeading : null}
            pitchDeg={toggles.location ? activePitch : null}
            emfUt={toggles.emf ? signals?.emfUt ?? null : null}
            cosmic={cosmic}
          />

          {focusRing && (
            <RingFocusPanel
              ringId={focusRing}
              cycles={cycles}
              cosmic={cosmic}
              now={animNow}
              onClose={clearRingFocus}
            />
          )}

          <div
            className="cp-wheel-viewport cp-wheel-viewport-hero"
            onWheel={onWheelZoom}
            onTouchStart={onTouchStartZoom}
            onTouchMove={onTouchMoveZoom}
            onTouchEnd={onTouchEndZoom}
          >
            <div className="cp-split-hero">
              <div className="cp-split-wheels">
                <div className="cp-semicircle-clip">
                  <div
                    className={`cp-watch-scaler cp-watch-scaler-spring${focusRing ? " cp-watch-scaler-focused" : ""}`}
                    style={{ transform: `scale(${springZoom})` }}
                  >
                    <WatchMovement
                      glass
                      semicircle
                      now={animNow}
                      cycles={cycles}
                      hoverId={hoverRing}
                      onHover={setHoverRing}
                      focusRingId={focusRing}
                      onRingSelect={handleRingSelect}
                      heading={activeHeading}
                      emfUt={toggles.emf ? signals?.emfUt ?? null : null}
                      showCompass={toggles.compass}
                      skyDistance={skyDistance}
                      onSkyDistanceChange={setSkyDistance}
                      spectrumWarmth={spectrumWarmth}
                    />
                  </div>
                </div>
              </div>

              {toggles.skyMap ? (
                <div className="cp-split-skymap">
                  <CelestialSkyView
                    lat={mapLat}
                    lon={mapLon}
                    headingDeg={activeHeading}
                    pitchDeg={activePitch}
                    observationTime={cosmic?.now ?? animNow}
                    distanceRank={skyDistance}
                    liveHeading={hasLiveHeading}
                    livePitch={hasLivePitch}
                    hapticsEnabled={toggles.location || toggles.heading}
                    warmth={spectrumWarmth}
                  />
                </div>
              ) : (
                <div className="cp-split-skymap cp-split-skymap-off">
                  <p className="cp-muted">Sky map off</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 2. SKY CONTROLS ────────────────────────────────────────────── */}
        <section className="cp-card cp-sky-card">
          <div className="cp-card-head">
            <h2 className="cp-card-title">Sky Controls</h2>
          </div>

          <div className="cp-sensor-toggles">
            {SENSOR_TOGGLE_DEFS.map(t => (
              <button
                key={t.key}
                className={`cp-toggle${toggles[t.key] ? " cp-toggle-on" : ""}`}
                onClick={() => setSensorEnabled(t.key, !toggles[t.key])}
                title={`${t.label}: ${toggles[t.key] ? "on" : "off"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!toggles.skyMap && (
            <p className="cp-muted cp-sensor-off">Sky map hidden — enable Sky Map to see the lower panel.</p>
          )}

          <div className="cp-compass-controls">
            {toggles.compass && !hasLiveHeading && (
              <label className="cp-dir-label">
                <span>Manual direction</span>
                <input
                  type="range" min={0} max={359}
                  value={manualHeading}
                  onChange={e => applyManualHeading(Number(e.target.value))}
                  onInput={e => applyManualHeading(Number(e.currentTarget.value))}
                  className="cp-dir-range"
                />
                <span>{Math.round(activeHeading)}°</span>
              </label>
            )}
            {(hasLiveHeading || hasLivePitch) && (
              <p className="cp-muted">
                {hasLiveHeading && hasLivePitch && "↗ Live heading & pitch — tilt and turn your device."}
                {hasLiveHeading && !hasLivePitch && "↗ Live heading — enable Location for auto pitch."}
                {!hasLiveHeading && hasLivePitch && "↕ Live pitch — enable Heading for auto compass."}
              </p>
            )}
            {!hasLiveHeading && !hasLivePitch && toggles.location && (
              <p className="cp-muted">Tap Locate Me to enable live sky orientation (requires motion permission on iOS).</p>
            )}
          </div>

          <div className="cp-signal-readouts">
            {toggles.location && !hasLiveLocation && !locDenied && (
              <p className="cp-muted">Using Nashville fallback coords — tap Locate for live GPS (see readout above).</p>
            )}
            {toggles.location && locDenied && (
              <p className="cp-muted">Location blocked — allow browser location for your local sky map.</p>
            )}
            {toggles.network && signals?.network && (
              <p className="cp-muted">Network: {signals.network}</p>
            )}
          </div>
        </section>

        {/* ── 2b. ORACLE SENSES (full device sensor array) ────────────────── */}
        <SensorArray className="cp-card" onAmbient={handleAmbient} />

        {/* ── 3. COSMIC DATA ─────────────────────────────────────────────── */}
        <section className="cp-card cp-cosmic-card">
          <h2 className="cp-card-title">Cosmic Data</h2>

          <div className="cp-ring-legend">
            {CLOCK_RINGS.map(cr => (
              <span
                key={cr.id}
                className={`cp-rl-item cp-rl-link${hoverRing === cr.id ? " cp-rl-active" : ""}`}
                onMouseEnter={() => setHoverRing(cr.id)}
                onMouseLeave={() => setHoverRing(null)}
              >
                <span className="cp-rl-dot" style={{ background: cr.color }}/>
                {cr.name}
              </span>
            ))}
            {DATE_RINGS.map(dr => (
              <span
                key={dr.id}
                className={`cp-rl-item cp-rl-link${hoverRing === dr.id ? " cp-rl-active" : ""}`}
                onMouseEnter={() => setHoverRing(dr.id)}
                onMouseLeave={() => setHoverRing(null)}
              >
                <span className="cp-rl-dot" style={{ background: dr.color }}/>
                {dr.name}
                {cycles && dr.id === "weather" && `: ${cycles.weather?.emoji ?? ""} ${cycles.weather?.condition ?? ""}`}
                {cycles && dr.id === "day" && `: ${cycles.gregorian.day}`}
                {cycles && dr.id === "weekday" && `: ${cycles.gregorian.weekday}`}
                {cycles && dr.id === "chinese-sign" && `: ${cycles.chineseZodiac.symbol} ${cycles.chineseZodiac.animal}`}
                {cycles && dr.id === "tzolkin" && `: Kin ${cycles.tzolkin.kin} ${cycles.tzolkin.sign}`}
                {cycles && dr.id === "moon" && `: ${cycles.lunar.emoji} ${cycles.lunar.phase}`}
              </span>
            ))}
            {calendarWheels.filter(w => !["day", "chinese-sign", "moon"].includes(w.id)).map(w => (
              <span
                key={w.id}
                className={`cp-rl-item cp-rl-link${hoverRing === w.id ? " cp-rl-active" : ""}`}
                onMouseEnter={() => setHoverRing(w.id)}
                onMouseLeave={() => setHoverRing(null)}
              >
                <span className="cp-rl-dot" style={{ background: w.color }}/>
                <span>{w.icon}</span>
                <span className="cp-rl-name">{w.name}:</span>
                {w.label}
              </span>
            ))}
          </div>

          {cycles && (
            <div className="cp-cycle-grid">
              <div className="cp-cv"><span>Moon</span><strong>{cycles.lunar.emoji} {cycles.lunar.phase}</strong></div>
              <div className="cp-cv"><span>Tzolkin</span><strong>Kin {cycles.tzolkin.kin} T{cycles.tzolkin.tone} {cycles.tzolkin.sign}</strong></div>
              <div className="cp-cv"><span>Castle</span><strong>{cycles.mayan.castleName}</strong></div>
              <div className="cp-cv"><span>Season</span><strong>{cycles.season.emoji} {cycles.season.name}</strong></div>
              <div className="cp-cv"><span>Chinese</span><strong>{cycles.chineseZodiac.symbol} {cycles.chineseZodiac.element} {cycles.chineseZodiac.animal}</strong></div>
              <div className="cp-cv"><span>Zodiac</span><strong>{cycles.westernZodiac.symbol} {cycles.westernZodiac.sign}</strong></div>
            </div>
          )}

          {cosmic && (
            <div className="cp-cosmic-layers">
              <p className="cp-cosmic-layers-title">Cosmic Clock Engine · 6 tiers</p>
              <div className="cp-cosmic-layer-grid">
                {cosmic.layers.map(layer => (
                  <div key={layer.id} className="cp-cosmic-layer" title={layer.name}>
                    <span className="cp-cosmic-layer-tier">T{layer.tier}</span>
                    <span className="cp-cosmic-layer-dot" style={{ background: layer.color }}/>
                    <span className="cp-cosmic-layer-name">{layer.name}</span>
                    <span className="cp-cosmic-layer-angle">{layer.angleDeg.toFixed(2)}°</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cycles && (
            <div className="cp-spectrum">
              {cycles.spectrum.map(s => (
                <div key={s.name} className="cp-spectrum-row">
                  <div><strong>{s.name}</strong><p>{s.note}</p></div>
                  <div className="cp-spectrum-meta">
                    <span className={`cp-axis cp-axis-${s.axis}`}>{s.axis}</span>
                    <span className="cp-score">{s.score.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 4. RESEARCH ────────────────────────────────────────────────── */}
        <section className="cp-card">
          <h2 className="cp-card-title">Research Console</h2>

          {/* Tier selector — the user picks the computation tier per query. */}
          <div className="cp-tier-selector" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {RESEARCH_TIERS.map(t => {
              const active = t.id === tier;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTier(t.id)}
                  disabled={resLoading}
                  title={t.blurb}
                  style={{
                    flex: "1 1 80px",
                    padding: "7px 8px",
                    borderRadius: 8,
                    cursor: resLoading ? "default" : "pointer",
                    border: active ? "1px solid var(--gold-dp)" : "1px solid rgba(148,163,184,0.25)",
                    background: active ? "rgba(201,162,39,0.16)" : "rgba(148,163,184,0.06)",
                    color: active ? "var(--gold-lt)" : "#94a3b8",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "block", fontWeight: 600, fontSize: "0.8rem" }}>
                    {t.label}
                    <span style={{ marginLeft: 6, fontSize: "0.6rem", color: t.free ? "#34d399" : "#fbbf24" }}>
                      {t.free ? "FREE" : "PAID"}
                    </span>
                  </span>
                  <span style={{ display: "block", fontSize: "0.62rem", opacity: 0.8 }}>{t.latency}</span>
                </button>
              );
            })}
          </div>
          <p className="cp-muted" style={{ fontSize: "0.66rem", marginBottom: 8 }}>
            {RESEARCH_TIERS.find(t => t.id === tier)?.blurb}
            {!RESEARCH_TIERS.find(t => t.id === tier)?.free && " — falls back to Standard if no API key is configured."}
          </p>

          {/* Advanced query controls — map straight to ResearchRequest fields. */}
          <button
            type="button"
            className="cp-btn cp-btn-ghost"
            onClick={() => setShowAdvanced(v => !v)}
            style={{ fontSize: "0.68rem", padding: "3px 8px", marginBottom: showAdvanced ? 8 : 6 }}
          >
            {showAdvanced ? "▾ Advanced options" : "▸ Advanced options"}
          </button>
          {showAdvanced && (
            <div style={{ display: "grid", gap: 8, marginBottom: 10, padding: 10, borderRadius: 8, background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.18)" }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", color: "#cbd5e1" }}>
                <span>Recency</span>
                <select
                  value={recency}
                  onChange={e => setRecency(e.target.value as typeof recency)}
                  style={{ background: "#0b1220", color: "#e2e8f0", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6, padding: "3px 6px", fontSize: "0.72rem" }}
                >
                  <option value="any">Any time</option>
                  <option value="day">Past day</option>
                  <option value="week">Past week</option>
                  <option value="month">Past month</option>
                  <option value="year">Past year</option>
                </select>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem", color: "#cbd5e1" }}>
                <input type="checkbox" checked={academicOnly} onChange={e => setAcademicOnly(e.target.checked)} />
                <span>Academic only (Tier-1 scholarly sources)</span>
              </label>

              <label style={{ display: "grid", gap: 3, fontSize: "0.72rem", color: "#cbd5e1" }}>
                <span>Domain filter <span className="cp-muted" style={{ fontSize: "0.62rem" }}>(comma-separated, e.g. nature.com, who.int)</span></span>
                <input
                  type="text"
                  value={domainFilter}
                  onChange={e => setDomainFilter(e.target.value)}
                  placeholder="any"
                  style={{ background: "#0b1220", color: "#e2e8f0", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6, padding: "4px 6px", fontSize: "0.72rem" }}
                />
              </label>

              {(tier === "deep" || tier === "max") && (
                <label style={{ display: "grid", gap: 3, fontSize: "0.72rem", color: "#cbd5e1" }}>
                  <span>Max budget (USD) <span className="cp-muted" style={{ fontSize: "0.62rem" }}>(hard ceiling for paid synthesis)</span></span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={maxBudget}
                    onChange={e => setMaxBudget(e.target.value)}
                    placeholder={tier === "max" ? "20.00" : "4.00"}
                    style={{ background: "#0b1220", color: "#e2e8f0", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6, padding: "4px 6px", fontSize: "0.72rem" }}
                  />
                </label>
              )}
            </div>
          )}

          <textarea
            className="cp-textarea"
            rows={5}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) void runResearch(); }}
            placeholder="Ask a research question…  Ctrl+Enter to run"
          />
          <div className="cp-actions">
            <button className="cp-btn cp-btn-primary" onClick={runResearch} disabled={resLoading || !query.trim()}>
              {resLoading
                ? <span className="cp-loading-row"><span className="cp-spinner"/>Researching…</span>
                : `Research · ${RESEARCH_TIERS.find(t => t.id === tier)?.label}`}
            </button>
            {resLoading && (
              <button className="cp-btn cp-btn-ghost" onClick={() => abortRef.current?.abort()}>Stop</button>
            )}
          </div>
          {res?.phase && (
            <p className="cp-status-row">
              <span className="cp-dot"/>
              {PHASE_LABELS[res.phase] ?? res.phase}
              {res.tierUsed && <span className="cp-phase-badge">{res.tierUsed}</span>}
            </p>
          )}
        </section>

        {res && (
          <section className="cp-card cp-research-out">
            <div className="cp-card-head">
              <h2 className="cp-card-title">Output</h2>
              {res.complete && <span className="cp-badge-ok">Done</span>}
              {resLoading && !res.complete && <span className="cp-badge-run">Live</span>}
              {res.answer && (
                <button
                  type="button"
                  className="cp-btn cp-btn-ghost"
                  style={{ marginLeft: "auto", fontSize: "0.66rem", padding: "3px 8px" }}
                  onClick={() => {
                    const summary = [
                      `Q: ${query}`,
                      `A: ${res.answer}`,
                      res.confidenceLabel ? `Confidence: ${res.confidenceLabel} (${((res.confidenceScore ?? 0) * 100).toFixed(0)}%)` : "",
                      res.contradictions?.length ? `Contradictions:\n${res.contradictions.map(c => `- ${c}`).join("\n")}` : "",
                      res.sources?.length ? `Sources:\n${res.sources.slice(0, 10).map(s => `- ${s.title} (${s.url})`).join("\n")}` : "",
                    ].filter(Boolean).join("\n\n");
                    void navigator.clipboard?.writeText(summary).catch(() => {});
                  }}
                >
                  Copy
                </button>
              )}
            </div>

            {res.error && <p className="cp-error">Error: {res.error}</p>}

            {res.answer && (
              <div className="cp-answer-block">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <p className="cp-label" style={{ margin: 0 }}>Answer</p>
                  {res.confidenceLabel && (
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 700, padding: "2px 9px", borderRadius: 999,
                      color: "#0b1220", background: CONFIDENCE_COLORS[res.confidenceLabel],
                    }}>
                      {res.confidenceLabel}
                    </span>
                  )}
                </div>
                <p className="cp-answer-text" style={{ whiteSpace: "pre-wrap" }}>{res.answer}</p>
                {res.confidenceScore != null && (
                  <>
                    <div className="cp-conf-bar" style={{ marginTop: 8 }}>
                      <div className="cp-conf-fill" style={{
                        width: `${(res.confidenceScore * 100).toFixed(0)}%`,
                        background: res.confidenceLabel ? CONFIDENCE_COLORS[res.confidenceLabel] : undefined,
                      }}/>
                    </div>
                    <p className="cp-muted" style={{ fontSize: "0.71rem", marginTop: 3 }}>
                      {(res.confidenceScore * 100).toFixed(0)}% confidence
                      {res.providersUsed?.length ? ` · ${res.providersUsed.length} providers` : ""}
                      {typeof res.costUSD === "number" ? ` · $${res.costUSD.toFixed(res.costUSD < 0.01 ? 4 : 2)}` : ""}
                    </p>
                  </>
                )}
              </div>
            )}

            {!!res.contradictions?.length && (
              <div className="cp-answer-block" style={{ borderLeft: "3px solid #fbbf24", paddingLeft: 10 }}>
                <p className="cp-label" style={{ color: "#fbbf24" }}>Contradictions surfaced ({res.contradictions.length})</p>
                {res.contradictions.map((c, i) => (
                  <p key={i} className="cp-muted" style={{ fontSize: "0.72rem", marginTop: 2 }}>• {c}</p>
                ))}
              </div>
            )}

            {!!res.claims?.length && (
              <details className="cp-report" open>
                <summary>Claims analysed ({res.claims.length})</summary>
                {res.claims.map((c: ScoredClaim, i) => {
                  const label = c.label as ConfidenceLabel;
                  return (
                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: "0.76rem" }}>{c.text}</span>
                        <span style={{ fontSize: "0.66rem", fontWeight: 700, whiteSpace: "nowrap", color: CONFIDENCE_COLORS[label] ?? "#94a3b8" }}>
                          {label} {(c.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="cp-muted" style={{ fontSize: "0.64rem", marginTop: 2 }}>
                        {c.supportingSources.length} supporting · {c.contradictingSources.length} contradicting
                      </p>
                    </div>
                  );
                })}
              </details>
            )}

            {!!res.sources?.length && (
              <div className="cp-sources">
                <p className="cp-label">Sources ({res.sources.length})</p>
                {res.sources.slice(0, 14).map((s: SourceResult, i) => {
                  const meta = PROVIDER_TIER_META[s.providerTier];
                  return (
                    <article key={i} className="cp-source">
                      <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                      <div className="cp-source-meta">
                        <span>{s.domain}</span>
                        <span className="cp-tier-badge" style={{ color: "#0b1220", background: meta.color }}>{meta.label}</span>
                        {typeof s.citationCount === "number" && s.citationCount > 0 && <span>cited {s.citationCount}</span>}
                        {s.publishedDate && <span>{s.publishedDate.slice(0, 10)}</span>}
                      </div>
                      {s.snippet && <p>{s.snippet.slice(0, 170)}</p>}
                    </article>
                  );
                })}
              </div>
            )}

            {!!res.providersUsed?.length && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10, alignItems: "center" }}>
                <span className="cp-muted" style={{ fontSize: "0.64rem" }}>
                  Providers{res.subClaims?.length ? ` · ${res.subClaims.length} sub-claims` : ""}:
                </span>
                {res.providersUsed.map((p, i) => (
                  <span key={i} style={{
                    fontSize: "0.62rem", padding: "2px 7px", borderRadius: 999,
                    background: "rgba(148,163,184,0.12)", color: "#cbd5e1", border: "1px solid rgba(148,163,184,0.2)",
                  }}>
                    {p}
                  </span>
                ))}
              </div>
            )}

            {!!res.notes?.length && (
              <div style={{ marginTop: 10 }}>
                {res.notes.map((n, i) => (
                  <p key={i} className="cp-muted" style={{ fontSize: "0.66rem" }}>ⓘ {n}</p>
                ))}
              </div>
            )}
          </section>
        )}

        {!res && (
          <div className="cp-card cp-empty">
            <p className="cp-muted">Pick a tier, type a question, and run. The free tiers need no API keys.</p>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
