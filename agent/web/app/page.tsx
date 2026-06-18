"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CycleSnapshot } from "../lib/cycleSystems";
import { starsInDirection, relevantConstellations, type SkyObject, type ConstellationHit } from "../lib/starmap";
import type { ProviderReview, SourceItem, ResearchReport } from "../lib/researchEngine";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLOCK_RINGS = [
  { id: "ms",  name: "ms",  color: "#fbbf24", periodS: 1     },
  { id: "s",   name: "sec", color: "#f97316", periodS: 60    },
  { id: "min", name: "min", color: "#ef4444", periodS: 3600  },
  { id: "h",   name: "hr",  color: "#d946ef", periodS: 43200 },
];

const RING_BASE = 54;   // innermost ring diameter px
const RING_STEP = 26;   // px per ring step — wider gap so badges stay readable

// Pull a short, glanceable value for the on-ring badge.
// Prefers a number in the sublabel/label, else a stripped short label.
function compactWheelValue(w: { label: string; sublabel: string }): string {
  const subNum = w.sublabel.match(/\d+/)?.[0];
  if (subNum) return subNum;
  const labelNum = w.label.match(/\d+/)?.[0];
  if (labelNum) return labelNum;
  // strip leading emoji/symbol, keep first short token
  const stripped = w.label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  return stripped.length <= 4 ? stripped : stripped.slice(0, 3);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Signals = {
  lat: number | null;
  lon: number | null;
  heading: number | null;
  network: string | null;
};

type StreamState = {
  phase: number;
  status: string;
  complete?: boolean;
  error?: string;
  answer?: string;
  confidence?: number;
  sources?: SourceItem[];
  peerReview?: ProviderReview[];
  report?: ResearchReport;
};

// ─── Sky Map ──────────────────────────────────────────────────────────────────

function SkyMapSVG({ lat, lon, heading, minuteKey }: {
  lat: number; lon: number; heading: number; minuteKey: number;
}) {
  const W = 320, H = 168;
  const FOV_AZ = 85, FOV_ALT = 90;

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
    return [(dAz / FOV_AZ + 0.5) * W, H - (alt / FOV_ALT) * H];
  }

  const CARD_AZS  = [0, 45, 90, 135, 180, 225, 270, 315];
  const CARD_LBLS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const bearing   = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(heading / 22.5) % 16];

  return (
    <div className="cp-skymap-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="cp-skymap">
        <defs>
          <linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#010409"/>
            <stop offset="70%" stopColor="#08192e"/>
            <stop offset="100%" stopColor="#12253d"/>
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#skyg)" rx="6"/>

        {[15, 30, 45, 60, 75].map(alt => {
          const y = H - (alt / FOV_ALT) * H;
          return <line key={alt} x1={0} y1={y} x2={W} y2={y} stroke="#0c2236" strokeWidth={1} strokeDasharray="3,9"/>;
        })}

        {/* Horizon and zenith references */}
        <line x1={0} y1={H} x2={W} y2={H} stroke="#35506d" strokeWidth={1.2}/>
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="#12324a" strokeWidth={1} strokeDasharray="2,6"/>
        <text x={6} y={H - 4} fontSize="7" fill="#4a6c88">Horizon</text>
        <text x={W - 8} y={9} fontSize="7" fill="#4a6c88" textAnchor="end">Zenith</text>

        {CARD_AZS.map((cAz, ci) => {
          const dAz = ((cAz - heading + 540) % 360) - 180;
          if (Math.abs(dAz) > FOV_AZ / 2 + 8) return null;
          const x = (dAz / FOV_AZ + 0.5) * W;
          const isPrimary = ci % 2 === 0;
          return (
            <g key={ci}>
              <line x1={x} y1={H - (isPrimary ? 14 : 8)} x2={x} y2={H} stroke={isPrimary ? "#1e4d70" : "#102840"} strokeWidth={1}/>
              {isPrimary && <text x={x} y={H - 17} textAnchor="middle" fontSize="7" fill="#2e6080" fontWeight="700">{CARD_LBLS[ci]}</text>}
            </g>
          );
        })}

        {stars.map(star => {
          const [x, y] = toXY(star.az, star.alt);
          if (x < -18 || x > W + 18 || y < -18 || y > H + 18) return null;
          const r = Math.max(0.9, (3.6 - star.mag) * 1.15 + 0.9);
          const op = Math.min(1, 0.45 + (3.6 - star.mag) / 5.5);
          const fill = star.mag < 0.5 ? "#fffff5" : star.mag < 1.5 ? "#eef5ff" : "#d5e8ff";
          return (
            <g key={star.name}>
              <circle cx={x} cy={y} r={r * 2.4} fill={`rgba(100,170,255,${op * 0.09})`}/>
              <circle cx={x} cy={y} r={r} fill={fill} opacity={op}/>
              {star.mag < 1.8 && (
                <text x={x + r + 2.5} y={y + 3.5} fontSize="5.5" fill={`rgba(110,175,220,${op * 0.8})`}>{star.name}</text>
              )}
            </g>
          );
        })}

        <text x={W / 2} y={11} textAnchor="middle" fontSize="8.5" fill="#3a7898">
          {`↑ ${Math.round(heading)}°  ${bearing}`}
        </text>

        {stars.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="10" fill="#203045">
            No bright stars above horizon in this direction
          </text>
        )}
      </svg>

      <div className="cp-constellations">
        {constellations.length > 0
          ? constellations.map(c => (
              <span key={c.name} className="cp-const-pill" title={`${Math.round(c.avgAz)}° az · ${Math.round(c.avgAlt)}° alt`}>
                ✦ {c.name} · {c.starsVisible}
              </span>
            ))
          : <span className="cp-muted">No major constellation anchors in this slice right now.</span>}
      </div>
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

