"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CycleReading } from "../../lib/worldCycles";
import { cancelHaptic, pulseHaptic, type HapticKind } from "../../lib/haptics";
import { claimMarkClass, streetMoonLine } from "./onyxCopy";

const REST = 3;
const QUIET = 37;
const MAX = 3;
const HINTS = [
  { c: "tap to tune in", d: "swipe down to go deeper ↓" },
  { c: "tap to look closer", d: "swipe down to go deeper ↓" },
  { c: "", d: "swipe down to go deeper ↓" },
  { c: "", d: "" },
] as const;

function MoonSvg() {
  return (
    <svg viewBox="0 0 150 150" fill="none" role="img" aria-label="Moon">
      <defs>
        <radialGradient id="onyx-mn" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#c9c0ff" stopOpacity={0.95} />
          <stop offset="55%" stopColor="#8a7bff" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#3a2f8f" stopOpacity={0.6} />
        </radialGradient>
        <linearGradient id="onyx-fc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b3a6ff" stopOpacity={0.7} />
          <stop offset="50%" stopColor="#4b4570" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#8a7bff" stopOpacity={0.52} />
        </linearGradient>
      </defs>
      <polygon
        points="75,12 123,41 123,109 75,138 27,109 27,41"
        fill="rgba(120,108,200,0.035)"
        stroke="url(#onyx-fc)"
        strokeWidth="1"
      />
      <circle cx="75" cy="75" r="25" fill="none" stroke="#8a7bff" strokeWidth="0.5" strokeOpacity={0.5} />
      <path d="M75 52 a23 23 0 0 1 0 46 a17 26 0 0 0 0 -46" fill="url(#onyx-mn)" />
      <circle cx="66" cy="64" r="5" fill="#d8d2ff" fillOpacity={0.4} />
    </svg>
  );
}

export type OnyxHomeProps = {
  now: Date;
  phaseFraction: number;
  moonAltDeg: number | null;
  zodiacSign: string;
  /** Distilled moment-chord sentence (computed-only). */
  momentLine: string;
  selfTone: React.ReactNode;
  selfRet: React.ReactNode;
  calendarReadings: CycleReading[];
  /** Land calendar of place (e.g. Cherokee moon) — calendar framing, never personality. */
  landCalendarLine?: string | null;
  onOpenSky: () => void;
  onOpenRings: () => void;
  onOpenTools: () => void;
  onOpenWhy?: () => void;
  onOpenYou?: () => void;
  onOpenCast?: () => void;
  /** Stone switch: sound + haptic pulse master. */
  pulseEnabled?: boolean;
  onPulseEnabledChange?: (on: boolean) => void;
};

