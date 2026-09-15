"use client";

import { useEffect, useRef, useState } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { getClockAudio, resumeClockAudio } from "../../lib/clockSfx";

/**
 * Boot film sequence (muted picture; Web Audio unlock on first tap):
 *   A historical open → hold → B Pythia / priestess → hold → C stairs → access gate.
 * Further clips can append later. Opening soundtrack = decoded historical m4a
 * with 0→100% fade over 1.5s (iOS-safe). Later clips stay visual until we wire
 * their beds.
 */

const CLIPS = [
  `/pneuma-boot-historical.mp4?v=${DELPHI_BUILD}`,
  `/pneuma-boot-pythia.mp4?v=${DELPHI_BUILD}`,
  `/pneuma-boot-stairs.mp4?v=${DELPHI_BUILD}`,
] as const;

const CLIP_A_AUDIO = `/pneuma-boot-historical-audio.m4a?v=${DELPHI_BUILD}`;

const AUDIO_FADE_MS = 1500;
const END_HOLD_MS = 1500;
/** Three ~5s clips + holds + tap wait. */
const SAFETY_MS = 60_000;

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
  const audioBufRef = useRef<AudioBuffer | null>(null);
  const bufferSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioUnlocked = useRef(false);
  const unlocking = useRef(false);
  const [videoReady, setVideoReady] = useState(false);
  const [veilOn, setVeilOn] = useState(true);
  const [needTap, setNeedTap] = useState(true);

  const stopBootAudio = () => {
    try {
      bufferSrcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    bufferSrcRef.current = null;
    gainRef.current = null;
  };

  const finish = (fromGesture: boolean) => {
    if (entered.current) return;
    entered.current = true;
    stopBootAudio();
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

  const startBootAudioFade = async () => {
    const ctx = await resumeClockAudio();
    const buf = audioBufRef.current;
    if (!ctx || !buf) return false;

    stopBootAudio();
    const gain = ctx.createGain();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(1, t0 + AUDIO_FADE_MS / 1000);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.onended = () => {
      if (bufferSrcRef.current === src) bufferSrcRef.current = null;
    };
    src.start(0);
    bufferSrcRef.current = src;
    gainRef.current = gain;
    return true;
  };

  const unlockAndRestartOpen = async () => {
    if (entered.current || audioUnlocked.current || unlocking.current) return;
    unlocking.current = true;

    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    phaseRef.current = "a";

    const v = videoRef.current;
    if (!v) {
      unlocking.current = false;
      return;
    }

    if (!audioBufRef.current) {
      try {
        const ctx = getClockAudio() ?? (await resumeClockAudio());
        if (ctx) {
          const res = await fetch(CLIP_A_AUDIO);
          audioBufRef.current = await ctx.decodeAudioData(await res.arrayBuffer());
        }
      } catch {
        /* unlock path retries play anyway */
      }
    }

    const ok = await startBootAudioFade();
    if (!ok) {
      unlocking.current = false;
      return;
    }

    audioUnlocked.current = true;
    setNeedTap(false);
    setVeilOn(false);
    setVideoReady(true);

    if (!v.src.includes("pneuma-boot-historical")) {
      v.src = CLIPS[0];
      await new Promise<void>(resolve => {
        const done = () => {
          v.removeEventListener("loadeddata", done);
          resolve();
        };
        v.addEventListener("loadeddata", done);
        v.load();
      });
    }

    try {
      v.currentTime = 0;
    } catch {
      /* ignore */
    }
    playMutedVideo(v);
    unlocking.current = false;
  };

  const onRootPointer = (e: React.PointerEvent) => {
    if (entered.current) return;
    e.preventDefault();
    if (!audioUnlocked.current) {
      void unlockAndRestartOpen();
      return;
    }
    finish(true);
  };

  const cueClip = (next: "b" | "c", src: string) => {
    if (entered.current) return;
    phaseRef.current = next;
    if (next === "b") stopBootAudio();
    const v = videoRef.current;
    if (!v) {
      finish(false);
      return;
    }

    setVeilOn(true);
    setVideoReady(false);

    const onReady = () => {
      v.removeEventListener("loadeddata", onReady);
      if (entered.current) return;
      setVideoReady(true);
      window.setTimeout(() => {
        if (!entered.current) setVeilOn(false);
      }, 120);
      playMutedVideo(v);
    };

    v.pause();
    v.src = src;
    v.load();
    v.addEventListener("loadeddata", onReady);
  };

  const onClipEnded = () => {
    if (entered.current) return;
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
      stopBootAudio();
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        cueClip("b", CLIPS[1]);
      }, END_HOLD_MS);
      return;
    }
    if (phaseRef.current === "b") {
      phaseRef.current = "hold-bc";
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        cueClip("c", CLIPS[2]);
      }, END_HOLD_MS);
      return;
    }
    if (phaseRef.current === "c") finish(false);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.src = CLIPS[0];
    playMutedVideo(v);

    let cancelled = false;
    (async () => {
      try {
        const ctx = getClockAudio();
        if (!ctx) return;
        const res = await fetch(CLIP_A_AUDIO);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        if (!cancelled) audioBufRef.current = buf;
      } catch {
        /* unlock path will retry */
      }
    })();

    return () => {
      cancelled = true;
      stopBootAudio();
    };
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
      stopBootAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="onyx-root"
      role="dialog"
      aria-label="Pneuma Mundi splash"
      onPointerDown={onRootPointer}
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
