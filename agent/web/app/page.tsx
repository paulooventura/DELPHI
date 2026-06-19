"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CycleSnapshot } from "../lib/cycleSystems";
import { getCycleSnapshot } from "../lib/cycleSystems";
import { starsInDirection, relevantConstellations, STAR_TO_CONSTELLATION, type SkyObject, type ConstellationHit } from "../lib/starmap";
import type { SourceItem, ResearchReport, ProviderReview } from "../lib/researchEngine";
import { getLocation, requestOrientationPermission, watchCompassHeading, getMagneticField, getNetworkInfo } from "../lib/localSignals";
import { WatchMovement } from "../components/WatchMovement";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLOCK_RINGS = [
  { id: "ms",  name: "ms",  color: "#fbbf24", icon: "⚙" },
  { id: "s",   name: "sec", color: "#f97316", icon: "◷" },
  { id: "min", name: "min", color: "#ef4444", icon: "⏱" },
  { id: "h",   name: "hr",  color: "#d946ef", icon: "🕰" },
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
const MANUAL_HEADING_KEY = "cp-manual-heading";
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
  heading: number | null;
  network: string | null;
  emfUt: number | null;
};

type StreamState = {
  phase: number;
  status: string;
  complete?: boolean;
  insufficientEvidence?: boolean;
  error?: string;
  answer?: string;
  confidence?: number;
  sources?: SourceItem[];
  peerReview?: ProviderReview[];
  report?: ResearchReport | null;
};

// ─── Sky Map ──────────────────────────────────────────────────────────────────

