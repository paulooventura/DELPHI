"use client";

import { useEffect, useRef, useState } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { getClockAudio, resumeClockAudio } from "../../lib/clockSfx";
import {
  AUDIO_BUS,
  connectClipWithTail,
  ensureAudioBus,
  fadeIn,
  fadeOut,
} from "../../lib/audioBus";

/**
 * Boot film sequence (muted picture; Web Audio unlock on first tap):
 *   A historical → B Pythia → C stairs → Allow gate (void film).
 * Each clip plays ONLY its own soundtrack through AudioBus splash channel,
 * with fade-in + delay/reverb dissolve on end — never overlapping another clip.
 *
 * Mobile: first tap resumes AudioContext in the gesture turn. Visual unlock
 * does not wait on audio decode. Only one gesture handler (pointerdown) so
 * touch+click cannot unlock then immediately skip the full sequence.
 */

type ClipDef = { video: string; audio: string };

const CLIPS: readonly ClipDef[] = [
  {
    video: `/pneuma-boot-historical.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-historical-audio.m4a?v=${DELPHI_BUILD}`,
  },
  {
    video: `/pneuma-boot-pythia.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-pythia-audio.m4a?v=${DELPHI_BUILD}`,
  },
  {
    video: `/pneuma-boot-stairs.mp4?v=${DELPHI_BUILD}`,
    audio: `/pneuma-boot-stairs-audio.m4a?v=${DELPHI_BUILD}`,
  },
] as const;

const END_HOLD_MS = 1500;
const SAFETY_MS = 75_000;
/** After unlock, ignore skip taps (ghost click) and spurious ended events. */
const UNLOCK_GUARD_MS = 900;

type Phase = "a" | "hold-ab" | "b" | "hold-bc" | "c";

