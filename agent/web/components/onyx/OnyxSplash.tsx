"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { getClockAudio } from "../../lib/clockSfx";
import { trackEvent } from "../../lib/telemetry/client";
import {
  AUDIO_BUS,
  audioBusInput,
  ensureAudioBus,
  fadeIn,
  fadeOut,
} from "../../lib/audioBus";
import {
  afterClip,
  afterGuide,
  LAST_CLIP,
  markPilgrimGuideSeen,
  pilgrimGuideWanted,
  skipTo,
  type OpeningClipId,
  type OpeningPlan,
  type OpeningStep,
} from "../../lib/openingSequence";
import { PILGRIM_INTRO, PILGRIM_STEPS } from "../../lib/lore/pilgrimGuide";

/**
 * Boot: Historical → Pythia → stairs → the cake offering (void), then the Allow gate
 * over the cake's last frame, or one quiet Enter into the home.
 *
 * Hard rules:
 * - Videos are silent files (no AAC). Only matching Web Audio beds play sound.
 * - Exactly one clip at a time: kill prior bed hard before the next starts.
 * - Audio starts with the page. The bed plays as a normal audio file so the
 *   picture and its sound can open together. The clock context takes over
 *   only once the browser is actually letting it run. A tap still starts the
 *   bed if the browser held it, and a later tap skips to the cake's last frame
 *   (after SKIP_GUARD_MS, so that tap's ghost click can't skip). Enter is armed
 *   ENTER_ARM_MS after it shows, so one tap never runs through to the home.
 */

type ClipDef = { id: OpeningClipId; video: string; audio: string };

const CLIPS: readonly ClipDef[] = [
  {
    id: "historical",
    video: `/pneuma-boot-historical-g.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-historical-audio.m4a?v=${DELPHI_BUILD}`,
  },
  {
    id: "pythia",
    video: `/pneuma-boot-pythia-g.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-pythia-audio.m4a?v=${DELPHI_BUILD}`,
  },
  {
    id: "stairs",
    video: `/pneuma-boot-stairs-g.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-stairs-audio.m4a?v=${DELPHI_BUILD}`,
  },
  {
    id: "void",
    video: `/pneuma-boot-void.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-void-audio.m4a?v=${DELPHI_BUILD}`,
  },
] as const;

export const CAKE_LAST_FRAME = `/pneuma-boot-void-last.jpg?v=${DELPHI_BUILD}`;

const HOLD_MS = 600;
/** A film that has not ended this long after it was asked to play is treated as ended. */
const STALL_MS = 25_000;
const GUIDE_ARM_MS = 500;
const UNLOCK_GUARD_MS = 1000;
const SKIP_GUARD_MS = 700;
const ENTER_ARM_MS = 650;
/** A tap aimed at "Tap to begin" that lands just after sound started on its own is not a skip. */
const BEGIN_TO_SKIP_MS = 1200;
const PREVIEW_SRC = `${CLIPS[0]!.video}&preview=1`;