export function OnyxHome({
  now,
  phaseFraction,
  moonAltDeg,
  zodiacSign,
  momentLine,
  selfTone,
  selfRet,
  calendarReadings,
  landCalendarLine,
  onOpenSky,
  onOpenRings,
  onOpenTools,
  onOpenWhy,
  onOpenYou,
  onOpenCast,
  pulseEnabled = true,
  onPulseEnabledChange,
}: OnyxHomeProps) {
  const [depth, setDepth] = useState(0);
  const [datesOpen, setDatesOpen] = useState(false);
  const [pulseAnim, setPulseAnim] = useState<"none" | "beat" | "chime">("none");
  const [hapticOn, setHapticOn] = useState(pulseEnabled);
  const [stoneX, setStoneX] = useState(pulseEnabled ? REST : QUIET);
  const deviceRef = useRef<HTMLDivElement>(null);
  const wheelLock = useRef(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);
  const stoneXRef = useRef(pulseEnabled ? REST : QUIET);
  const hapticRef = useRef(pulseEnabled);
  const lastSec = useRef(-1);
  const onPulseRef = useRef(onPulseEnabledChange);
  onPulseRef.current = onPulseEnabledChange;

  // Keep stone in sync if parent toggles pulse (e.g. after splash unlock).
  useEffect(() => {
    if (dragging.current) return;
    hapticRef.current = pulseEnabled;
    setHapticOn(pulseEnabled);
    const x = pulseEnabled ? REST : QUIET;
    stoneXRef.current = x;
    setStoneX(x);
  }, [pulseEnabled]);

  const stars = useMemo(
    () =>
      Array.from({ length: 130 }, (_, i) => {
        const top = Math.pow(((i * 17) % 100) / 100, 1.5) * 100;
        const left = (i * 37) % 100;
        const s = i % 8 === 0 ? 1.2 + (i % 3) * 0.4 : 0.4 + (i % 5) * 0.15;
        const o = 0.22 + (i % 6) * 0.08;
        return { top, left, s, o, tw: 3 + (i % 5), d: (i % 5) * 0.7, key: i };
      }),
    [],
  );

  const moon = streetMoonLine(phaseFraction);
  const eyebrow = now
    .toLocaleString([], {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
    })
    .toUpperCase()
    .replace(",", " ·");
  const clockLabel = now.toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const sec = String(now.getSeconds()).padStart(2, "0");

  const buzz = useCallback((kind: HapticKind) => {
    const on = hapticRef.current;
    // When quiet: skip clock pulses; allow confirmation tick when re-enabling.
    if (!on && (kind === "second" || kind === "minute" || kind === "step" || kind === "deep")) {
      return;
    }
    void pulseHaptic(kind);
    if (kind === "step" || kind === "second") {
      setPulseAnim("none");
      requestAnimationFrame(() => setPulseAnim("beat"));
    } else if (kind === "deep" || kind === "minute") {
      setPulseAnim("none");
      requestAnimationFrame(() => setPulseAnim("chime"));
    }
  }, []);

  const go = useCallback(
    (d: number) => {
      const nd = Math.max(0, Math.min(MAX, d));
      setDepth(prev => {
        if (nd === prev) return prev;
        buzz(nd === 3 ? "deep" : "step");
        return nd;
      });
    },
    [buzz],
  );

  /** Depth step that never reads a stale `depth` from the event closure. */
  const goDelta = useCallback(
    (delta: number) => {
      setDepth(prev => {
        const nd = Math.max(0, Math.min(MAX, prev + delta));
        if (nd === prev) return prev;
        buzz(nd === 3 ? "deep" : "step");
        return nd;
      });
    },
    [buzz],
  );

  // Own rAF clock — don't depend on parent `now` cadence for the felt second.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = new Date().getSeconds();
      if (s !== lastSec.current) {
        lastSec.current = s;
        if (s === 0) buzz("minute");
        else buzz("second");
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cancelHaptic();
    };
  }, [buzz]);

  useEffect(() => {
    if (pulseAnim === "none") return;
    const t = window.setTimeout(() => setPulseAnim("none"), pulseAnim === "chime" ? 2400 : 1000);
    return () => clearTimeout(t);
  }, [pulseAnim]);

  const setPulse = useCallback((enabled: boolean, announce: boolean) => {
    hapticRef.current = enabled;
    setHapticOn(enabled);
    const x = enabled ? REST : QUIET;
    stoneXRef.current = x;
    setStoneX(x);
    onPulseRef.current?.(enabled);
    if (announce && enabled) void pulseHaptic("tick");
  }, []);

  const applyStone = useCallback(
    (x: number) => {
      const clamped = Math.max(REST, Math.min(QUIET, x));
      stoneXRef.current = clamped;
      setStoneX(clamped);
      const nowQuiet = clamped > (REST + QUIET) / 2;
      const enabled = !nowQuiet;
      if (enabled !== hapticRef.current) {
        hapticRef.current = enabled;
        setHapticOn(enabled);
        onPulseRef.current?.(enabled);
        if (enabled) void pulseHaptic("tick");
      }
    },
    [],
  );

  const endStone = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (!moved.current) {
      // Tap flips on/off.
      setPulse(!hapticRef.current, true);
    } else {
      // Snap to the side the drag landed on.
      setPulse(hapticRef.current, false);
    }
  }, [setPulse]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      moved.current = true;
      applyStone(e.clientX - startX.current);
    };
    const up = () => endStone();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [applyStone, endStone]);

  const onWheel = (e: React.WheelEvent) => {
    if (wheelLock.current) return;
    wheelLock.current = true;
    window.setTimeout(() => {
      wheelLock.current = false;
    }, 700);
    e.preventDefault();
    goDelta(e.deltaY > 0 ? 1 : -1);
  };

  const swipeY0 = useRef<number | null>(null);
  const swipeIgnore = useRef(false);

  const swipeTargetIgnored = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el?.closest) return false;
    return Boolean(
      el.closest(
        ".onyx-stone-track, .onyx-row, .onyx-rx, .onyx-why, .onyx-side-doors, .onyx-rung, input, textarea, a",
      ),
    );
  };

  const onPointerDownSwipe = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (swipeTargetIgnored(e.target)) {
      swipeIgnore.current = true;
      swipeY0.current = null;
      return;
    }
    swipeIgnore.current = false;
    swipeY0.current = e.clientY;
  };

  const onPointerUpSwipe = (e: React.PointerEvent) => {
    if (swipeIgnore.current || swipeY0.current == null) {
      swipeIgnore.current = false;
      swipeY0.current = null;
      return;
    }
    const dy = e.clientY - swipeY0.current;
    swipeY0.current = null;
    if (Math.abs(dy) < 55) return;
    // Finger/mouse moves down → go deeper (same as the reference HTML).
    goDelta(dy > 0 ? 1 : -1);
  };

  const moonAltLabel =
    moonAltDeg != null && Number.isFinite(moonAltDeg)
      ? `${Math.round(moonAltDeg)}° above the horizon`
      : "below the horizon";

  return (
    <div className="onyx-root onyx-home-fade">
      <div
        ref={deviceRef}
        className="onyx-device"
        data-depth={depth}
        role="application"
        aria-label="Delphi"
        onWheel={onWheel}
        onPointerDown={onPointerDownSwipe}
        onPointerUp={onPointerUpSwipe}
        onPointerCancel={() => {
          swipeY0.current = null;
          swipeIgnore.current = false;
        }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") goDelta(1);
          if (e.key === "ArrowUp") goDelta(-1);
        }}
        tabIndex={0}
      >
        <div className="onyx-field">
          <div className="onyx-aura" />
          <div className="onyx-stars">
            {stars.map(s => (
              <span
                key={s.key}
                className="onyx-dust"
                style={{
                  top: `${s.top}%`,
                  left: `${s.left}%`,
                  width: s.s,
                  height: s.s,
                  ["--o" as string]: s.o,
                  ["--tw" as string]: `${s.tw}s`,
                  ["--d" as string]: `${s.d}s`,
                }}
              />
            ))}
          </div>
          <div className="onyx-moon">
            <MoonSvg />
          </div>
        </div>

        <div className="onyx-vignette" />
        <div className={`onyx-pulse-ring${pulseAnim === "beat" ? " beat" : ""}${pulseAnim === "chime" ? " chime" : ""}`} />

        <p className="onyx-wordmark">DELPHI</p>
        <p className="onyx-clock">
          {clockLabel.toUpperCase().replace(",", " ·")}:
          <span className="sec">{sec}</span>
        </p>

        <div
          className={`onyx-stone-track${!hapticOn ? " quiet" : ""}`}
          role="switch"
          aria-checked={hapticOn}
          aria-label="Slide the stone to quiet sound and pulse"
          tabIndex={0}
          onPointerDown={e => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            moved.current = false;
            startX.current = e.clientX - stoneXRef.current;
          }}
          onPointerMove={e => {
            if (!dragging.current) return;
            moved.current = true;
            applyStone(e.clientX - startX.current);
          }}
          onPointerUp={e => {
            e.stopPropagation();
            endStone();
          }}
          onPointerCancel={endStone}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setPulse(!hapticOn, true);
            }
          }}
        >
          <span className="onyx-groove-on" />
          <span className="onyx-groove-off" />
          <span className="onyx-stone" style={{ left: stoneX, transition: dragging.current ? "none" : undefined }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <polygon
                points="9,1 15,4.5 15,13.5 9,17 3,13.5 3,4.5"
                fill="#0b0a12"
                stroke="var(--onyx-edge-bright)"
                strokeWidth="0.6"
              />
              <polygon
                points="9,4 12.5,6 12.5,12 9,14 5.5,12 5.5,6"
                fill="none"
                stroke="rgba(140,124,255,0.3)"
                strokeWidth="0.4"
              />
              <circle cx="9" cy="9" r="1.6" fill="var(--onyx-core)" fillOpacity={0.75} />
            </svg>
          </span>
        </div>

        <div className="onyx-ladder" aria-hidden>
          {[0, 1, 2, 3].map(r => (
            <button
              key={r}
              type="button"
              className={`onyx-rung${depth === r ? " on" : ""}`}
              onClick={() => go(r)}
              aria-label={`Depth ${r}`}
            />
          ))}
        </div>

        {/* 0 STREET */}
        <div className={`onyx-panel onyx-p0${depth === 0 ? " show" : ""}`}>
          <div className="onyx-center">
            <p className="onyx-eyebrow">{eyebrow}</p>
            <p className="big">{momentLine}</p>
            <p className="sub">
              The moon is {moon.verb}, {moon.detail} Lift your phone to the sky.
            </p>
          </div>
        </div>

        {/* 1 SKY TEASER */}
        <div className={`onyx-panel onyx-p1${depth === 1 ? " show" : ""}`}>
          <div className="onyx-center">
            <p className="name">Moon</p>
            <p className="det">
              {moon.phaseName.toLowerCase()} · {moonAltLabel}
            </p>
            <button type="button" className="tap" onClick={onOpenSky}>
              tap to look closer
            </button>
          </div>
        </div>

        {/* 2 MOMENT */}
        <div className={`onyx-panel onyx-p2${depth === 2 ? " show" : ""}`}>
          <p className="onyx-eyebrow" style={{ alignSelf: "flex-start", marginBottom: 0 }}>
            NOW
          </p>
          {landCalendarLine && (
            <p className="onyx-land-cal" style={{ alignSelf: "flex-start", width: "100%" }}>
              {landCalendarLine}
            </p>
          )}
          <p className="now">{momentLine}</p>
          {onOpenWhy && (
            <button
              type="button"
              className="onyx-why"
              onClick={e => {
                e.stopPropagation();
                buzz("tick");
                onOpenWhy();
              }}
            >
              tap to see why
            </button>
          )}
          <hr className="onyx-seam" />
          <div className="onyx-rows">
            <button
              type="button"
              className="onyx-row"
              aria-expanded={datesOpen}
              onClick={e => {
                e.stopPropagation();
                setDatesOpen(v => !v);
                buzz("tick");
              }}
            >
              <span>Today, according to whom</span>
              <span className="onyx-row-r">
                {calendarReadings.length || 0} counts {datesOpen ? "▴" : "▾"}
              </span>
            </button>
            <div className={`onyx-rx${datesOpen ? " open" : ""}`}>
              <div className="onyx-rx-in">
                {calendarReadings.map(r => (
                  <div className="onyx-cl" key={r.systemId}>
                    <span>
                      <span className={`onyx-mk ${claimMarkClass(r.claim)}`} />
                      {r.primary}
                      {r.secondary ? ` · ${r.secondary}` : ""}
                    </span>
                    <span className="sys">{r.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="onyx-row"
              onClick={() => {
                buzz("tick");
                onOpenRings();
              }}
            >
              <span>The rings</span>
              <span className="onyx-row-r">open wheel ▾</span>
            </button>
            <button
              type="button"
              className="onyx-row"
              onClick={() => {
                buzz("tick");
                onOpenTools();
              }}
            >
              <span>Atlas, senses & oracle</span>
              <span className="onyx-row-r">✦</span>
            </button>
          </div>
          <p className="onyx-prov">
            <b>Position measured to the arcminute.</b> {zodiacSign} is a Hellenistic reading — one of
            several a sky can be given.
          </p>
        </div>

        {/* 3 SELF */}
        <div className={`onyx-panel onyx-p3${depth === 3 ? " show" : ""}`}>
          <div className="onyx-center">
            <div className="glyph">
              <svg width="192" height="192" viewBox="0 0 64 64" fill="none" role="img" aria-label="Your tone">
                <polygon
                  points="32,4 56,18 56,46 32,60 8,46 8,18"
                  fill="none"
                  stroke="var(--onyx-edge-bright)"
                  strokeWidth="0.75"
                />
                <circle cx="32" cy="32" r="13" fill="none" stroke="var(--onyx-light)" strokeWidth="0.5" strokeOpacity={0.7} />
                <circle cx="32" cy="32" r="4" fill="var(--onyx-core)" fillOpacity={0.85} />
              </svg>
            </div>
            <p className="te">YOUR TONE, THIS MOMENT</p>
            <p className="tone">{selfTone}</p>
            <p className="ret">{selfRet}</p>
            <div className="onyx-side-doors">
              {onOpenYou && (
                <button
                  type="button"
                  className="onyx-ghost-btn"
                  onClick={() => {
                    buzz("tick");
                    onOpenYou();
                  }}
                >
                  You · natal (local)
                </button>
              )}
              {onOpenCast && (
                <button
                  type="button"
                  className="onyx-ghost-btn"
                  onClick={() => {
                    buzz("tick");
                    onOpenCast();
                  }}
                >
                  Cast · side door
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="onyx-compass-wrap">
          <span className="onyx-chint" style={{ opacity: HINTS[depth].c ? 1 : 0 }}>
            {HINTS[depth].c}
          </span>
          <button
            type="button"
            className="onyx-compass"
            aria-label="Descend"
            onClick={() => {
              if (depth === 1) onOpenSky();
              else go(depth + 1);
            }}
          >
            <svg width="186" height="186" viewBox="0 0 62 62" role="img" aria-label="Compass">
              <polygon
                points="31,3 47,11 55,31 47,51 31,59 15,51 7,31 15,11"
                fill="rgba(120,108,200,0.05)"
                stroke="var(--onyx-edge-bright)"
                strokeWidth="0.75"
              />
              <circle cx="31" cy="31" r="18" fill="none" stroke="#2c2942" strokeWidth="0.5" />
              <g className="needle" style={{ transform: `rotate(${depth * 22}deg)` }}>
                <path d="M31 15 L35 33 L31 29 L27 33 Z" fill="var(--onyx-core)" />
              </g>
              <circle cx="31" cy="31" r="1.7" fill="#d8d2ff" />
            </svg>
          </button>
        </div>

        <p className="onyx-descend">{HINTS[depth].d}</p>
      </div>
    </div>
  );
}