export function OnyxSplash({
  onEnter,
  onPrimeAccess,
}: {
  onEnter: () => void;
  onPrimeAccess?: () => void;
}) {
  const entered = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const phaseRef = useRef<Phase>("a");
  const holdTimer = useRef<number | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const bufferSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const dissolveRef = useRef<((onDone?: () => void) => void) | null>(null);
  const audioUnlocked = useRef(false);
  const unlocking = useRef(false);
  /** Ignore finish() / onEnded until this timestamp (ms). */
  const guardUntil = useRef(0);
  const playingClipIdx = useRef(0);
  const [videoReady, setVideoReady] = useState(false);
  const [veilOn, setVeilOn] = useState(true);
  const [needTap, setNeedTap] = useState(true);

  const stopBootAudio = (hard = false) => {
    const dissolve = dissolveRef.current;
    dissolveRef.current = null;
    if (!hard && dissolve) {
      dissolve(() => {
        try {
          bufferSrcRef.current?.stop();
        } catch {
          /* already stopped */
        }
        bufferSrcRef.current = null;
      });
      return;
    }
    try {
      bufferSrcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    bufferSrcRef.current = null;
    fadeOut("splash", AUDIO_BUS.CLIP_FADE_OUT_MS);
  };

  const finish = (fromGesture: boolean) => {
    if (entered.current) return;
    entered.current = true;
    stopBootAudio(false);
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
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
    void v.play().catch(() => {});
  };

  const ensureClipBuffer = async (ctx: AudioContext, url: string) => {
    const hit = audioCache.current.get(url);
    if (hit) return hit;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`audio fetch ${res.status}`);
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    audioCache.current.set(url, buf);
    return buf;
  };

  /** Play ONLY this clip's audio — never blocks visual progress. */
  const startClipAudio = async (clipIdx: number) => {
    const clip = CLIPS[clipIdx];
    if (!clip) return false;
    const ctx = getClockAudio() ?? (await resumeClockAudio());
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }

    stopBootAudio(true);
    ensureAudioBus(ctx);

    let buf: AudioBuffer;
    try {
      buf = await ensureClipBuffer(ctx, clip.audio);
    } catch {
      return false;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const { dry, stopDissolve } = connectClipWithTail(ctx, src);
    const t0 = ctx.currentTime;
    dry.gain.setValueAtTime(AUDIO_BUS.SILENCE, t0);
    dry.gain.exponentialRampToValueAtTime(1, t0 + AUDIO_BUS.CLIP_FADE_IN_MS / 1000);
    fadeIn("splash", AUDIO_BUS.CLIP_FADE_IN_MS, 1);
    src.onended = () => {
      if (bufferSrcRef.current === src) {
        bufferSrcRef.current = null;
        stopDissolve();
      }
    };
    src.start(0);
    bufferSrcRef.current = src;
    dissolveRef.current = stopDissolve;
    playingClipIdx.current = clipIdx;
    return true;
  };

  /**
   * First tap: unlock + force-reload clip A from t=0 with its audio.
   * Full sequence A→B→C must then play through; skip taps are guarded briefly.
   */
  const unlockAndRestartOpen = () => {
    if (entered.current || audioUnlocked.current || unlocking.current) return;
    unlocking.current = true;
    guardUntil.current = Date.now() + UNLOCK_GUARD_MS;

    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    phaseRef.current = "a";

    const ctx = getClockAudio();
    if (ctx?.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
    if (ctx) {
      try {
        ensureAudioBus(ctx);
      } catch {
        /* ignore */
      }
    }

    audioUnlocked.current = true;
    setNeedTap(false);
    setVeilOn(false);
    setVideoReady(true);

    const v = videoRef.current;
    if (!v) {
      unlocking.current = false;
      return;
    }

    void startClipAudio(0);

    // Always hard-reload A so we never inherit an already-ended / mid-clip state.
    const onReady = () => {
      v.removeEventListener("loadeddata", onReady);
      if (entered.current) return;
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
      playMutedVideo(v);
      unlocking.current = false;
      // Extend guard until playback is clearly underway.
      guardUntil.current = Date.now() + UNLOCK_GUARD_MS;
    };
    v.pause();
    v.src = CLIPS[0]!.video;
    v.load();
    v.addEventListener("loadeddata", onReady);
    window.setTimeout(() => {
      if (unlocking.current) onReady();
    }, 1500);
  };

  const onBeginGesture = (e: React.PointerEvent) => {
    if (entered.current) return;
    // Only primary finger / mouse — ignore hover synthetics.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();

    if (!audioUnlocked.current) {
      unlockAndRestartOpen();
      return;
    }

    // Ghost click after unlock must not skip the whole boot sequence.
    if (Date.now() < guardUntil.current) return;

    // After unlock, a later tap still skips — but only once A–C are underway
    // and the user is clearly asking to leave (not the unlock echo).
    finish(true);
  };

  const cueClip = (next: "b" | "c", clipIdx: number) => {
    if (entered.current) return;
    phaseRef.current = next;
    const v = videoRef.current;
    if (!v) {
      finish(false);
      return;
    }

    setVeilOn(true);
    setVideoReady(false);
    guardUntil.current = Date.now() + 400;

    const onReady = () => {
      v.removeEventListener("loadeddata", onReady);
      if (entered.current) return;
      setVideoReady(true);
      window.setTimeout(() => {
        if (!entered.current) setVeilOn(false);
      }, 120);
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
      playMutedVideo(v);
      if (audioUnlocked.current) void startClipAudio(clipIdx);
    };

    v.pause();
    v.src = CLIPS[clipIdx]!.video;
    v.load();
    v.addEventListener("loadeddata", onReady);
  };

  const onClipEnded = () => {
    if (entered.current) return;
    // Spurious ended right after seek/reload — keep playing A.
    if (Date.now() < guardUntil.current) {
      const v = videoRef.current;
      if (v && phaseRef.current === "a" && audioUnlocked.current) {
        try {
          v.currentTime = 0;
          playMutedVideo(v);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (phaseRef.current === "a") {
      if (!audioUnlocked.current) {
        try {
          const v = videoRef.current;
          if (v) {
            v.currentTime = 0;
            playMutedVideo(v);
          }
        } catch {
          /* ignore */
        }
        return;
      }
      phaseRef.current = "hold-ab";
      stopBootAudio(false);
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        cueClip("b", 1);
      }, END_HOLD_MS);
      return;
    }
    if (phaseRef.current === "b") {
      phaseRef.current = "hold-bc";
      stopBootAudio(false);
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        cueClip("c", 2);
      }, END_HOLD_MS);
      return;
    }
    if (phaseRef.current === "c") {
      stopBootAudio(false);
      finish(false);
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.src = CLIPS[0]!.video;
    playMutedVideo(v);

    let cancelled = false;
    (async () => {
      try {
        const ctx = getClockAudio();
        if (!ctx) return;
        for (const clip of CLIPS) {
          if (cancelled) return;
          try {
            await ensureClipBuffer(ctx, clip.audio);
          } catch {
            /* unlock path retries */
          }
        }
      } catch {
        /* unlock path will retry */
      }
    })();

    return () => {
      cancelled = true;
      stopBootAudio(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!videoReady) return;
    const t = window.setTimeout(() => setVeilOn(false), 180);
    return () => clearTimeout(t);
  }, [videoReady]);

  useEffect(() => {
    const readyFallback = window.setTimeout(() => setVideoReady(true), 2200);
    const safety = window.setTimeout(() => finish(false), SAFETY_MS);
    return () => {
      clearTimeout(readyFallback);
      clearTimeout(safety);
      if (holdTimer.current != null) clearTimeout(holdTimer.current);
      stopBootAudio(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="onyx-root"
      role="dialog"
      aria-label="Pneuma Mundi splash"
      onPointerDown={onBeginGesture}
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
            onPlaying={() => setVideoReady(true)}
            onEnded={onClipEnded}
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
