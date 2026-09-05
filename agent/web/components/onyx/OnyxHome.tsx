"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { claimMarkClass } from "./onyxCopy";
import { OnyxCrystal } from "./OnyxCrystal";
import { OnyxPhaseMoon } from "./OnyxPhaseMoon";
import { OnyxStarfield } from "./OnyxStarfield";
import { OnyxAudioStone } from "./OnyxAudioStone";
import { OnyxDistillSheet } from "./OnyxDistillSheet";
import { destinationsFor, OnyxShareSheet, type ShareDest } from "./OnyxShareSheet";
import { OnyxCompassRose } from "./OnyxCompassRose";
import { OnyxYinYang } from "./OnyxYinYang";
import type { BrainAvailability, DistillPrefs } from "../../lib/lore/distillPrefs";
import {
  COMPASS_AIM_PX,
  COMPASS_LOCK_PX,
  doorForAim,
  resolveCompassAim,
  type CompassAim,
} from "../../lib/onyxCompass";

const MAX = 2;

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
  /** Tier-honest provenance for the locked snapshot (measured vs celebrated). */
  provenanceLine?: string | null;
  /** Active layer label — names exactly what's folded in. */
  readingLayerLabel?: string;
  /** Available layers for one-tap switch (Layer 0 always first). */
  readingLayers?: ReadingLayerChip[];
  activeLayerId?: ReadingLayerChip["id"];
  onSelectLayer?: (id: ReadingLayerChip["id"]) => void;
  distillPrefs?: DistillPrefs;
  brains?: BrainAvailability | null;
  onDistillPrefs?: (next: DistillPrefs) => void;
  selfTone: React.ReactNode;
  selfRet: React.ReactNode;
  calendarReadings: CycleReading[];
  /** Land calendar of place (e.g. Cherokee moon) — calendar framing, never personality. */
  landCalendarLine?: string | null;
  /** Land acknowledgment at the location fix — first-class, not a footnote. */
  landAcknowledgment?: { text: string; people: string; pointTo?: string } | null;
  /** Embraced casts — labeled strip; folds into with-drawn when that layer is active. */
  heldCasts?: HeldCastChip[];
  /** Clear every held divination. */
  onResetHeld?: () => void;
  /** Release one held draw by id. */
  onReleaseHeld?: (id: string) => void;
  onOpenSky: () => void;
  onOpenRings: () => void;
  onOpenTools: () => void;
  onOpenWhy?: () => void;
  onOpenYou?: () => void;
  onOpenCast?: () => void;
  /** Portal doors — Studies / Tonal live on the HTML portal routes. */
  onOpenStudies?: () => void;
  onOpenTonal?: () => void;
  /** Stone switch: sound + haptic pulse master. */
  pulseEnabled?: boolean;
  onPulseEnabledChange?: (on: boolean) => void;
  sensorsUnlocked?: boolean;
};