function SkyMapSVG({ lat, lon, heading, pitchDeg, minuteKey, variant = "standalone" }: {
  lat: number; lon: number; heading: number; pitchDeg: number; minuteKey: number;
  variant?: "standalone" | "background" | "legend";
}) {
  const W = 320, H = 168;
  const FOV_AZ = 85;
  const FOV_ALT_HALF = 42;
  const isBg = variant === "background";
  const isLegend = variant === "legend";

  const stars: SkyObject[] = useMemo(
    () => starsInDirection(lat, lon, heading, new Date(), FOV_AZ, 3.5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lon, Math.round(heading * 2) / 2, minuteKey],
  );

  const constellations: ConstellationHit[] = useMemo(
    () => relevantConstellations(lat, lon, heading, new Date(), FOV_AZ, 3.5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lon, Math.round(heading * 2) / 2, minuteKey],
  );

  function toXY(az: number, alt: number): [number, number] {
    const dAz = ((az - heading + 540) % 360) - 180;
    const dAlt = alt - pitchDeg;
    const x = (dAz / FOV_AZ + 0.5) * W;
    const y = H / 2 - (dAlt / FOV_ALT_HALF) * (H / 2);
    return [x, y];
  }

  const CARD_AZS  = [0, 45, 90, 135, 180, 225, 270, 315];
  const CARD_LBLS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const bearing   = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(heading / 22.5) % 16];

  const starsByConstellation = useMemo(() => {
    const groups = new Map<string, SkyObject[]>();
    for (const star of stars) {
      const cName = STAR_TO_CONSTELLATION[star.name];
      if (!cName) continue;
      const list = groups.get(cName) ?? [];
      list.push(star);
      groups.set(cName, list);
    }
    return groups;
  }, [stars]);

  const svg = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={isBg ? "100%" : undefined}
      preserveAspectRatio={isBg ? "xMidYMid slice" : undefined}
      className={`cp-skymap${isBg ? " cp-skymap-bg" : ""}`}
    >
      <defs>
        <linearGradient id={isBg ? "skyg-bg" : "skyg"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#010409"/>
          <stop offset="70%" stopColor="#08192e"/>
          <stop offset="100%" stopColor="#12253d"/>
        </linearGradient>
        {isBg && (
          <radialGradient id="skyg-vignette" cx="50%" cy="88%" r="72%">
            <stop offset="55%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        )}
      </defs>
      <rect width={W} height={H} fill={`url(#${isBg ? "skyg-bg" : "skyg"})`} rx={isBg ? 0 : 6}/>
      {isBg && <rect width={W} height={H} fill="url(#skyg-vignette)" />}

      {[0, 15, 30, 45, 60, 75, 90].map(alt => {
        const y = H / 2 - ((alt - pitchDeg) / FOV_ALT_HALF) * (H / 2);
        if (y < -4 || y > H + 4) return null;
        const isHorizon = alt === 0;
        return (
          <g key={alt}>
            <line
              x1={0} y1={y} x2={W} y2={y}
              stroke={isHorizon ? "#35506d" : isBg ? "#143248" : "#0c2236"}
              strokeWidth={isHorizon ? 1.2 : 1}
              strokeDasharray={isHorizon ? undefined : "3,9"}
              opacity={isBg ? 0.85 : 1}
            />
            <text x={4} y={y - 2} fontSize={isBg ? 7 : 6.5} fill={isHorizon ? "#5a8cb0" : "#3a5870"}>
              {alt}°
            </text>
          </g>
        );
      })}

      <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#12324a" strokeWidth={1} strokeDasharray="2,6" opacity={isBg ? 0.75 : 1}/>
      {!isBg && (
        <text x={W - 8} y={H - 4} fontSize="7" fill="#4a6c88" textAnchor="end">Center {Math.round(pitchDeg)}° alt</text>
      )}

      {CARD_AZS.map((cAz, ci) => {
        const dAz = ((cAz - heading + 540) % 360) - 180;
        if (Math.abs(dAz) > FOV_AZ / 2 + 8) return null;
        const x = (dAz / FOV_AZ + 0.5) * W;
        const isPrimary = ci % 2 === 0;
        return (
          <g key={ci} opacity={isBg ? 0.8 : 1}>
            <line x1={x} y1={H - (isPrimary ? 14 : 8)} x2={x} y2={H} stroke={isPrimary ? "#1e4d70" : "#102840"} strokeWidth={1}/>
            {isPrimary && (
              <text x={x} y={H - 17} textAnchor="middle" fontSize={isBg ? 8 : 7} fill="#2e6080" fontWeight="700">
                {CARD_LBLS[ci]}
              </text>
            )}
          </g>
        );
      })}

      {/* faint constellation stick figures from visible stars */}
      {isBg && Array.from(starsByConstellation.entries()).map(([name, group]) => {
        if (group.length < 2) return null;
        const sorted = [...group].sort((a, b) => a.az - b.az);
        const points = sorted
          .map(s => toXY(s.az, s.alt))
          .filter(([x, y]) => x >= -8 && x <= W + 8 && y >= -8 && y <= H + 8);
        if (points.length < 2) return null;
        const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
        const [lx, ly] = toXY(
          sorted.reduce((s, st) => s + st.az, 0) / sorted.length,
          sorted.reduce((s, st) => s + st.alt, 0) / sorted.length,
        );
        return (
          <g key={name} opacity={0.55}>
            <path d={d} fill="none" stroke="#5a9ec8" strokeWidth={0.9} strokeDasharray="2,3" />
            <text x={lx} y={ly - 4} textAnchor="middle" fontSize={7.5} fill="#6eb8e8" fontWeight="600">
              {name}
            </text>
          </g>
        );
      })}

      {stars.map(star => {
        const [x, y] = toXY(star.az, star.alt);
        if (x < -18 || x > W + 18 || y < -18 || y > H + 18) return null;
        const r = Math.max(0.9, (3.6 - star.mag) * 1.15 + 0.9) * (isBg ? 1.15 : 1);
        const op = Math.min(1, (0.45 + (3.6 - star.mag) / 5.5) * (isBg ? 1.25 : 1));
        const fill = star.mag < 0.5 ? "#fffff5" : star.mag < 1.5 ? "#eef5ff" : "#d5e8ff";
        return (
          <g key={star.name}>
            <circle cx={x} cy={y} r={r * 2.4} fill={`rgba(100,170,255,${op * (isBg ? 0.14 : 0.09)})`}/>
            <circle cx={x} cy={y} r={r} fill={fill} opacity={op}/>
            {!isBg && star.mag < 1.8 && (
              <text x={x + r + 2.5} y={y + 3.5} fontSize="5.5" fill={`rgba(110,175,220,${op * 0.8})`}>{star.name}</text>
            )}
          </g>
        );
      })}

      <text x={W / 2} y={11} textAnchor="middle" fontSize={isBg ? 9.5 : 8.5} fill="#4a9cc4" opacity={isBg ? 0.95 : 1}>
        {`↑ ${Math.round(heading)}°  ${bearing}  ·  pitch ${Math.round(pitchDeg)}°`}
      </text>

      {stars.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="10" fill="#203045">
          No bright stars above horizon in this direction
        </text>
      )}
    </svg>
  );

  if (isBg) return svg;

  const legend = (
    <>
      <div className="cp-constellations">
        {constellations.length > 0
          ? constellations.map(c => (
              <span key={c.name} className="cp-const-pill" title={`${Math.round(c.avgAz)}° az · ${Math.round(c.avgAlt)}° alt`}>
                ✦ {c.name} · {c.starsVisible}
              </span>
            ))
          : <span className="cp-muted">No major constellation anchors in this slice right now.</span>}
      </div>
      <p className="cp-muted cp-skymap-meta">
        {stars.length} bright star{stars.length === 1 ? "" : "s"} in view · {Math.round(heading)}° {bearing} · {Math.round(pitchDeg)}° altitude
      </p>
    </>
  );

  if (isLegend) {
    return <div className="cp-skymap-wrap cp-skymap-legend">{legend}</div>;
  }

  return (
    <div className="cp-skymap-wrap">
      {svg}
      {legend}
    </div>
  );
}

