"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CycleReading } from "../../lib/worldCycles";
import {
  cancelHaptic,
  hapticsMuted,
  installHapticLifecycle,
  muteHaptics,
  pulseHaptic,
  unmuteHaptics,
  type HapticKind,
} from "../../lib/haptics";
import { claimMarkClass, streetMoonLine } from "./onyxCopy";
import { OnyxCrystal } from "./OnyxCrystal";

const REST = 3;
const QUIET = 37;
/** Street → Moment → Self. Scroll up from Street opens the live sky. */
const MAX = 2;
const HINTS = [
  { c: "tilt the crystal", d: "↑ sky · ↓ you · → clock · ← cast" },
  { c: "tilt the crystal", d: "↑ sky · ↓ you · → clock · ← cast" },
  { c: "", d: "swipe up to return" },
] as const;

type CompassAim = "up" | "down" | "left" | "right" | null;
const COMPASS_LOCK_PX = 10;
const COMPASS_AIM_PX = 42;
const COMPASS_FOLLOW_MAX = 28;

export type HeldCastChip = {
  id: string;
  label: string;
  names: string[];
  spreadLabel?: string;
};

export type ReadingLayerChip = {
  id: "moment" | "through-you" | "with-drawn";
  label: string;
};

export type OnyxHomeProps = {
  now: Date;
  phaseFraction: number;
  zodiacSign: string;
  /** Distilled sentence for the active reading layer. */
  momentLine: string;
  /** Active layer label — names exactly what's folded in. */
  readingLayerLabel?: string;
  /** Available layers for one-tap switch (Layer 0 always first). */
  readingLayers?: ReadingLayerChip[];
  activeLayerId?: ReadingLayerChip["id"];
  onSelectLayer?: (id: ReadingLayerChip["id"]) => void;
  selfTone: React.ReactNode;
  selfRet: React.ReactNode;
  calendarReadings: CycleReading[];
  /** Land calendar of place (e.g. Cherokee moon) — calendar framing, never personality. */
  landCalendarLine?: string | null;
  /** Land acknowledgment at the location fix — first-class, not a footnote. */
  landAcknowledgment?: { text: string; people: string; pointTo?: string } | null;
  /** Embraced casts — labeled strip; folds into with-drawn when that layer is active. */
  heldCasts?: HeldCastChip[];
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
  zodiacSign,
  momentLine,
  readingLayerLabel,
  readingLayers = [],
  activeLayerId = "moment",
  onSelectLayer,
  selfTone,
  selfRet,
  calendarReadings,
  landCalendarLine,
  landAcknowledgment,
  heldCasts = [],
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
  const [compassLocked, setCompassLocked] = useState(false);
  const [compassAim, setCompassAim] = useState<CompassAim>(null);
  const [compassNeedle, setCompassNeedle] = useState(0);
  const [compassFollow, setCompassFollow] = useState({ x: 0, y: 0 });
  const deviceRef = useRef<HTMLDivElement>(null);
  const depthRef = useRef(0);
  depthRef.current = depth;
  const wheelLock = useRef(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);
  const stoneXRef = useRef(pulseEnabled ? REST : QUIET);
  const hapticRef = useRef(pulseEnabled);
  const lastSec = useRef(-1);
  const onPulseRef = useRef(onPulseEnabledChange);
  onPulseRef.current = onPulseEnabledChange;
  const compassPtr = useRef<{ id: number; x0: number; y0: number; armed: boolean } | null>(null);
  const compassAimRef = useRef<CompassAim>(null);

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
    // App backgrounded / closing — never start a new buzz.
    if (hapticsMuted()) return;
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
        buzz(nd === MAX ? "deep" : "step");
        return nd;
      });
    },
    [buzz],
  );

  /** Depth step that never reads a stale `depth` from the event closure. */
  const goDelta = useCallback(
    (delta: number) => {
      const prev = depthRef.current;
      // Street + swipe/scroll up → live sky (sync call keeps iOS gesture for sensors).
      if (prev === 0 && delta < 0) {
        buzz("step");
        onOpenSky();
        return;
      }
      const nd = Math.max(0, Math.min(MAX, prev + delta));
      if (nd === prev) return;
      buzz(nd === MAX ? "deep" : "step");
      setDepth(nd);
    },
    [buzz, onOpenSky],
  );

  // Own rAF clock — don't depend on parent `now` cadence for the felt second.
  // Pauses hard when the app is backgrounded so close/swipe-away never buzzes.
  useEffect(() => {
    installHapticLifecycle();
    let raf = 0;
    let alive = true;

    const onHide = () => {
      muteHaptics();
      cancelHaptic();
    };
    const onShow = () => {
      if (document.visibilityState === "visible") unmuteHaptics();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") onHide();
      else onShow();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("blur", onHide);
    window.addEventListener("focus", onShow);

    const loop = () => {
      if (!alive) return;
      if (document.visibilityState !== "hidden" && !hapticsMuted()) {
        const s = new Date().getSeconds();
        if (s !== lastSec.current) {
          lastSec.current = s;
          if (s === 0) buzz("minute");
          else buzz("second");
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      cancelHaptic();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("blur", onHide);
      window.removeEventListener("focus", onShow);
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
    // NOW / clock depth: let the panel scroll instead of stealing the wheel for depth.
    if (depthRef.current === 1) {
      const panel = deviceRef.current?.querySelector(".onyx-p2") as HTMLElement | null;
      if (panel && panel.scrollHeight > panel.clientHeight + 2) {
        const atTop = panel.scrollTop <= 0;
        const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2;
        if (!(atTop && e.deltaY < 0) && !(atBottom && e.deltaY > 0)) {
          return;
        }
      }
    }
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

  const resolveCompassAim = (dx: number, dy: number): CompassAim => {
    const dist = Math.hypot(dx, dy);
    if (dist < COMPASS_AIM_PX) return null;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "down" : "up";
  };

  const commitCompassAim = useCallback(
    (aim: CompassAim) => {
      if (!aim) return;
      buzz("step");
      if (aim === "up") onOpenSky();
      else if (aim === "down") {
        if (onOpenYou) onOpenYou();
        else go(MAX);
      } else if (aim === "right") onOpenRings();
      else if (aim === "left") {
        if (onOpenCast) onOpenCast();
        else onOpenTools();
      }
    },
    [buzz, go, onOpenCast, onOpenRings, onOpenSky, onOpenTools, onOpenYou],
  );

  const resetCompass = useCallback(() => {
    compassPtr.current = null;
    compassAimRef.current = null;
    setCompassLocked(false);
    setCompassAim(null);
    setCompassFollow({ x: 0, y: 0 });
    setCompassNeedle(depthRef.current * 22);
  }, []);

  const onCompassPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    compassPtr.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, armed: false };
    compassAimRef.current = null;
    setCompassLocked(true);
    setCompassAim(null);
    setCompassFollow({ x: 0, y: 0 });
    buzz("tick");
  };

  const onCompassPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ptr = compassPtr.current;
    if (!ptr || ptr.id !== e.pointerId) return;
    e.stopPropagation();
    const dx = e.clientX - ptr.x0;
    const dy = e.clientY - ptr.y0;
    const dist = Math.hypot(dx, dy);
    if (!ptr.armed && dist >= COMPASS_LOCK_PX) ptr.armed = true;

    const clamp = (v: number) => Math.max(-COMPASS_FOLLOW_MAX, Math.min(COMPASS_FOLLOW_MAX, v));
    setCompassFollow({ x: clamp(dx), y: clamp(dy) });

    if (dist > 2) {
      // Needle SVG points up; atan2(dx, -dy) → 0° when dragging up.
      const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      setCompassNeedle(deg);
    }

    const aim = resolveCompassAim(dx, dy);
    if (aim !== compassAimRef.current) {
      compassAimRef.current = aim;
      setCompassAim(aim);
      if (aim) buzz("tick");
    }
  };

  const onCompassPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ptr = compassPtr.current;
    if (!ptr || ptr.id !== e.pointerId) return;
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    const dx = e.clientX - ptr.x0;
    const dy = e.clientY - ptr.y0;
    const aim = resolveCompassAim(dx, dy);
    const wasTap = Math.hypot(dx, dy) < COMPASS_LOCK_PX;
    resetCompass();
    if (aim) commitCompassAim(aim);
    else if (wasTap) {
      // Light tap still opens the sky from Street.
      if (depthRef.current === 0) {
        buzz("step");
        onOpenSky();
      }
    }
  };

  const swipeTargetIgnored = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el?.closest) return false;
    // Clock / NOW panel owns vertical gestures for scrolling on phones.
    if (depthRef.current === 1 && el.closest(".onyx-p2")) return true;
    return Boolean(
      el.closest(
        ".onyx-stone-track, .onyx-compass, .onyx-row, .onyx-rx, .onyx-why, .onyx-side-doors, .onyx-rung, input, textarea, a",
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
          <OnyxCrystal />
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
          {[0, 1, 2].map(r => (
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
            {readingLayerLabel && (
              <p className="onyx-layer-label">{readingLayerLabel}</p>
            )}
            <p className="big">{momentLine}</p>
            <p className="sub">
              The moon is {moon.verb}, {moon.detail} Lift your phone to the sky.
            </p>
            {readingLayers.length > 1 && (
              <div className="onyx-layers">
                <p className="onyx-held-eyebrow">How to read</p>
                <div className="onyx-held-row">
                  {readingLayers.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      className={`onyx-layer-chip${activeLayerId === l.id ? " on" : ""}`}
                      onClick={e => {
                        e.stopPropagation();
                        buzz("tick");
                        onSelectLayer?.(l.id);
                      }}
                    >
                      {l.id === "moment"
                        ? "The moment"
                        : l.id === "through-you"
                          ? "Through you"
                          : "What you drew"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {heldCasts.length > 0 && (
              <div className="onyx-held">
                <p className="onyx-held-eyebrow">Held · embraced cast</p>
                <div className="onyx-held-row">
                  {heldCasts.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      className="onyx-held-chip"
                      onClick={e => {
                        e.stopPropagation();
                        buzz("tick");
                        onOpenCast?.();
                      }}
                    >
                      <b>{h.label}</b>
                      {" · "}
                      {h.names.slice(0, 2).join(" · ")}
                      {h.names.length > 2 ? "…" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 1 MOMENT */}
        <div className={`onyx-panel onyx-p2${depth === 1 ? " show" : ""}`}>
          <p className="onyx-eyebrow" style={{ alignSelf: "flex-start", marginBottom: 0 }}>
            NOW
          </p>
          {readingLayerLabel && (
            <p className="onyx-layer-label" style={{ alignSelf: "flex-start" }}>
              {readingLayerLabel}
            </p>
          )}
          {readingLayers.length > 1 && (
            <div className="onyx-layers">
              <div className="onyx-held-row">
                {readingLayers.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    className={`onyx-layer-chip${activeLayerId === l.id ? " on" : ""}`}
                    onClick={e => {
                      e.stopPropagation();
                      buzz("tick");
                      onSelectLayer?.(l.id);
                    }}
                  >
                    {l.id === "moment"
                      ? "The moment"
                      : l.id === "through-you"
                        ? "Through you"
                        : "What you drew"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {landAcknowledgment && (
            <p className="onyx-land-ack" style={{ alignSelf: "flex-start", width: "100%" }}>
              {landAcknowledgment.text}
              {landAcknowledgment.pointTo && (
                <>
                  {" "}
                  <a
                    href={landAcknowledgment.pointTo}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                  >
                    Learn more
                  </a>
                </>
              )}
            </p>
          )}
          {landCalendarLine && (
            <p className="onyx-land-cal" style={{ alignSelf: "flex-start", width: "100%" }}>
              {landCalendarLine}
            </p>
          )}
          <p className="now">{momentLine}</p>
          {heldCasts.length > 0 && (
            <div className="onyx-held">
              <p className="onyx-held-eyebrow">Held · not the sky clock</p>
              <div className="onyx-held-row">
                {heldCasts.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    className="onyx-held-chip"
                    onClick={e => {
                      e.stopPropagation();
                      buzz("tick");
                      onOpenCast?.();
                    }}
                  >
                    <b>{h.label}</b>
                    {" · "}
                    {h.names.slice(0, 2).join(" · ")}
                    {h.names.length > 2 ? "…" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
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

        {/* 2 SELF */}
        <div className={`onyx-panel onyx-p3${depth === 2 ? " show" : ""}`}>
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

        <div className={`onyx-compass-wrap${compassLocked ? " holding" : ""}`}>
          <span className="onyx-chint" style={{ opacity: HINTS[depth].c && !compassLocked ? 1 : 0 }}>
            {HINTS[depth].c}
          </span>
          <div className="onyx-compass-stage">
            <div className="onyx-compass-dirs" aria-hidden>
              <span className={`d-up${compassAim === "up" ? " on" : ""}`}>sky</span>
              <span className={`d-left${compassAim === "left" ? " on" : ""}`}>cast</span>
              <span className={`d-right${compassAim === "right" ? " on" : ""}`}>clock</span>
              <span className={`d-down${compassAim === "down" ? " on" : ""}`}>you</span>
            </div>
            <button
              type="button"
              className={`onyx-compass${compassLocked ? " locked" : " floating"}${compassAim ? " aiming" : ""}`}
              style={
                {
                  ["--onyx-compass-x" as string]: `${compassFollow.x}px`,
                  ["--onyx-compass-y" as string]: `${compassFollow.y}px`,
                } as React.CSSProperties
              }
              aria-label="Hold and drag: up sky, down you, right clock, left cast"
              onPointerDown={onCompassPointerDown}
              onPointerMove={onCompassPointerMove}
              onPointerUp={onCompassPointerUp}
              onPointerCancel={e => {
                e.stopPropagation();
                resetCompass();
              }}
            >
              <svg width="118" height="118" viewBox="0 0 62 62" role="img" aria-label="Compass">
                <polygon
                  points="31,3 47,11 55,31 47,51 31,59 15,51 7,31 15,11"
                  fill="rgba(120,108,200,0.05)"
                  stroke="var(--onyx-edge-bright)"
                  strokeWidth="0.75"
                />
                <circle cx="31" cy="31" r="18" fill="none" stroke="#2c2942" strokeWidth="0.5" />
                <g
                  className="needle"
                  style={{ transform: `rotate(${compassLocked ? compassNeedle : depth * 22}deg)` }}
                >
                  <path d="M31 15 L35 33 L31 29 L27 33 Z" fill="var(--onyx-core)" />
                </g>
                <circle cx="31" cy="31" r="1.7" fill="#d8d2ff" />
              </svg>
            </button>
          </div>
        </div>

        <p className="onyx-descend" style={{ opacity: compassLocked ? 0.35 : 1 }}>
          {HINTS[depth].d}
        </p>
      </div>
    </div>
  );
}
