"use client";

import { useEffect, useRef, useState } from "react";
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
 * Hard rule: exactly one clip’s muted video + that clip’s Web Audio bed.
 * No delay-tail bleed between clips. No mid-sequence skip tap.
 * Audio starts only after that clip’s video fires `playing`.
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

const HOLD_MS = 700;
const SAFETY_MS = 90_000;
const UNLOCK_GUARD_MS = 800;

export function OnyxSplash({
  onEnter,
  onPrimeAccess,
}: {
  onEnter: () => void;
  onPrimeAccess?: () => void;
}) {
  const entered = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clipIdxRef = useRef(0);
  const unlockedRef = useRef(false);
  const unlockingRef = useRef(false);
  const guardUntil = useRef(0);
  /** Bumps on every kill — stale async audio must bail. */
  const audioGen = useRef(0);
  /** Clip index that may start audio on the next `playing` event. */
  const pendingAudioIdx = useRef<number | null>(null);
  const bufferSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const holdTimer = useRef<number | null>(null);

  const [videoReady, setVideoReady] = useState(false);
  const [veilOn, setVeilOn] = useState(true);
  const [needTap, setNeedTap] = useState(true);

  /** Immediate stop — no delay send, no bleed into the next clip. */
  const killAudioHard = () => {
    audioGen.current += 1;
    pendingAudioIdx.current = null;
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
    fadeOut("splash", 30);
  };

  /** Soft fade only when leaving splash for the Allow gate. */
  const dissolveAudioOut = () => {
    const gen = audioGen.current;
    const dry = dryGainRef.current;
    const src = bufferSrcRef.current;
    if (!dry || !src) {
      killAudioHard();
      return;
    }
    const ctx = dry.context;
    const t = ctx.currentTime;
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
    pendingAudioIdx.current = null;
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

  const playMutedVideo = (v: HTMLVideoElement) => {
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    return v.play().catch(() => {});
  };

  const ensureBuffer = async (ctx: AudioContext, url: string) => {
    const hit = audioCache.current.get(url);
    if (hit) return hit;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`audio ${res.status}`);
    const copy = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(copy.slice(0));
    audioCache.current.set(url, buf);
    return buf;
  };

  /**
   * Start ONLY this clip’s dry audio into the splash bus.
   * No delay/reverb send while sequencing (avoids cross-clip bleed).
   */
  const playClipAudio = async (clipIdx: number) => {
    const clip = CLIPS[clipIdx];
    if (!clip || entered.current) return;

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
    if (audioGen.current !== gen || entered.current) return;

    ensureAudioBus(ctx);
    let buf: AudioBuffer;
    try {
      buf = await ensureBuffer(ctx, clip.audio);
    } catch {
      return;
    }
    if (audioGen.current !== gen || entered.current) return;
    if (clipIdxRef.current !== clipIdx) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const dry = ctx.createGain();
    dry.gain.value = AUDIO_BUS.SILENCE;
    src.connect(dry);
    dry.connect(audioBusInput("splash", ctx));

    const t0 = ctx.currentTime;
    dry.gain.setValueAtTime(AUDIO_BUS.SILENCE, t0);
    dry.gain.exponentialRampToValueAtTime(
      1,
      t0 + AUDIO_BUS.CLIP_FADE_IN_MS / 1000,
    );
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

  /** Load one clip’s video; arm audio for that index on next `playing`. */
  const loadClip = (clipIdx: number) => {
    const clip = CLIPS[clipIdx];
    const v = videoRef.current;
    if (!clip || !v || entered.current) return;

    clipIdxRef.current = clipIdx;
    killAudioHard();
    pendingAudioIdx.current = clipIdx;
    setVeilOn(true);
    setVideoReady(false);
    guardUntil.current = Date.now() + UNLOCK_GUARD_MS;

    const onReady = () => {
      v.removeEventListener("loadeddata", onReady);
      if (entered.current || clipIdxRef.current !== clipIdx) return;
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
      setVideoReady(true);
      window.setTimeout(() => {
        if (!entered.current && clipIdxRef.current === clipIdx) setVeilOn(false);
      }, 90);
      void playMutedVideo(v);
    };

    v.pause();
    // Unique URL so ended / cached state cannot stick across clips.
    v.src = `${clip.video}&i=${clipIdx}&t=${Date.now()}`;
    v.load();
    v.addEventListener("loadeddata", onReady);
  };

  const advanceAfterHold = (nextIdx: number) => {
    if (entered.current) return;
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
    }
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if (entered.current) return;
      if (nextIdx >= CLIPS.length) {
        finish(false);
        return;
      }
      loadClip(nextIdx);
    }, HOLD_MS);
  };

  const onVideoPlaying = () => {
    setVideoReady(true);
    if (!unlockedRef.current || entered.current) return;
    const pending = pendingAudioIdx.current;
    if (pending == null) return;
    if (pending !== clipIdxRef.current) return;
    pendingAudioIdx.current = null;
    void playClipAudio(pending);
  };

  const onVideoEnded = () => {
    if (entered.current) return;

    // Pre-unlock mute preview of A — loop.
    if (!unlockedRef.current) {
      const v = videoRef.current;
      if (v) {
        try {
          v.currentTime = 0;
          void playMutedVideo(v);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    // Spurious ended right after seek/reload.
    if (Date.now() < guardUntil.current) {
      const v = videoRef.current;
      if (v) {
        try {
          v.currentTime = 0;
          void playMutedVideo(v);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    killAudioHard();
    advanceAfterHold(clipIdxRef.current + 1);
  };

  const unlock = () => {
    if (entered.current || unlockedRef.current || unlockingRef.current) return;
    unlockingRef.current = true;
    unlockedRef.current = true;
    guardUntil.current = Date.now() + UNLOCK_GUARD_MS;
    setNeedTap(false);
    setVeilOn(false);

    const ctx = getClockAudio();
    if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
    if (ctx) {
      try {
        ensureAudioBus(ctx);
      } catch {
        /* ignore */
      }
    }

    // Always restart Historical from frame 0; audio waits for `playing`.
    loadClip(0);
    unlockingRef.current = false;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (entered.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    if (!unlockedRef.current) {
      unlock();
      return;
    }
    // Full A→B→C — no mid-sequence skip.
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.src = CLIPS[0]!.video;
    void playMutedVideo(v);

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
    if (!videoReady) return;
    const t = window.setTimeout(() => setVeilOn(false), 160);
    return () => clearTimeout(t);
  }, [videoReady]);

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
            ref={videoRef}
            autoPlay
            muted
            playsInline
            preload="auto"
            className={videoReady ? "onyx-film-ready" : undefined}
            onLoadedData={() => setVideoReady(true)}
            onPlaying={onVideoPlaying}
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
