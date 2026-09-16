"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { getClockAudio } from "../../lib/clockSfx";
import {
  AUDIO_BUS,
  audioBusInput,
  ensureAudioBus,
  fadeIn,
  fadeOut,
} from "../../lib/audioBus";

/**
 * Boot: Historical → Pythia → stairs → Allow gate.
 *
 * Hard rules:
 * - Videos are silent files (no AAC). Only matching Web Audio beds play sound.
 * - Exactly one clip at a time: kill prior bed hard before the next starts.
 * - Audio starts only after THAT clip’s muted video `play()` resolves.
 * - First tap unlocks; no mid-sequence skip (ghost clicks ignored).
 */

type ClipDef = { id: string; video: string; audio: string };

const CLIPS: readonly ClipDef[] = [
  {
    id: "historical",
    video: `/pneuma-boot-historical.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-historical-audio.m4a?v=${DELPHI_BUILD}`,
  },
  {
    id: "pythia",
    video: `/pneuma-boot-pythia.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-pythia-audio.m4a?v=${DELPHI_BUILD}`,
  },
  {
    id: "stairs",
    video: `/pneuma-boot-stairs.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-stairs-audio.m4a?v=${DELPHI_BUILD}`,
  },
] as const;

const HOLD_MS = 600;
const SAFETY_MS = 90_000;
const UNLOCK_GUARD_MS = 1000;
const PREVIEW_SRC = `${CLIPS[0]!.video}&preview=1`;

export function OnyxSplash({
  onEnter,
  onPrimeAccess,
}: {
  onEnter: () => void;
  onPrimeAccess?: () => void;
}) {
  const entered = useRef(false);
  const unlockedRef = useRef(false);
  const unlockingRef = useRef(false);
  const guardUntil = useRef(0);
  const audioGen = useRef(0);
  const clipIdxRef = useRef(0);
  const bufferSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const holdTimer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  /** Invalidates stale load/play/audio handlers. */
  const sessionRef = useRef(0);

  const [clipIdx, setClipIdx] = useState(0);
  const [videoKey, setVideoKey] = useState(0);
  const [filmSrc, setFilmSrc] = useState(PREVIEW_SRC);
  const [videoReady, setVideoReady] = useState(false);
  const [veilOn, setVeilOn] = useState(true);
  const [needTap, setNeedTap] = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  const killAudioHard = () => {
    audioGen.current += 1;
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

  /** Start ONLY forIdx’s dry bed — never another clip’s. */
  const playClipAudio = async (forIdx: number, session: number) => {
    const clip = CLIPS[forIdx];
    if (!clip || entered.current) return;
    if (sessionRef.current !== session) return;
    if (clipIdxRef.current !== forIdx) return;

    killAudioHard();
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
      entered.current
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
    src.start(0);
    bufferSrcRef.current = src;
    dryGainRef.current = dry;
  };

  /** Remount video on this clip’s silent mp4; audio follows after play(). */
  const goToClip = (idx: number) => {
    if (entered.current || idx < 0 || idx >= CLIPS.length) return;
    const clip = CLIPS[idx];
    if (!clip) return;

    killAudioHard();
    const session = ++sessionRef.current;
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

    killAudioHard();
    const next = clipIdxRef.current + 1;
    if (holdTimer.current != null) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if (entered.current) return;
      if (next >= CLIPS.length) {
        finish(false);
        return;
      }
      goToClip(next);
    }, HOLD_MS);
  };

  const unlock = () => {
    if (entered.current || unlockedRef.current || unlockingRef.current) return;
    unlockingRef.current = true;
    unlockedRef.current = true;
    setUnlocked(true);
    setNeedTap(false);
    guardUntil.current = Date.now() + UNLOCK_GUARD_MS;

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
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    if (!unlockedRef.current) unlock();
    // No mid-sequence skip — full A→B→C only.
  };

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
    const safety = window.setTimeout(() => finish(false), SAFETY_MS);
    return () => {
      clearTimeout(readyFallback);
      clearTimeout(safety);
      if (holdTimer.current != null) clearTimeout(holdTimer.current);
      killAudioHard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="onyx-root"
      role="dialog"
      aria-label="Pneuma Mundi splash"
      onPointerDown={onPointerDown}
    >
      <div className="onyx-device onyx-splash-only">
        <div className="onyx-film">
          <video
            key={unlocked ? `clip-${clipIdx}-${videoKey}` : "preview"}
            ref={videoRef}
            autoPlay
            muted
            playsInline
            preload="auto"
            src={filmSrc}
            className={videoReady ? "onyx-film-ready" : undefined}
            onLoadedData={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            onEnded={onVideoEnded}
          />
        </div>

        <div className="onyx-grade" aria-hidden />
        <div className="onyx-tint" aria-hidden />
        <div className="onyx-dimmer" aria-hidden />

        <p
          className={`onyx-splash-tap${needTap && videoReady && !veilOn ? " on" : ""}`}
          aria-hidden={!needTap}
        >
          Tap to begin
        </p>

        <div
          className={`onyx-splash-veil${veilOn ? " on" : ""}`}
          aria-hidden
        />
      </div>
    </div>
  );
}