// ─── Wheel ring ───────────────────────────────────────────────────────────────

function WheelRing({ size, color, angleDeg, periodS, offsetS, icon, value, name, fullLabel, active, onHover }: {
  size: number;
  color: string;
  angleDeg?: number;
  periodS?: number;
  offsetS?: number;
  icon?: string;
  value?: string | number;
  name?: string;
  fullLabel?: string;
  active?: boolean;
  onHover?: (on: boolean) => void;
}) {
  const isAnim = periodS != null;

  const ringStyle: React.CSSProperties = isAnim
    ? {
        width: size, height: size, borderColor: color,
        borderWidth: active ? 3 : undefined,
        animationName: "ring-spin",
        animationDuration: `${periodS}s`,
        animationDelay: `-${offsetS ?? 0}s`,
        animationTimingFunction: "linear",
        animationIterationCount: "infinite",
        animationFillMode: "both",
      }
    : {
        width: size, height: size, borderColor: color,
        borderWidth: active ? 3 : undefined,
        boxShadow: active ? `0 0 8px 1px ${color}` : undefined,
        transform: `translate(-50%, -50%) rotate(${angleDeg ?? 0}deg)`,
      };

  const hasLabel = icon != null || value != null;

  return (
    <div className="cp-ring-anchor">
      <div
        className={`cp-ring${active ? " cp-ring-active" : ""}`}
        style={ringStyle}
        onMouseEnter={onHover ? () => onHover(true) : undefined}
        onMouseLeave={onHover ? () => onHover(false) : undefined}
      >
        <div className="cp-ring-dot" style={{ background: color, boxShadow: `0 0 5px 1px ${color}88` }}>
          {hasLabel && (
            // counter-rotate so the badge stays upright while the ring is rotated
            <span
              className={`cp-ring-badge${active ? " cp-ring-badge-active" : ""}`}
              style={{
                transform: `rotate(${-(angleDeg ?? 0)}deg)`,
                borderColor: color,
                color,
                background: active ? color : undefined,
              }}
            >
              {icon && <span className="cp-ring-badge-icon">{icon}</span>}
              {value != null && <span className="cp-ring-badge-val">{value}</span>}
              {active && fullLabel && <span className="cp-ring-badge-full">{name ? `${name}: ` : ""}{fullLabel}</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [now, setNow] = useState(() => new Date());
  const [minuteKey, setMinuteKey] = useState(0);

  const [cycles, setCycles]     = useState<CycleSnapshot | null>(null);
  const [signals, setSignals]   = useState<Signals | null>(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [manualHeading, setManualHeading] = useState(180);
  const [wheelZoom, setWheelZoom] = useState(1);
  const [hoverRing, setHoverRing] = useState<string | null>(null);

  const [query, setQuery]       = useState("");
  const [res, setRes]           = useState<StreamState | null>(null);
  const [resLoading, setResLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pinchStartRef = useRef<number | null>(null);
  const pinchZoomRef = useRef(1);

  // ── Clock offsets: computed client-side only (no SSR mismatch)
  const [clockOffsets, setClockOffsets] = useState<{ ms: number; s: number; min: number; h: number } | null>(null);

  useEffect(() => {
    const n = new Date();
    setClockOffsets({
      ms:  n.getMilliseconds() / 1000,
      s:   n.getSeconds() + n.getMilliseconds() / 1000,
      min: n.getMinutes() * 60 + n.getSeconds() + n.getMilliseconds() / 1000,
      h:   (n.getHours() % 12) * 3600 + n.getMinutes() * 60 + n.getSeconds() + n.getMilliseconds() / 1000,
    });
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

  // ── Fetch cycles
  const loadCycles = useCallback(async (lat?: number, lon?: number) => {
    const q = lat != null ? `?lat=${lat}&lon=${lon}` : "";
    const data = await fetch(`/api/cycles${q}`).then(r => r.json()).catch(() => null);
    if (data) setCycles(data as CycleSnapshot);
  }, []);

  useEffect(() => { void loadCycles(); }, [loadCycles]);

  // ── Refresh cadence: keep sky/cycles current every minute.
  useEffect(() => {
    const id = setInterval(() => {
      setMinuteKey(k => k + 1);
      if (!signals?.heading || !signals?.lat || !signals?.lon) {
        void captureSensors();
      }
      void loadCycles(signals?.lat ?? undefined, signals?.lon ?? undefined);
    }, 60000);
    return () => clearInterval(id);
  }, [signals?.heading, signals?.lat, signals?.lon, loadCycles]);

  // ── Capture signals
  async function captureSensors() {
    setSigLoading(true);
    try {
      let lat: number | null = null, lon: number | null = null;
      if ("geolocation" in navigator) {
        await new Promise<void>(resolve => {
          navigator.geolocation.getCurrentPosition(
            p => { lat = p.coords.latitude; lon = p.coords.longitude; resolve(); },
            () => resolve(),
            { timeout: 7000, enableHighAccuracy: true },
          );
        });
      }
      let heading: number | null = null;
      await new Promise<void>(resolve => {
        const fn = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
          heading = typeof e.webkitCompassHeading === "number"
            ? e.webkitCompassHeading
            : typeof e.alpha === "number" ? (360 - e.alpha) % 360 : null;
          window.removeEventListener("deviceorientation", fn as EventListener);
          resolve();
        };
        window.addEventListener("deviceorientation", fn as EventListener, { once: true });
        setTimeout(() => { window.removeEventListener("deviceorientation", fn as EventListener); resolve(); }, 2500);
      });
      const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
      setSignals({ lat, lon, heading, network: nav.connection?.effectiveType ?? null });
      if (lat != null && lon != null) void loadCycles(lat, lon);
    } finally {
      setSigLoading(false);
    }
  }

  useEffect(() => {
    void captureSensors();
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

  // ── Wheel sizing
  const calendarWheels = cycles?.wheelLayers ?? [];
  const weatherRing    = cycles?.weather ?? null;
  const calendarCount  = calendarWheels.length;
  const clockCount     = CLOCK_RINGS.length;
  const totalRings     = clockCount + (weatherRing ? 1 : 0) + calendarCount;
  const outerDiameter  = RING_BASE + (totalRings - 1) * RING_STEP;
  const containerH     = Math.ceil(outerDiameter / 2) + 16;
  const containerW     = outerDiameter + 8;

  const activeHeading = signals?.heading ?? manualHeading;
  const hasLiveHeading = signals?.heading != null;
  const hasLiveLocation = signals?.lat != null && signals?.lon != null;

  function clampZoom(z: number) {
    return Math.max(0.7, Math.min(2.4, z));
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

      {/* ── GLOBAL CLOCK BAR ─────────────────────────────────────────────── */}
      <div className="cp-clock-bar">
        <div className="cp-clock-time">{hh}<span className="cp-clock-colon">:</span>{mm}<span className="cp-clock-colon">:</span>{ss}</div>
        <div className="cp-clock-meta">
          {cycles
            ? `${cycles.gregorian.weekday}, ${cycles.gregorian.month} ${cycles.gregorian.day} ${cycles.gregorian.year}  ·  W${cycles.gregorian.weekOfYear}  ·  D${cycles.gregorian.dayOfYear}`
            : "Loading…"}
        </div>
      </div>

      <div className="cp-layout">

        {/* ═══ LEFT COLUMN ═══════════════════════════════════════════════════ */}
        <div className="cp-col-left">

          {/* ── Sky Map + Compass ────────────────────────────────────────── */}
          <section className="cp-card cp-sky-card">
            <div className="cp-card-head">
              <h2 className="cp-card-title">Sky Map</h2>
              <button className="cp-btn cp-btn-sm" onClick={captureSensors} disabled={sigLoading}>
                {sigLoading ? "…" : "📍 Locate Me"}
              </button>
            </div>

            {/* Sky map SVG (rectangle above wheels) */}
            <SkyMapSVG
              lat={signals?.lat ?? 36.1627}
              lon={signals?.lon ?? -86.7816}
              heading={activeHeading}
              minuteKey={minuteKey}
            />

            {/* Compass row */}
            <div className="cp-compass-row">
              <CompassRose heading={activeHeading}/>
              <div className="cp-compass-controls">
                {signals?.heading != null ? (
                  <p className="cp-muted">↗ Live heading: {signals.heading.toFixed(1)}°</p>
                ) : (
                  <label className="cp-dir-label">
                    <span>Direction</span>
                    <input
                      type="range" min={0} max={359} value={manualHeading}
                      onChange={e => setManualHeading(Number(e.target.value))}
                      className="cp-dir-range"
                    />
                    <span>{manualHeading}°</span>
                  </label>
                )}
                {!hasLiveHeading && <p className="cp-muted">Desktop fallback active: facing South by default (180°).</p>}
                {signals?.lat != null && (
                  <p className="cp-muted">{signals.lat.toFixed(3)}°, {signals.lon?.toFixed(3)}°</p>
                )}
                {!hasLiveLocation && <p className="cp-muted">Location fallback active. Auto-refreshing every 1 minute.</p>}
                {signals?.network && (
                  <p className="cp-muted">Network: {signals.network}</p>
                )}
              </div>
            </div>
          </section>

          {/* ── Cycle Wheels ─────────────────────────────────────────────── */}
          <section className="cp-card cp-wheel-card">
            <div className="cp-card-head">
              <h2 className="cp-card-title">Cycle Wheels</h2>
              <div className="cp-wheel-controls">
                <button className="cp-btn cp-btn-sm" onClick={() => setWheelZoom(z => clampZoom(z - 0.12))}>−</button>
                <button className="cp-btn cp-btn-sm" onClick={() => setWheelZoom(1)}>100%</button>
                <button className="cp-btn cp-btn-sm" onClick={() => setWheelZoom(z => clampZoom(z + 0.12))}>+</button>
                <button className="cp-btn cp-btn-sm"
                  onClick={() => loadCycles(signals?.lat ?? undefined, signals?.lon ?? undefined)}>↺</button>
              </div>
            </div>

            <p className="cp-muted" style={{ fontSize: "0.74rem", marginBottom: "0.38rem" }}>
              Pinch on touch devices or Ctrl+wheel on desktop to zoom rings ({Math.round(wheelZoom * 100)}%).
            </p>

            {/* Semicircle container */}
            <div className="cp-wheel-viewport" onWheel={onWheelZoom} onTouchStart={onTouchStartZoom} onTouchMove={onTouchMoveZoom} onTouchEnd={onTouchEndZoom}>
              <div
                className="cp-semicircle"
                style={{ height: containerH, maxWidth: containerW, transform: `scale(${wheelZoom})` }}
              >
                {/* Clock rings — CSS animated (no JS re-render) */}
                {clockOffsets && CLOCK_RINGS.map((cr, i) => (
                  <WheelRing
                    key={cr.id}
                    size={RING_BASE + i * RING_STEP}
                    color={cr.color}
                    periodS={cr.periodS}
                    offsetS={clockOffsets[cr.id as keyof typeof clockOffsets]}
                  />
                ))}

                {/* Weather ring */}
                {weatherRing && (
                  <WheelRing
                    key="weather"
                    size={RING_BASE + clockCount * RING_STEP}
                    color="#22d3ee"
                    angleDeg={0}
                  />
                )}

                {/* Calendar rings */}
                {calendarWheels.map((w, i) => (
                  <WheelRing
                    key={w.id}
                    size={RING_BASE + (clockCount + (weatherRing ? 1 : 0) + i) * RING_STEP}
                    color={w.color}
                    angleDeg={w.angleDeg}
                    icon={w.icon}
                    value={compactWheelValue(w)}
                    name={w.name}
                    fullLabel={w.label}
                    active={hoverRing === w.id}
                    onHover={(on) => setHoverRing(on ? w.id : null)}
                  />
                ))}
              </div>
            </div>

            {/* Ring legend */}
            <div className="cp-ring-legend">
              {CLOCK_RINGS.map(cr => (
                <span key={cr.id} className="cp-rl-item">
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

            {/* Quick values */}
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

            {/* Spectrum */}
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
        </div>

        {/* ═══ RIGHT COLUMN ══════════════════════════════════════════════════ */}
        <div className="cp-col-right">

          {/* ── Research Console ─────────────────────────────────────────── */}
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

          {/* ── Research Output ───────────────────────────────────────────── */}
          {res && (
            <section className="cp-card cp-research-out">
              <div className="cp-card-head">
                <h2 className="cp-card-title">Output</h2>
                {res.complete && <span className="cp-badge-ok">Done</span>}
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
                  <p className="cp-label">AI Peer Review</p>
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
      </div>
    </main>
  );
}