// ─── Compass Rose ─────────────────────────────────────────────────────────────

function CompassRose({ heading }: { heading: number }) {
  const DIRS = ["N","NE","E","SE","S","SW","W","NW"];
  return (
    <div className="cp-compass">
      <svg viewBox="0 0 84 84" width="84" height="84">
        <circle cx={42} cy={42} r={38} fill="none" stroke="#142230" strokeWidth="1.5"/>
        {DIRS.map((d, i) => {
          const a   = i * 45;
          const rad = (a - 90) * (Math.PI / 180);
          const r1 = 26, r2 = 34;
          const x1 = 42 + r1 * Math.cos(rad), y1 = 42 + r1 * Math.sin(rad);
          const x2 = 42 + r2 * Math.cos(rad), y2 = 42 + r2 * Math.sin(rad);
          const isPrimary = d.length === 1;
          return (
            <g key={d}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={d === "N" ? "#ef4444" : "#203855"} strokeWidth={isPrimary ? 1.5 : 1}/>
              <text
                x={42 + 40 * Math.cos(rad)} y={42 + 40 * Math.sin(rad) + 2.5}
                textAnchor="middle" fontSize={isPrimary ? 8.5 : 6.5}
                fill={d === "N" ? "#ef4444" : "#3a6080"}
                fontWeight={isPrimary ? "700" : "400"}
              >{d}</text>
            </g>
          );
        })}
        {/* needle */}
        <g transform={`rotate(${heading} 42 42)`}>
          <polygon points="42,6 44,38 40,38"  fill="#ef4444" opacity="0.9"/>
          <polygon points="42,78 44,46 40,46" fill="#2a4a6a" opacity="0.75"/>
        </g>
        <circle cx={42} cy={42} r={3.5} fill="#0e1a2a" stroke="#2a4060" strokeWidth="1.2"/>
      </svg>
      <span className="cp-compass-deg">{Math.round(heading)}°</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [animNow, setAnimNow] = useState(() => new Date());
  const [minuteKey, setMinuteKey] = useState(0);

  const [cycles, setCycles]     = useState<CycleSnapshot | null>(() => getCycleSnapshot(new Date()));
  const [signals, setSignals]   = useState<Signals | null>(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [locDenied, setLocDenied] = useState(false);
  const [headingLive, setHeadingLive] = useState(false);
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
  const [skyPitch, setSkyPitch] = useState(35);
  const [hoverRing, setHoverRing] = useState<string | null>(null);
  const [toggles, setToggles] = useState<SensorToggles>(DEFAULT_TOGGLES);

  const [query, setQuery]       = useState("");
  const [res, setRes]           = useState<StreamState | null>(null);
  const [resLoading, setResLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pinchStartRef = useRef<number | null>(null);
  const pinchZoomRef = useRef(1);
  const headingCleanupRef = useRef<(() => void) | null>(null);

  // ── Smooth watch motion (rAF)
  useEffect(() => {
    let frame = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= 33) {
        last = t;
        setAnimNow(new Date());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

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

  // ── Fetch cycles
  const loadCycles = useCallback(async (lat?: number, lon?: number) => {
    const q = lat != null ? `?lat=${lat}&lon=${lon}` : "";
    const data = await fetch(`/api/cycles${q}`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
    if (data) {
      setCycles(data as CycleSnapshot);
      return;
    }
    // Local fallback when the API route is unreachable (e.g. opened without Next.js).
    setCycles(getCycleSnapshot(new Date()));
  }, []);

  useEffect(() => { void loadCycles(); }, [loadCycles]);

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
  async function captureSensors(t: SensorToggles = toggles) {
    setSigLoading(true);
    setLocDenied(false);
    try {
      const [location, emf] = await Promise.all([
        t.location ? getLocation() : Promise.resolve({ latitude: null, longitude: null, accuracyM: null }),
        t.emf ? getMagneticField() : Promise.resolve({ magneticFieldUt: null, method: "disabled" }),
      ]);
      if (t.location && location.latitude == null) setLocDenied(true);
      const network = t.network ? getNetworkInfo() : { effectiveType: null, downlinkMbps: null, rttMs: null, hint5G: "" };
      setSignals(prev => ({
        lat: location.latitude,
        lon: location.longitude,
        heading: prev?.heading ?? null,
        network: network.effectiveType,
        emfUt: emf.magneticFieldUt,
      }));
      if (location.latitude != null && location.longitude != null) void loadCycles(location.latitude, location.longitude);
    } finally {
      setSigLoading(false);
    }
  }

  // ── Live heading: a continuous "deviceorientation" subscription so the
  // compass dial and sky map rotate in real time as the device turns.
  // iOS 13+ requires requestOrientationPermission() to run inside a user
  // gesture (a click), so this must be called directly from onClick handlers,
  // not from inside an effect.
  function stopHeadingWatch() {
    headingCleanupRef.current?.();
    headingCleanupRef.current = null;
  }

  async function startHeadingWatch() {
    stopHeadingWatch();
    setHeadingLive(false);
    const allowed = await requestOrientationPermission();
    if (!allowed) return;
    headingCleanupRef.current = watchCompassHeading(heading => {
      if (heading == null || !Number.isFinite(heading)) return;
      setHeadingLive(true);
      setSignals(prev => prev ? { ...prev, heading } : { lat: null, lon: null, network: null, emfUt: null, heading });
    });
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
      if (enabled) void startHeadingWatch();
      else {
        stopHeadingWatch();
        setHeadingLive(false);
        setSignals(prev => prev ? { ...prev, heading: null } : prev);
      }
      return;
    }
    if (!enabled) {
      setSignals(prev => {
        if (!prev) return prev;
        if (key === "location") return { ...prev, lat: null, lon: null };
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
    // Auto-starts on Android (no permission prompt needed); on iOS this
    // silently no-ops until the user taps "Locate Me" or the Heading toggle.
    if (initial.heading) void startHeadingWatch();
    return () => stopHeadingWatch();
  }, []);

  // ── Streaming research
  async function runResearch() {
    if (!query.trim() || resLoading) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setResLoading(true);
    setRes({ phase: 0, status: "Initialising deep search…" });
    try {
      const resp = await fetch("/api/research/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
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
            try { setRes(JSON.parse(line.slice(6)) as StreamState); } catch {}
          }
        }
      }
    } catch (e: unknown) {
      if (!(e instanceof Error && e.name === "AbortError")) {
        setRes(prev => ({ ...prev ?? { phase: -1, status: "Error" }, error: String(e) }));
      }
    } finally {
      setResLoading(false);
    }
  }

  // ── Wheel data
  const calendarWheels = cycles?.wheelLayers ?? [];
  const weatherRing    = cycles?.weather ?? null;

  const hasLiveHeading = headingLive && signals?.heading != null;
  const activeHeading = hasLiveHeading ? signals!.heading! : manualHeading;
  const hasLiveLocation = signals?.lat != null && signals?.lon != null;
  const mapLat = signals?.lat ?? FALLBACK_LAT;
  const mapLon = signals?.lon ?? FALLBACK_LON;

  function clampZoom(z: number) {
    return Math.max(0.85, Math.min(2.8, z));
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

  // Time display
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <main className="cp-shell">
      <div className="cp-stack">

        {/* ── 1. CYCLE WHEELS + SKY (hero) ───────────────────────────────── */}
        <section className="cp-hero-wheel">
          <div className="cp-hero-wheel-head">
            <h1 className="cp-hero-title">Cycle Wheels</h1>
            <div className="cp-wheel-controls">
              <button className="cp-btn cp-btn-sm" onClick={() => setWheelZoom(z => clampZoom(z - 0.12))}>−</button>
              <span className="cp-zoom-label">{Math.round(wheelZoom * 100)}%</span>
              <button className="cp-btn cp-btn-sm" onClick={() => setWheelZoom(z => clampZoom(z + 0.12))}>+</button>
              <button className="cp-btn cp-btn-sm" onClick={() => setWheelZoom(1)}>Reset</button>
              <button className="cp-btn cp-btn-sm"
                onClick={() => loadCycles(signals?.lat ?? undefined, signals?.lon ?? undefined)}>↺</button>
              <button
                className="cp-btn cp-btn-sm"
                onClick={() => {
                  if (toggles.heading) void startHeadingWatch();
                  void captureSensors();
                }}
                disabled={sigLoading}
              >
                {sigLoading ? "…" : "📍 Locate"}
              </button>
            </div>
          </div>

          <div
            className="cp-wheel-viewport cp-wheel-viewport-hero"
            onWheel={onWheelZoom}
            onTouchStart={onTouchStartZoom}
            onTouchMove={onTouchMoveZoom}
            onTouchEnd={onTouchEndZoom}
          >
            <div className="cp-hero-composite">
              {toggles.skyMap ? (
                <div className="cp-hero-skymap" aria-hidden>
                  <SkyMapSVG
                    variant="background"
                    lat={mapLat}
                    lon={mapLon}
                    heading={activeHeading}
                    pitchDeg={skyPitch}
                    minuteKey={minuteKey}
                  />
                </div>
              ) : (
                <div className="cp-hero-skymap cp-hero-skymap-off" aria-hidden />
              )}

              <div className="cp-watch-scaler cp-watch-overlay" style={{ transform: `scale(${wheelZoom})` }}>
                <WatchMovement
                  glass
                  animMs={animNow.getTime()}
                  now={animNow}
                  weather={weatherRing}
                  calendarWheels={calendarWheels}
                  hoverId={hoverRing}
                  onHover={setHoverRing}
                  heading={activeHeading}
                  emfUt={toggles.emf ? signals?.emfUt ?? null : null}
                  showCompass={toggles.compass}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. CLOCK ───────────────────────────────────────────────────── */}
        <div className="cp-clock-bar cp-clock-bar-inline">
          <div className="cp-clock-time">{hh}<span className="cp-clock-colon">:</span>{mm}<span className="cp-clock-colon">:</span>{ss}</div>
          <div className="cp-clock-meta">
            {cycles
              ? `${cycles.gregorian.weekday}, ${cycles.gregorian.month} ${cycles.gregorian.day} ${cycles.gregorian.year}  ·  W${cycles.gregorian.weekOfYear}  ·  D${cycles.gregorian.dayOfYear}`
              : "Loading…"}
          </div>
        </div>

        {/* ── 3. SKY & COMPASS ───────────────────────────────────────────── */}
        <section className="cp-card cp-sky-card">
          <div className="cp-card-head">
            <h2 className="cp-card-title">Sky &amp; Compass</h2>
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
            <p className="cp-muted cp-sensor-off">Sky map background hidden — enable Sky Map to see stars behind the wheels.</p>
          )}

          <div className="cp-compass-row">
            {toggles.compass ? (
              <>
                <CompassRose heading={activeHeading}/>
                <div className="cp-compass-controls">
                  <label className="cp-dir-label">
                    <span>{hasLiveHeading ? "Live compass" : "Direction (manual)"}</span>
                    <input
                      type="range" min={0} max={359}
                      value={hasLiveHeading ? Math.round(signals!.heading!) : manualHeading}
                      onChange={e => applyManualHeading(Number(e.target.value))}
                      onInput={e => applyManualHeading(Number(e.currentTarget.value))}
                      disabled={hasLiveHeading}
                      className="cp-dir-range"
                    />
                    <span>{Math.round(activeHeading)}°</span>
                  </label>
                  <label className="cp-dir-label">
                    <span>Sky pitch (vertical look angle)</span>
                    <input
                      type="range" min={5} max={85}
                      value={Math.round(skyPitch)}
                      onChange={e => setSkyPitch(Number(e.target.value))}
                      className="cp-dir-range"
                    />
                    <span>{Math.round(skyPitch)}° altitude</span>
                  </label>
                  {hasLiveHeading ? (
                    <p className="cp-muted">↗ Device compass active — turn off Heading to aim manually.</p>
                  ) : (
                    <p className="cp-muted">Drag direction to pan horizontally; pitch tilts the sky view up and down behind the wheels.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="cp-compass-controls" style={{ flex: 1 }}>
                  <label className="cp-dir-label">
                    <span>Sky pitch (vertical look angle)</span>
                    <input
                      type="range" min={5} max={85}
                      value={Math.round(skyPitch)}
                      onChange={e => setSkyPitch(Number(e.target.value))}
                      className="cp-dir-range"
                    />
                    <span>{Math.round(skyPitch)}° altitude</span>
                  </label>
                </div>
                <p className="cp-muted cp-sensor-off">Compass disabled — wheels use fixed north at top.</p>
              </>
            )}
          </div>

          {toggles.skyMap && (
            <SkyMapSVG
              variant="legend"
              lat={mapLat}
              lon={mapLon}
              heading={activeHeading}
              pitchDeg={skyPitch}
              minuteKey={minuteKey}
            />
          )}

          <div className="cp-signal-readouts">
            {toggles.location && signals?.lat != null && (
              <p className="cp-muted">{signals.lat.toFixed(3)}°, {signals.lon?.toFixed(3)}°</p>
            )}
            {toggles.location && !hasLiveLocation && !locDenied && (
              <p className="cp-muted">Using Nashville fallback coords until you tap Locate Me.</p>
            )}
            {toggles.location && locDenied && (
              <p className="cp-muted">Location blocked — allow browser location for your local sky map.</p>
            )}
            {!toggles.location && <p className="cp-muted cp-sensor-off">Location disabled.</p>}
            {toggles.network && signals?.network && (
              <p className="cp-muted">Network: {signals.network}</p>
            )}
            {toggles.emf && signals?.emfUt != null && (
              <p className="cp-muted">EMF: {signals.emfUt.toFixed(1)} µT</p>
            )}
          </div>
        </section>

        {/* ── 4. COSMIC DATA ─────────────────────────────────────────────── */}
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
            {weatherRing && (
              <span className="cp-rl-item">
                <span className="cp-rl-dot" style={{ background: "#22d3ee" }}/>
                {weatherRing.emoji} {weatherRing.condition}
              </span>
            )}
            {calendarWheels.map(w => (
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

        {/* ── 5. RESEARCH ────────────────────────────────────────────────── */}
        <section className="cp-card">
          <h2 className="cp-card-title">Research Console</h2>
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
                ? <span className="cp-loading-row"><span className="cp-spinner"/>Searching…</span>
                : "Deep Research"}
            </button>
            {resLoading && (
              <button className="cp-btn cp-btn-ghost" onClick={() => abortRef.current?.abort()}>Stop</button>
            )}
          </div>
          {res?.status && (
            <p className="cp-status-row">
              <span className="cp-dot"/>
              {res.status}
              {res.phase > 0 && <span className="cp-phase-badge">Phase {res.phase}</span>}
            </p>
          )}
        </section>

        {res && (
          <section className="cp-card cp-research-out">
            <div className="cp-card-head">
              <h2 className="cp-card-title">Output</h2>
              {res.complete && res.insufficientEvidence && <span className="cp-badge-warn">Insufficient evidence</span>}
              {res.complete && !res.insufficientEvidence && <span className="cp-badge-ok">Done</span>}
              {resLoading && !res.complete && <span className="cp-badge-run">Live</span>}
            </div>

            {res.error && <p className="cp-error">Error: {res.error}</p>}

            {res.answer && (
              <div className="cp-answer-block">
                <p className="cp-label">Answer</p>
                <p className="cp-answer-text">{res.answer}</p>
                {res.confidence != null && (
                  <>
                    <div className="cp-conf-bar" style={{ marginTop: 8 }}>
                      <div className="cp-conf-fill" style={{ width: `${(res.confidence * 100).toFixed(0)}%` }}/>
                    </div>
                    <p className="cp-muted" style={{ fontSize: "0.71rem", marginTop: 3 }}>
                      {(res.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </>
                )}
              </div>
            )}

            {!!res.peerReview?.length && (
              <div className="cp-peer">
                <p className="cp-label">AI Cross-Check ({res.peerReview.length} model{res.peerReview.length === 1 ? "" : "s"} — uses your own API key)</p>
                {res.peerReview.map((r, i) => (
                  <div key={i} className="cp-peer-item">
                    <div className="cp-peer-head"><strong>{r.provider}</strong><span>{(r.confidence * 100).toFixed(0)}%</span></div>
                    <p>{r.answer}</p>
                  </div>
                ))}
              </div>
            )}

            {res.report && (
              <details className="cp-report">
                <summary>Crawl Report — {res.report.acceptedSources} accepted · {res.report.rejectedSources} filtered</summary>
                <p className="cp-report-stop">{res.report.stopReason}</p>
                <p className="cp-report-stop">Avg freshness: {(res.report.avgFreshness * 100).toFixed(0)}% · {res.report.uncertaintyNote}</p>
                {!!res.report.aiProvidersConsulted?.length && (
                  <p className="cp-report-stop">AI models consulted: {res.report.aiProvidersConsulted.join(", ")}</p>
                )}
                <div className="cp-provider-grid">
                  {res.report.searchedProviders.map((p, i) => (
                    <div key={i} className={`cp-provider-item cp-tier-${p.tier}`}>
                      <strong>{p.provider}</strong>
                      <span>{p.tier}</span>
                      <p>{p.accepted}/{p.fetched} · {p.avgReliability.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {!!res.sources?.length && (
              <div className="cp-sources">
                <p className="cp-label">Sources ({res.sources.length})</p>
                {res.sources.slice(0, 12).map((s, i) => (
                  <article key={i} className={`cp-source cp-source-${s.tier}`}>
                    <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                    <div className="cp-source-meta">
                      <span>{s.source}</span>
                      <span className={`cp-tier-badge cp-tier-${s.tier}`}>{s.tier}</span>
                      <span>{(s.reliability * 100).toFixed(0)}%</span>
                      {typeof s.freshness === "number" && <span>fresh {(s.freshness * 100).toFixed(0)}%</span>}
                      {typeof s.ageDays === "number" && <span>{s.ageDays}d old</span>}
                    </div>
                    <p>{s.snippet.slice(0, 170)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {!res && (
          <div className="cp-card cp-empty">
            <p className="cp-muted">Type a question and click Deep Research.</p>
          </div>
        )}
      </div>
    </main>
  );
}
