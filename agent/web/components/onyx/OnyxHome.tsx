"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Vec3 } from "../../lib/sphericalView";
import { isFreshVisit } from "../../lib/visits";
import { getClockAudio, playChargeTick } from "../../lib/clockSfx";
import {
  cancelHaptic,
  hapticsMuted,
  installHapticLifecycle,
  muteHaptics,
  pulseHaptic,
  unmuteHaptics,
  type HapticKind,
} from "../../lib/haptics";
import { OnyxPhaseMoon } from "./OnyxPhaseMoon";
import { OnyxAudioStone } from "./OnyxAudioStone";
import { OnyxAulos } from "./OnyxAulos";
import { OnyxHomeFilm } from "./OnyxHomeFilm";
import { OnyxDistillSheet } from "./OnyxDistillSheet";
import { destinationsFor, OnyxShareSheet, type ShareDest } from "./OnyxShareSheet";
import { OnyxCompassRose } from "./OnyxCompassRose";
import { OnyxYinYang } from "./OnyxYinYang";
import { OnyxDoorArrows, type DoorArrowDir } from "./OnyxDoorArrows";
import type { BrainAvailability, DistillPrefs } from "../../lib/lore/distillPrefs";
import {
  COMPASS_AIM_PX,
  COMPASS_LOCK_PX,
  doorForAim,
  resolveCompassAim,
  type CompassAim,
} from "../../lib/onyxCompass";
import { COMPASS_DOOR_LABEL } from "../../lib/chambers";
import { trackEvent } from "../../lib/telemetry/client";

const ARROW_DIR: Record<string, DoorArrowDir | undefined> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** Home flick: touch only, long and quick enough that it can't be a scroll. */
const SWIPE_MIN_PX = 96;
const SWIPE_MAX_MS = 450;

const COMPASS_FOLLOW_MAX = 28;

export type OnyxHomeProps = {
  now: Date;
  phaseFraction: number;
  /** Distilled sentence for the moment — what Share sends. */
  momentLine: string;
  distillPrefs?: DistillPrefs;
  brains?: BrainAvailability | null;
  onDistillPrefs?: (next: DistillPrefs) => void;
  onOpenSky: () => void;
  onOpenRings: () => void;
  onOpenTools: () => void;
  onOpenYou?: () => void;
  /** Portal doors — Studies / Tonal live on the HTML portal routes. */
  onOpenStudies?: () => void;
  onOpenTonal?: () => void;
  /** Stone switch: sound + haptic pulse master. */
  pulseEnabled?: boolean;
  onPulseEnabledChange?: (on: boolean) => void;
  sensorsUnlocked?: boolean;
  /** Live device look azimuth (0 = north). Drives the home compass dial. */
  headingDeg?: number | null;
  attitudeRef?: RefObject<{ view: Vec3; roll: number } | null>;
};