export function OnyxHome({
  now: _now,
  phaseFraction,
  zodiacSign,
  momentLine,
  provenanceLine,
  readingLayerLabel,
  readingLayers = [],
  activeLayerId = "moment",
  onSelectLayer,
  distillPrefs,
  brains = null,
  onDistillPrefs,
  selfTone,
  selfRet,
  calendarReadings,
  landCalendarLine,
  landAcknowledgment,
  heldCasts = [],
  onResetHeld,
  onReleaseHeld,
  onOpenSky,
  onOpenRings,
  onOpenTools,
  onOpenWhy,
  onOpenYou,
  onOpenCast,
  onOpenStudies,
  onOpenTonal,
  pulseEnabled = true,
  onPulseEnabledChange,
  sensorsUnlocked = false,
}: OnyxHomeProps) {
  const [depth, setDepth] = useState(0);
  const [datesOpen, setDatesOpen] = useState(false);
  const [pulseAnim, setPulseAnim] = useState<"none" | "beat" | "chime">("none");
  const [hapticOn, setHapticOn] = useState(pulseEnabled);
  const [compassLocked, setCompassLocked] = useState(false);
  const [compassAim, setCompassAim] = useState<CompassAim>(null);
  const [compassFollow, setCompassFollow] = useState({ x: 0, y: 0 });
  const [gemSpin, setGemSpin] = useState<CompassAim>(null);
  const [ballFlash, setBallFlash] = useState<"copy" | "share" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [distillOpen, setDistillOpen] = useState(false);
  const [wallNow, setWallNow] = useState(() => _now);
  const deviceRef = useRef<HTMLDivElement>(null);
  const enterTimer = useRef(0);
  const flashTimer = useRef(0);
  const depthRef = useRef(0);
  depthRef.current = depth;
  const wheelLock = useRef(false);
  const hapticRef = useRef(pulseEnabled);
  const lastSec = useRef(-1);
  const onPulseRef = useRef(onPulseEnabledChange);
  onPulseRef.current = onPulseEnabledChange;
  const compassPtr = useRef<{ id: number; x0: number; y0: number; armed: boolean } | null>(null);
  const compassAimRef = useRef<CompassAim>(null);

  useEffect(() => {
    hapticRef.current = pulseEnabled;
    setHapticOn(pulseEnabled);
  }, [pulseEnabled]);

  useEffect(() => {
    const id = window.setInterval(() => setWallNow(new Date()), 250);
    return () => window.clearInterval(id);
  }, []);

  const clockLabel = wallNow.toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const sec = String(wallNow.getSeconds()).padStart(2, "0");

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
      if (prev === 0 && delta > 0) {
        buzz("step");
        onOpenTonal?.();
        return;
      }
      const nd = Math.max(0, Math.min(MAX, prev + delta));
      if (nd === prev) return;
      buzz(nd === MAX ? "deep" : "step");
      setDepth(nd);
    },
    [buzz, onOpenSky, onOpenTonal],
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

  const setPulse = useCallback((enabled: boolean) => {
    hapticRef.current = enabled;
    setHapticOn(enabled);
    onPulseRef.current?.(enabled);
  }, []);

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

  const commitCompassAim = useCallback(
    (aim: CompassAim) => {
      const door = doorForAim(aim);
      if (!door) return;
      if (door === "sky") onOpenSky();
      else if (door === "tonal") onOpenTonal?.();
      else if (door === "studies") onOpenStudies?.();
      else if (door === "orrery") onOpenRings();
      else if (door === "you") {
        if (onOpenYou) onOpenYou();
        else go(MAX);
      }
    },
    [go, onOpenRings, onOpenSky, onOpenStudies, onOpenTonal, onOpenYou],
  );

  const enterDoor = useCallback(
    (aim: CompassAim) => {
      if (!aim || gemSpin) return;
      if (!doorForAim(aim)) return;
      setGemSpin(aim);
      buzz("step");
      window.clearTimeout(enterTimer.current);
      const ms = aim === "center" ? 340 : 720;
      enterTimer.current = window.setTimeout(() => {
        commitCompassAim(aim);
        setGemSpin(null);
      }, ms);
    },
    [buzz, commitCompassAim, gemSpin],
  );

  const flashBall = useCallback((kind: "copy" | "share") => {
    setBallFlash(kind);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setBallFlash(null), 1400);
  }, []);

  const openShareSheet = useCallback(
    (e: React.PointerEvent | React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setShareOpen(true);
      flashBall("share");
      buzz("tick");
    },
    [buzz, flashBall],
  );

  const pickShare = useCallback(
    async (id: ShareDest) => {
      const row = destinationsFor(momentLine).find(r => r.id === id);
      if (id === "copy") {
        try {
          await navigator.clipboard.writeText(momentLine);
        } catch {
          /* clipboard blocked */
        }
        flashBall("copy");
      } else if (id === "more") {
        try {
          await navigator.share?.({ title: "DELPHI", text: momentLine, url: "https://delphi.pauloventura.org/" });
        } catch {
          /* cancelled */
        }
        flashBall("share");
      } else if (row?.href) {
        window.open(row.href, "_blank", "noopener,noreferrer");
        flashBall("share");
      }
      setShareOpen(false);
      buzz("tick");
    },
    [buzz, flashBall, momentLine],
  );

  useEffect(
    () => () => {
      window.clearTimeout(enterTimer.current);
      window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const resetCompass = useCallback(() => {
    compassPtr.current = null;
    compassAimRef.current = null;
    setCompassLocked(false);
    setCompassAim(null);
    setCompassFollow({ x: 0, y: 0 });
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
    if (aim) enterDoor(aim);
    else if (wasTap) enterDoor("center");
  };

  const swipeTargetIgnored = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el?.closest) return false;
    // Clock / NOW panel owns vertical gestures for scrolling on phones.
    if (depthRef.current === 1 && el.closest(".onyx-p2")) return true;
    return Boolean(
      el.closest(
        ".onyx-stone-track, .onyx-compass, .onyx-phase-moon, .onyx-yy-phrase-btn, .onyx-yy-dot, .onyx-share-sheet, .onyx-share-scrim, .onyx-yy-dirs, .onyx-row, .onyx-rx, .onyx-why, .onyx-side-doors, .onyx-distill-chip, input, textarea, a",
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
        className="onyx-device onyx-yy-home"
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
          if (e.key === "Escape" && (shareOpen || distillOpen)) {
            e.preventDefault();
            setShareOpen(false);
            setDistillOpen(false);
            return;
          }
          if (e.key === "ArrowDown") goDelta(1);
          if (e.key === "ArrowUp") goDelta(-1);
        }}
        tabIndex={0}
      >
        <div className="onyx-field">
          <div className="onyx-home-vision" aria-hidden />
          <div className="onyx-aura" />
          <OnyxStarfield />
          {depth !== 0 && <OnyxCrystal sensorsUnlocked={sensorsUnlocked} />}
        </div>

        <div className="onyx-vignette" />
        <div className={`onyx-pulse-ring${pulseAnim === "beat" ? " beat" : ""}${pulseAnim === "chime" ? " chime" : ""}`} />

        <OnyxPhaseMoon phaseFraction={phaseFraction} onOpenSky={onOpenSky} />
        <p className="onyx-wordmark">DELPHI</p>
        <p className="onyx-clock">
          {clockLabel.toUpperCase().replace(",", " ·")}:
          <span className="sec">{sec}</span>
        </p>

        <OnyxAudioStone
          enabled={hapticOn}
          onEnabledChange={setPulse}
        />

        {/* 0 STREET — no held-cast strip here; divinations live inside You */}
        <div className={`onyx-panel onyx-p0${depth === 0 ? " show" : ""}`} />

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
            <HeldStrip
              casts={heldCasts}
              eyebrow="Held · not the sky clock"
              onOpenCast={onOpenCast}
              onResetHeld={onResetHeld}
              onReleaseHeld={onReleaseHeld}
              buzz={buzz}
            />
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
              <span>Orrery</span>
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
              {onOpenYou && (
                <button
                  type="button"
                  className="onyx-ghost-btn"
                  onClick={() => {
                    buzz("tick");
                    onOpenYou();
                  }}
                >
                  Divinations · inside You
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={`onyx-compass-wrap onyx-yy-wrap${compassLocked ? " holding" : ""}${gemSpin ? " spinning" : ""}`}>
          <div className="onyx-compass-stage onyx-yy-stage">
            <div className="onyx-yy-orb">
              <OnyxCompassRose
                active={compassAim ?? gemSpin ?? null}
                follow={compassFollow}
                holding={compassLocked || Boolean(gemSpin)}
              />
              <div className="onyx-yy-gem-nest">
                <button
                  type="button"
                  className={`onyx-compass onyx-yy-gem${compassLocked ? " locked" : gemSpin ? "" : " floating"}${compassAim ? " aiming" : ""}${gemSpin ? ` spinning spin-${gemSpin}` : ""}`}
                  style={
                    {
                      ["--onyx-compass-x" as string]: `${compassFollow.x}px`,
                      ["--onyx-compass-y" as string]: `${compassFollow.y}px`,
                    } as React.CSSProperties
                  }
                  aria-label="Hold and drag: up sky map, down tonal, right orrery, left studies. Tap the glass for you."
                  disabled={Boolean(gemSpin)}
                  onPointerDown={e => {
                    if (gemSpin) return;
                    onCompassPointerDown(e);
                  }}
                  onPointerMove={onCompassPointerMove}
                  onPointerUp={onCompassPointerUp}
                  onPointerCancel={e => {
                    e.stopPropagation();
                    resetCompass();
                  }}
                >
                  <OnyxYinYang
                    aiming={Boolean(compassAim) || Boolean(gemSpin)}
                    locked={compassLocked}
                    spinning={Boolean(gemSpin)}
                    sensorsUnlocked={sensorsUnlocked}
                    copyFlash={ballFlash === "copy"}
                    shareFlash={ballFlash === "share"}
                  />
                </button>
                <button
                  type="button"
                  className="onyx-yy-dot yin"
                  aria-label="Share this reading"
                  aria-haspopup="dialog"
                  aria-expanded={shareOpen}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={openShareSheet}
                />
                <button
                  type="button"
                  className="onyx-yy-dot yang"
                  aria-label="Share this reading"
                  aria-haspopup="dialog"
                  aria-expanded={shareOpen}
                  onClick={openShareSheet}
                  onPointerDown={e => e.stopPropagation()}
                />
              </div>
              <div className="onyx-yy-phrase">
                <button
                  type="button"
                  className="onyx-yy-phrase-btn"
                  onClick={e => {
                    e.stopPropagation();
                    enterDoor("center");
                  }}
                >
                  <p className="big">{momentLine}</p>
                </button>
              </div>
            </div>
            <div className="onyx-compass-dirs onyx-yy-dirs">
              {(
                [
                  ["up", "sky map"],
                  ["left", "studies"],
                  ["right", "orrery"],
                  ["down", "tonal"],
                ] as const
              ).map(([dir, label]) => (
                <button
                  key={dir}
                  type="button"
                  className={`d-${dir}${compassAim === dir || gemSpin === dir ? " on" : ""}`}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation();
                    enterDoor(dir);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {shareOpen && (
          <OnyxShareSheet
            text={momentLine}
            onPick={pickShare}
            onClose={() => setShareOpen(false)}
          />
        )}
        {distillOpen && distillPrefs && onDistillPrefs && (
          <OnyxDistillSheet
            prefs={distillPrefs}
            brains={brains}
            onChange={onDistillPrefs}
            onClose={() => setDistillOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function HeldStrip({
  casts,
  eyebrow,
  onOpenCast,
  onResetHeld,
  onReleaseHeld,
  buzz,
}: {
  casts: HeldCastChip[];
  eyebrow: string;
  onOpenCast?: () => void;
  onResetHeld?: () => void;
  onReleaseHeld?: (id: string) => void;
  buzz: (kind: HapticKind) => void;
}) {
  return (
    <div className="onyx-held">
      <div className="onyx-held-head">
        <p className="onyx-held-eyebrow">{eyebrow}</p>
        {onResetHeld && (
          <button
            type="button"
            className="onyx-held-reset"
            onClick={e => {
              e.stopPropagation();
              buzz("tick");
              onResetHeld();
            }}
          >
            Reset
          </button>
        )}
      </div>
      <div className="onyx-held-row">
        {casts.map(h => (
          <span key={h.id} className="onyx-held-chip-wrap">
            <button
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
            {onReleaseHeld && (
              <button
                type="button"
                className="onyx-held-release"
                aria-label={`Release ${h.label}`}
                onClick={e => {
                  e.stopPropagation();
                  buzz("tick");
                  onReleaseHeld(h.id);
                }}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