export function OnyxSplash({
  onEnter,
  onPrimeAccess,
  endsAtGate = false,
}: {
  onEnter: () => void;
  onPrimeAccess?: () => void;
  /** Allow is still needed: the gate takes over on the cake's last frame. */
  endsAtGate?: boolean;
}) {
  const [guideOn] = useState(pilgrimGuideWanted);
  const planRef = useRef<OpeningPlan>({ guide: guideOn, needsGate: endsAtGate });
  planRef.current.needsGate = endsAtGate;
  /** Which film's pilgrim box is open over its last frame, or null. */
  const [guideIdx, setGuideIdx] = useState<number | null>(null);
  const guideIdxRef = useRef<number | null>(null);
  const guideArmedAt = useRef(0);
  const ctaRef = useRef<HTMLButtonElement | null>(null);
  const stallTimer = useRef<number | null>(null);
  /** The current clip's bed may be (re)started; false once its picture has ended. */
  const bedWantedRef = useRef(true);
  const endOnLoadRef = useRef(false);
  const enterArmedAt = useRef(Number.POSITIVE_INFINITY);
  const enterRef = useRef<HTMLButtonElement | null>(null);
  const [atEnd, setAtEnd] = useState(false);
  const atEndRef = useRef(false);
  const entered = useRef(false);
  const unlockedRef = useRef(false);
  const unlockingRef = useRef(false);
  const guardUntil = useRef(0);
  const skipAllowedAt = useRef(Number.POSITIVE_INFINITY);
  const audioGen = useRef(0);
  const clipIdxRef = useRef(0);
  const bufferSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const holdTimer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileBedRef = useRef<HTMLAudioElement | null>(null);
  /** Invalidates stale load/play/audio handlers. */
  const sessionRef = useRef(0);

  const [clipIdx, setClipIdx] = useState(0);
  const [videoKey, setVideoKey] = useState(0);
  const [filmSrc, setFilmSrc] = useState(PREVIEW_SRC);
  const [videoReady, setVideoReady] = useState(false);
  const [veilOn, setVeilOn] = useState(true);
  const [needTap, setNeedTap] = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  /** `keepFile`: the bed about to (re)start on the shared file element is left playing. */
  const killAudioHard = (keepFile?: string) => {
    audioGen.current += 1;
    const file = fileBedRef.current;
    if (file && !file.paused && file.dataset.bed !== keepFile) {
      try { file.pause(); } catch { /* ignore */ }
    }
    const src = bufferSrcRef.current;
    const dry = dryGainRef.current;
    bufferSrcRef.current = null;
    dryGainRef.current = null;
    if (dry) {
      try {
        const t = dry.context.currentTime;
        dry.gain.cancelScheduledValues(t);
        dry.gain.setValueAtTime(AUDIO_BUS.SILENCE, t);
      } catch {
        /* ignore */
      }
      try {
        dry.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (src) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        /* already stopped */
      }
      try {
        src.disconnect();
      } catch {
        /* ignore */
      }
    }
    fadeOut("splash", 40);
  };

  const dissolveAudioOut = () => {
    const gen = audioGen.current;
    const dry = dryGainRef.current;
    const src = bufferSrcRef.current;
    if (!dry || !src) {
      const file = fileBedRef.current;
      if (file && !file.paused) {
        const from = file.volume;
        const t0 = performance.now();
        const ms = AUDIO_BUS.CLIP_FADE_OUT_MS;
        const step = () => {
          if (fileBedRef.current !== file) return;
          const k = Math.min(1, (performance.now() - t0) / ms);
          file.volume = from * (1 - k);
          if (k < 1) requestAnimationFrame(step);
          else {
            try { file.pause(); } catch { /* ignore */ }
          }
        };
        requestAnimationFrame(step);
        fadeOut("splash", ms);
        return;
      }
      killAudioHard();
      return;
    }
    const t = dry.context.currentTime;
    const ms = AUDIO_BUS.CLIP_FADE_OUT_MS;
    try {
      dry.gain.cancelScheduledValues(t);
      dry.gain.setValueAtTime(Math.max(AUDIO_BUS.SILENCE, dry.gain.value), t);
      dry.gain.exponentialRampToValueAtTime(AUDIO_BUS.SILENCE, t + ms / 1000);
    } catch {
      /* ignore */
    }
    fadeOut("splash", ms);
    window.setTimeout(() => {
      if (audioGen.current !== gen) return;
      killAudioHard();
    }, ms + 40);
  };

  const finish = (fromGesture: boolean) => {
    if (entered.current) return;
    entered.current = true;
    if (stallTimer.current != null) {
      window.clearTimeout(stallTimer.current);
      stallTimer.current = null;
    }
    trackEvent(fromGesture ? "splash_skip" : "splash_complete", `clip ${clipIdxRef.current + 1}`);
    sessionRef.current += 1;
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    dissolveAudioOut();
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {
        /* ignore */
      }
    }
    if (fromGesture) onPrimeAccess?.();
    onEnter();
  };

  const ensureBuffer = async (ctx: AudioContext, url: string) => {
    const hit = audioCache.current.get(url);
    if (hit) return hit;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`audio ${res.status}`);
    const buf = await ctx.decodeAudioData((await res.arrayBuffer()).slice(0));
    audioCache.current.set(url, buf);
    return buf;
  };

  const fileBed = () => {
    if (!fileBedRef.current) {
      const el = new Audio();
      el.preload = "auto";
      el.autoplay = true;
      el.addEventListener("playing", () => setNeedTap(false));
      fileBedRef.current = el;
    }
    return fileBedRef.current;
  };

  /** Speakers first. A suspended clock context stays silent, so the file plays on its own. */
  const playFileBed = (url: string) => {
    const el = fileBed();
    if (el.dataset.bed !== url) {
      el.dataset.bed = url;
      el.src = url;
    }
    el.volume = 1;
    void el.play().then(() => setNeedTap(false)).catch(() => {});
  };

  const stopFileBed = () => {
    const el = fileBedRef.current;
    if (!el) return;
    try { el.pause(); } catch { /* ignore */ }
  };

  /** Start ONLY forIdx’s dry bed — never another clip’s. */
  const playClipAudio = async (forIdx: number, session: number) => {
    const clip = CLIPS[forIdx];
    if (!clip || entered.current) return;
    if (sessionRef.current !== session) return;
    if (clipIdxRef.current !== forIdx) return;
    if (!bedWantedRef.current) return;

    killAudioHard(clip.audio);
    const heard = fileBed();
    if (heard.dataset.bed !== clip.audio) {
      heard.dataset.bed = clip.audio;
      heard.src = clip.audio;
    }
    heard.volume = 1;
    try {
      await heard.play();
      setNeedTap(false);
      return;
    } catch {
      /* The file was held. The clock context is the other door. */
    }

    const gen = ++audioGen.current;
    const ctx = getClockAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    if (ctx.state !== "running") return;
    if (audioGen.current !== gen || sessionRef.current !== session) return;

    ensureAudioBus(ctx);
    let buf: AudioBuffer;
    try {
      buf = await ensureBuffer(ctx, clip.audio);
    } catch {
      return;
    }
    if (
      audioGen.current !== gen ||
      sessionRef.current !== session ||
      clipIdxRef.current !== forIdx ||
      entered.current ||
      !bedWantedRef.current
    ) {
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const dry = ctx.createGain();
    dry.gain.value = AUDIO_BUS.SILENCE;
    src.connect(dry);
    dry.connect(audioBusInput("splash", ctx));

    const t0 = ctx.currentTime;
    dry.gain.setValueAtTime(AUDIO_BUS.SILENCE, t0);
    dry.gain.exponentialRampToValueAtTime(1, t0 + AUDIO_BUS.CLIP_FADE_IN_MS / 1000);
    fadeIn("splash", AUDIO_BUS.CLIP_FADE_IN_MS, 1);

    src.onended = () => {
      if (bufferSrcRef.current === src) {
        bufferSrcRef.current = null;
        dryGainRef.current = null;
      }
    };
    stopFileBed();
    src.start(0);
    setNeedTap(false);
    bufferSrcRef.current = src;
    dryGainRef.current = dry;
  };

  /** Remount video on this clip’s silent mp4; audio follows after play(). */
  const goToClip = (idx: number, endOnLoad = false) => {
    if (entered.current || idx < 0 || idx >= CLIPS.length) return;
    const clip = CLIPS[idx];
    if (!clip) return;

    if (!endOnLoad) killAudioHard(clip.audio);
    endOnLoadRef.current = endOnLoad;
    bedWantedRef.current = !endOnLoad;
    const session = ++sessionRef.current;
    if (stallTimer.current != null) window.clearTimeout(stallTimer.current);
    stallTimer.current = endOnLoad
      ? null
      : window.setTimeout(() => {
          stallTimer.current = null;
          if (sessionRef.current === session && !entered.current) clipFinished();
        }, STALL_MS);
    clipIdxRef.current = idx;
    setClipIdx(idx);
    setVeilOn(true);
    setVideoReady(false);
    guardUntil.current = Date.now() + UNLOCK_GUARD_MS;
    setFilmSrc(`${clip.video}&i=${idx}&s=${session}`);
    setVideoKey(k => k + 1);
  };

  /** After each remount: mute → play THIS picture → start THIS bed only. */
  useEffect(() => {
    if (!unlocked) return;
    const session = sessionRef.current;
    const idx = clipIdxRef.current;
    const v = videoRef.current;
    if (!v) return;

    let cancelled = false;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");

    void (async () => {
      await new Promise<void>(resolve => {
        const done = () => {
          v.removeEventListener("loadeddata", done);
          resolve();
        };
        if (v.readyState >= 2) resolve();
        else v.addEventListener("loadeddata", done);
        window.setTimeout(resolve, 2500);
      });
      if (cancelled || entered.current || sessionRef.current !== session) return;

      if (endOnLoadRef.current) {
        try {
          v.pause();
          if (Number.isFinite(v.duration) && v.duration > 0) v.currentTime = Math.max(0, v.duration - 0.05);
        } catch {
          /* the poster already shows the last frame */
        }
        setVideoReady(true);
        window.setTimeout(() => {
          if (!cancelled && sessionRef.current === session && !entered.current) setVeilOn(false);
        }, 80);
        return;
      }

      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
      setVideoReady(true);
      window.setTimeout(() => {
        if (!cancelled && sessionRef.current === session && !entered.current) {
          setVeilOn(false);
        }
      }, 80);

      try {
        await v.play();
      } catch {
        /* gesture already unlocked AudioContext */
      }
      if (cancelled || entered.current || sessionRef.current !== session) return;
      if (clipIdxRef.current !== idx) return;
      await playClipAudio(idx, session);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, videoKey, filmSrc]);

  const onVideoEnded = () => {
    if (entered.current) return;

    if (!unlockedRef.current) {
      const v = videoRef.current;
      if (v) {
        try {
          v.currentTime = 0;
          void v.play().catch(() => {});
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (Date.now() < guardUntil.current) {
      const v = videoRef.current;
      if (v) {
        try {
          v.currentTime = 0;
          void v.play().catch(() => {});
        } catch {
          /* ignore */
        }
      }
      return;
    }
    clipFinished();
  };

  /** The current film reached its last frame (or stalled): hold, open its box, or move on. */
  const clipFinished = () => {
    if (entered.current) return;
    if (stallTimer.current != null) {
      window.clearTimeout(stallTimer.current);
      stallTimer.current = null;
    }
    bedWantedRef.current = false;
    killAudioHard();
    const step = afterClip(clipIdxRef.current, planRef.current);
    if (step.kind !== "clip") {
      runStep(step, false);
      return;
    }
    if (holdTimer.current != null) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if (entered.current) return;
      goToClip(step.idx);
    }, HOLD_MS);
  };

  const showEnter = () => {
    if (atEndRef.current) return;
    atEndRef.current = true;
    bedWantedRef.current = false;
    enterArmedAt.current = Date.now() + ENTER_ARM_MS;
    setAtEnd(true);
  };

  const tryEnter = () => {
    if (!atEndRef.current || Date.now() < enterArmedAt.current) return;
    finish(true);
  };

  const runStep = (step: OpeningStep, fromGesture: boolean) => {
    if (entered.current) return;
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (step.kind === "clip") {
      goToClip(step.idx);
      return;
    }
    if (step.kind === "guide") {
      if (!PILGRIM_STEPS.some(s => s.id === CLIPS[step.idx]?.id)) {
        runStep(afterGuide(step.idx, planRef.current), fromGesture);
        return;
      }
      guideIdxRef.current = step.idx;
      guideArmedAt.current = Date.now() + GUIDE_ARM_MS;
      setGuideIdx(step.idx);
      return;
    }
    if (step.end === "gate") {
      finish(fromGesture);
      return;
    }
    const v = videoRef.current;
    const onCakeEnd = clipIdxRef.current === LAST_CLIP && !!v && (v.ended || endOnLoadRef.current);
    if (!onCakeEnd) {
      dissolveAudioOut();
      goToClip(LAST_CLIP, true);
    }
    showEnter();
  };

  const closeGuide = () => {
    guideIdxRef.current = null;
    setGuideIdx(null);
  };

  const skip = () => {
    if (planRef.current.guide) markPilgrimGuideSeen();
    closeGuide();
    runStep(skipTo(planRef.current), true);
  };

  /** The box's button: the next film starts in this gesture; after the cake, into the gate or home. */
  const onGuideNext = () => {
    const idx = guideIdxRef.current;
    if (idx == null || Date.now() < guideArmedAt.current) return;
    const step = afterGuide(idx, planRef.current);
    closeGuide();
    if (step.kind === "end") {
      markPilgrimGuideSeen();
      finish(true);
      return;
    }
    runStep(step, true);
  };

  const skipGuide = () => {
    if (guideIdxRef.current != null && Date.now() < guideArmedAt.current) return;
    markPilgrimGuideSeen();
    closeGuide();
    finish(true);
  };

  const unlock = () => {
    if (entered.current || unlockedRef.current || unlockingRef.current) return;
    unlockingRef.current = true;
    unlockedRef.current = true;
    setUnlocked(true);
    guardUntil.current = Date.now() + UNLOCK_GUARD_MS;
    skipAllowedAt.current = Date.now() + SKIP_GUARD_MS;

    const ctx = getClockAudio();
    if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
    if (ctx) {
      try {
        ensureAudioBus(ctx);
      } catch {
        /* ignore */
      }
    }

    goToClip(0);
    unlockingRef.current = false;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (entered.current) return;
    if (guideIdxRef.current != null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    if (!unlockedRef.current) {
      unlock();
      setNeedTap(false);
      return;
    }
    if (atEndRef.current) {
      tryEnter();
      return;
    }
    const ctx = getClockAudio();
    const file = fileBedRef.current;
    const fileOn = !!(file && !file.paused);
    const webOn = !!(bufferSrcRef.current && ctx && ctx.state === "running");
    if (bedWantedRef.current && !fileOn && !webOn) {
      if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
      setNeedTap(false);
      void playClipAudio(clipIdxRef.current, sessionRef.current);
      return;
    }
    if (Date.now() < skipAllowedAt.current) return;
    skip();
  };

  useEffect(() => {
    if (!unlocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter" && e.key !== " ") return;
      if (guideIdxRef.current != null) {
        if (e.key === "Escape") {
          e.preventDefault();
          skipGuide();
        }
        return;
      }
      if (atEndRef.current) {
        e.preventDefault();
        tryEnter();
        return;
      }
      if (Date.now() < skipAllowedAt.current) return;
      e.preventDefault();
      skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  useEffect(() => {
    playFileBed(CLIPS[0]!.audio);
    unlock();
    const retry = window.setInterval(() => {
      if (entered.current) return;
      const ctx = getClockAudio();
      const webOn = !!(bufferSrcRef.current && ctx && ctx.state === "running");
      if (webOn) return;
      const el = fileBedRef.current;
      if (!el || !el.paused || el.ended || !bedWantedRef.current) return;
      if (el.dataset.bed !== CLIPS[clipIdxRef.current]?.audio) return;
      void el.play().then(() => setNeedTap(false)).catch(() => {});
    }, 500);
    return () => window.clearInterval(retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ctx = getClockAudio();
      if (!ctx) return;
      for (const clip of CLIPS) {
        if (cancelled) return;
        try {
          await ensureBuffer(ctx, clip.audio);
        } catch {
          /* retry on play */
        }
      }
    })();
    return () => {
      cancelled = true;
      killAudioHard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const readyFallback = window.setTimeout(() => setVideoReady(true), 2200);
    return () => {
      clearTimeout(readyFallback);
      if (holdTimer.current != null) clearTimeout(holdTimer.current);
      if (stallTimer.current != null) clearTimeout(stallTimer.current);
      killAudioHard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (atEnd && !veilOn) enterRef.current?.focus({ preventScroll: true });
  }, [atEnd, veilOn]);

  useEffect(() => {
    if (guideIdx != null) ctaRef.current?.focus({ preventScroll: true });
  }, [guideIdx]);

  useEffect(() => {
    if (!needTap) skipAllowedAt.current = Math.max(skipAllowedAt.current, Date.now() + BEGIN_TO_SKIP_MS);
  }, [needTap]);

  const onCake = unlocked && clipIdx === LAST_CLIP;
  const guideStep = guideIdx != null ? PILGRIM_STEPS.find(s => s.id === CLIPS[guideIdx]?.id) : undefined;

  return (
    <div
      className="onyx-root"
      role="dialog"
      aria-label="Pneuma Mundi splash"
      onPointerDown={onPointerDown}
    >
      <div className="onyx-device onyx-splash-only">
        <div className="onyx-film onyx-film-graded">
          <video
            key={unlocked ? `clip-${clipIdx}-${videoKey}` : "preview"}
            ref={videoRef}
            autoPlay={!atEnd}
            muted
            playsInline
            preload="auto"
            src={filmSrc}
            poster={onCake ? CAKE_LAST_FRAME : undefined}
            className={videoReady ? "onyx-film-ready" : undefined}
            onLoadedData={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            onEnded={onVideoEnded}
          />
        </div>

        <div className={`onyx-dimmer${onCake ? " off" : ""}`} aria-hidden />

        <button
          ref={enterRef}
          type="button"
          className={`onyx-splash-enter${atEnd && !veilOn ? " on" : ""}`}
          tabIndex={atEnd ? 0 : -1}
          aria-hidden={!atEnd}
          onClick={tryEnter}
        >
          Enter
        </button>

        <div className="onyx-pilgrim-live" aria-live="polite">
          {guideStep ? (
            <section
              className={`onyx-pilgrim${guideStep.id === "void" ? " onyx-pilgrim-top" : ""}`}
              aria-labelledby="onyx-pilgrim-title"
              data-pilgrim-step={guideStep.step}
              onPointerDown={e => e.stopPropagation()}
            >
              {guideStep.step === 1 ? (
                <div className="onyx-pilgrim-intro">
                  <p className="onyx-pilgrim-intro-title">{PILGRIM_INTRO.title}</p>
                  <p>{PILGRIM_INTRO.body}</p>
                </div>
              ) : null}
              <p className="onyx-pilgrim-count">
                Step {guideStep.step} of {PILGRIM_STEPS.length}
              </p>
              <h2 id="onyx-pilgrim-title" className="onyx-pilgrim-title">{guideStep.title}</h2>
              <p className="onyx-pilgrim-label">Then</p>
              <p className="onyx-pilgrim-text">{guideStep.then}</p>
              <p className="onyx-pilgrim-label">Now</p>
              <p className="onyx-pilgrim-text">{guideStep.now}</p>
              <div className="onyx-pilgrim-actions">
                <button ref={ctaRef} type="button" className="onyx-pilgrim-cta" onClick={onGuideNext}>
                  {guideStep.cta}
                </button>
                <button type="button" className="onyx-pilgrim-skip" onClick={skipGuide}>
                  Skip the guide
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <p
          className={`onyx-splash-tap${needTap && videoReady && !veilOn ? " on" : ""}`}
          aria-hidden={!needTap}
        >
          Tap to begin
        </p>
        <p
          className={`onyx-splash-promise${needTap && videoReady && !veilOn ? " on" : ""}`}
          aria-hidden={!needTap}
        >
          The breath of the world, tuned to this moment. Know Thyself.
        </p>

        <p
          className={`onyx-splash-tap onyx-splash-skip${unlocked && !needTap && videoReady && !veilOn && !atEnd && guideIdx == null ? " on" : ""}`}
          aria-hidden={!unlocked || needTap || atEnd || guideIdx != null}
        >
          Tap to skip
        </p>

        <div
          className={`onyx-splash-veil${veilOn ? " on" : ""}`}
          aria-hidden
        />
      </div>
    </div>
  );
}