export function OnyxHome({
  now: _now,
  phaseFraction,
  momentLine,
  distillPrefs,
  brains = null,
  onDistillPrefs,
  onOpenSky,
  onOpenRings,
  onOpenTools,
  onOpenYou,
  onOpenStudies,
  onOpenTonal,
  pulseEnabled = true,
  onPulseEnabledChange,
  sensorsUnlocked = false,
  headingDeg = null,
  attitudeRef,
}: OnyxHomeProps) {
  const [fresh] = useState(isFreshVisit);
  const [pulseAnim, setPulseAnim] = useState<"none" | "beat" | "chime">("none");
  const [hapticOn, setHapticOn] = useState(pulseEnabled);
  const [compassLocked, setCompassLocked] = useState(false);
  const [compassAim, setCompassAim] = useState<CompassAim>(null);
  const [compassFollow, setCompassFollow] = useState({ x: 0, y: 0 });
  const [gemSpin, setGemSpin] = useState<CompassAim>(null);
  const [bowShoot, setBowShoot] = useState<DoorArrowDir | null>(null);
  const [ballFlash, setBallFlash] = useState<"copy" | "share" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [distillOpen, setDistillOpen] = useState(false);
  const [wallNow, setWallNow] = useState(() => _now);
  const deviceRef = useRef<HTMLDivElement>(null);
  const enterTimer = useRef(0);
  const flashTimer = useRef(0);
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

  const dateLabel = wallNow
    .toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase()
    .replace(",", " ·");
  const timeParts = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).formatToParts(wallNow);
  const hourMinute = timeParts
    .filter(p => p.type !== "dayPeriod")
    .map(p => p.value)
    .join("")
    .trim();
  const dayPeriod = timeParts.find(p => p.type === "dayPeriod")?.value.toUpperCase() ?? "";
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

  /** Swipe / arrow-key door. Sync call keeps the iOS gesture for sensor permission. */
  const openDoorNow = useCallback(
    (dir: DoorArrowDir) => {
      buzz("step");
      if (dir === "up") onOpenSky();
      else if (dir === "down") onOpenTonal?.();
      else if (dir === "left") onOpenStudies?.();
      else onOpenRings();
    },
    [buzz, onOpenRings, onOpenSky, onOpenStudies, onOpenTonal],
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
    trackEvent(enabled ? "sound_on" : "sound_off");
    onPulseRef.current?.(enabled);
  }, []);

  // Only a deliberate touch flick navigates; wheel / trackpad / mouse drags never do.
  const swipeStart = useRef<{ y: number; t: number } | null>(null);

  const commitCompassAim = useCallback(
    (aim: CompassAim) => {
      const door = doorForAim(aim);
      if (!door) return;
      if (door === "sky") onOpenSky();
      else if (door === "tonal") onOpenTonal?.();
      else if (door === "studies") onOpenStudies?.();
      else if (door === "orrery") onOpenRings();
      else if (door === "you") onOpenYou?.();
    },
    [onOpenRings, onOpenSky, onOpenStudies, onOpenTonal, onOpenYou],
  );

  const enterDoor = useCallback(
    (aim: CompassAim) => {
      if (!aim || gemSpin || bowShoot) return;
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
    [buzz, commitCompassAim, gemSpin, bowShoot],
  );

  const shootBow = useCallback(
    (dir: DoorArrowDir) => {
      if (bowShoot || gemSpin) return;
      setBowShoot(dir);
      buzz("step");
      window.clearTimeout(enterTimer.current);
      enterTimer.current = window.setTimeout(() => {
        commitCompassAim(dir);
        setBowShoot(null);
      }, 540);
    },
    [bowShoot, buzz, commitCompassAim, gemSpin],
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
          await navigator.share?.({ title: "Pneuma Mundi", text: momentLine, url: "https://delphi.pauloventura.org/" });
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
      if (aim) {
        buzz("tick");
        const ctx = hapticRef.current ? getClockAudio() : null;
        if (ctx) playChargeTick(ctx);
      }
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
    return Boolean(
      el.closest(
        ".onyx-stone-track, .onyx-compass, .onyx-phase-moon, .onyx-yy-dot, .onyx-share-sheet, .onyx-share-scrim, .onyx-yy-dirs, .onyx-distill-chip, .onyx-treasury-door, .onyx-aulos-btn, input, textarea, a",
      ),
    );
  };

  const onPointerDownSwipe = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch" || !e.isPrimary || swipeTargetIgnored(e.target)) {
      swipeStart.current = null;
      return;
    }
    swipeStart.current = { y: e.clientY, t: performance.now() };
  };

  const onPointerUpSwipe = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dy = e.clientY - start.y;
    if (Math.abs(dy) < SWIPE_MIN_PX || performance.now() - start.t > SWIPE_MAX_MS) return;
    openDoorNow(dy > 0 ? "down" : "up");
  };

  return (
    <div className="onyx-root onyx-home-fade">
      <div
        ref={deviceRef}
        className="onyx-device onyx-yy-home"
        role="application"
        aria-label="Pneuma Mundi"
        onPointerDown={onPointerDownSwipe}
        onPointerUp={onPointerUpSwipe}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
        onKeyDown={e => {
          if (e.key === "Escape" && (shareOpen || distillOpen)) {
            e.preventDefault();
            setShareOpen(false);
            setDistillOpen(false);
            return;
          }
          /* Aulos lyrics Esc is handled inside OnyxAulos. */
          if ((e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]")) return;
          if (shareOpen || distillOpen) return;
          const dir = ARROW_DIR[e.key];
          if (dir) {
            e.preventDefault();
            openDoorNow(dir);
          }
        }}
        tabIndex={0}
      >
        <div className="onyx-field">
          <OnyxHomeFilm />
          <div className="onyx-home-vision" aria-hidden />
          <div className="onyx-aura" />
        </div>

        <div className="onyx-vignette" />
        <div className={`onyx-pulse-ring${pulseAnim === "beat" ? " beat" : ""}${pulseAnim === "chime" ? " chime" : ""}`} />

        <button
          type="button"
          className="onyx-treasury-door"
          onClick={onOpenTools}
          aria-label="Treasury — Atlas, Senses, About and more"
          title="Treasury"
        >
          ✦
        </button>
        <OnyxPhaseMoon phaseFraction={phaseFraction} onOpenSky={onOpenSky} />
        <p className="onyx-wordmark">Pneuma Mundi</p>
        <div className="onyx-inscription">
          <p className="onyx-inscription-greek" lang="grc">ΓΝΩΘΙ ΣΑΥΤΟΝ</p>
          {fresh && <p className="onyx-inscription-en">Know Thyself</p>}
        </div>
        <p className={`onyx-clock${fresh ? " under-en" : ""}`}>
          {dateLabel}, {hourMinute}:<span className="sec">{sec}</span>
          {dayPeriod && ` ${dayPeriod}`}
        </p>

        <OnyxAudioStone
          enabled={hapticOn}
          onEnabledChange={setPulse}
        />

        <OnyxAulos soundAllowed={hapticOn} visible />

        <div className={`onyx-compass-wrap onyx-yy-wrap${fresh ? " fresh" : ""}${compassLocked ? " holding" : ""}${gemSpin ? " spinning" : ""}${bowShoot ? " bow-loosing" : ""}`}>
          <div className="onyx-compass-stage onyx-yy-stage">
            <div className="onyx-yy-orb">
              <OnyxCompassRose
                active={compassAim ?? gemSpin ?? bowShoot ?? null}
                follow={compassFollow}
                holding={compassLocked || Boolean(gemSpin) || Boolean(bowShoot)}
                headingDeg={headingDeg}
                attitudeRef={attitudeRef}
              />
              <div className="onyx-yy-gem-nest">
                <button
                  type="button"
                  className={`onyx-compass onyx-yy-gem${compassLocked ? " locked" : gemSpin || bowShoot ? "" : " floating"}${compassAim ? " aiming" : ""}${gemSpin ? ` spinning spin-${gemSpin}` : ""}`}
                  aria-label="Compass. Hold and drag: up Aether, down Agon, right Heliodrome, left Mouseion. Or release a silver bow. Tap the centre for Psyche."
                  disabled={Boolean(gemSpin) || Boolean(bowShoot)}
                  onPointerDown={e => {
                    if (gemSpin || bowShoot) return;
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
                    aiming={Boolean(compassAim) || Boolean(gemSpin) || Boolean(bowShoot)}
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
            </div>
            <OnyxDoorArrows
              active={compassAim ?? gemSpin ?? null}
              shooting={bowShoot}
              onShoot={shootBow}
            />
            <div className="onyx-compass-dirs onyx-yy-dirs" aria-hidden>
              {(
                [
                  ["up", "sky"],
                  ["left", "studies"],
                  ["right", "orrery"],
                  ["down", "tonal"],
                ] as const
              ).map(([dir, door]) => (
                <span
                  key={dir}
                  className={`d-${dir}${compassAim === dir || gemSpin === dir || bowShoot === dir ? " on" : ""}`}
                  data-label={COMPASS_DOOR_LABEL[door]}
                >
                  {COMPASS_DOOR_LABEL[door]}
                </span>
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
