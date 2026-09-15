"use client";

import { useEffect, useRef, useState } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";

/**
 * Boot: black → historical open (audio 0→100% / 1.5s) → end hold →
 * Pneuma Mundi title film → access gate.
 *
 * Cold loads usually block unmuted autoplay. We start the picture muted,
 * then unlock sound on the first tap (restart clip A + fade) instead of
 * skipping. A later tap still skips the whole sequence.
 */

const CLIP_A = `/pneuma-boot-historical.mp4?v=${DELPHI_BUILD}`;
/** Existing title plate that carries “Pneuma Mundi” in-frame. */
const CLIP_B = `/pneuma-intro.mp4?v=${DELPHI_BUILD}`;

const AUDIO_FADE_MS = 1500;
/** Hold last frame of clip A before cueing clip B. */
const END_HOLD_MS = 1500;
const SAFETY_MS = 22_000;

function rampVolume(
  video: HTMLVideoElement,
  from: number,
  to: number,
  ms: number,
  cancel: { cancelled: boolean },
) {
  const lo = Math.max(0, Math.min(1, from));
  const hi = Math.max(0, Math.min(1, to));
  video.volume = lo;
  const start = performance.now();
  const step = (now: number) => {
    if (cancel.cancelled) return;
    const t = Math.min(1, (now - start) / ms);
    video.volume = lo + (hi - lo) * t;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function OnyxSplash({
  onEnter,
  onPrimeAccess,
}: {
  onEnter: () => void;
  /** Sync call from the tap handler — must not be deferred past the gesture. */
  onPrimeAccess?: () => void;
}) {
  const entered = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const phaseRef = useRef<"a" | "hold" | "b">("a");
  const fadeCancel = useRef({ cancelled: false });
  const holdTimer = useRef<number | null>(null);
  /** True until unmuted playback has been granted (autoplay or gesture). */
  const audioUnlocked = useRef(false);
  const [videoReady, setVideoReady] = useState(false);
  const [veilOn, setVeilOn] = useState(true);

  const finish = (fromGesture: boolean) => {
    if (entered.current) return;
    entered.current = true;
    fadeCancel.current.cancelled = true;
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

  const playWithAudioFade = (
    v: HTMLVideoElement,
    fadeIn: boolean,
    opts?: { forceMuted?: boolean },
  ) => {
    fadeCancel.current.cancelled = true;
    fadeCancel.current = { cancelled: false };
    const cancel = fadeCancel.current;

    v.playsInline = true;

    const startMuted = () => {
      v.muted = true;
      v.volume = 1;
      void v.play().catch(() => {
        /* still reveal once a frame is ready */
      });
    };

    if (opts?.forceMuted) {
      startMuted();
      return;
    }

    v.muted = false;
    v.volume = fadeIn ? 0 : 1;

    void v
      .play()
      .then(() => {
        if (cancel.cancelled) return;
        audioUnlocked.current = true;
        if (fadeIn) rampVolume(v, 0, 1, AUDIO_FADE_MS, cancel);
      })
      .catch(startMuted);
  };

  /** First user gesture: restart open clip with audible fade (browser unlock). */
  const unlockAudioFromGesture = () => {
    const v = videoRef.current;
    if (!v || entered.current || audioUnlocked.current) return;

    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }

    phaseRef.current = "a";
    fadeCancel.current.cancelled = true;
    fadeCancel.current = { cancelled: false };
    const cancel = fadeCancel.current;

    setVeilOn(false);
    setVideoReady(true);

    const beginAudible = () => {
      v.removeEventListener("loadeddata", beginAudible);
      if (entered.current) return;
      v.currentTime = 0;
      v.muted = false;
      v.volume = 0;
      void v
        .play()
        .then(() => {
          if (cancel.cancelled) return;
          audioUnlocked.current = true;
          rampVolume(v, 0, 1, AUDIO_FADE_MS, cancel);
        })
        .catch(() => {
          /* still blocked — leave muted picture running */
          v.muted = true;
          v.volume = 1;
          void v.play().catch(() => {});
        });
    };

    if (!v.src.includes("pneuma-boot-historical")) {
      v.src = CLIP_A;
      v.load();
      v.addEventListener("loadeddata", beginAudible);
      return;
    }

    beginAudible();
  };

  const onRootPointer = () => {
    if (entered.current) return;
    if (!audioUnlocked.current && phaseRef.current !== "b") {
      unlockAudioFromGesture();
      return;
    }
    finish(true);
  };

  const cueClipB = () => {
    if (entered.current || phaseRef.current === "b") return;
    phaseRef.current = "b";
    const v = videoRef.current;
    if (!v) {
      finish(false);
      return;
    }

    setVeilOn(true);
    setVideoReady(false);
    fadeCancel.current.cancelled = true;

    const onReady = () => {
      v.removeEventListener("loadeddata", onReady);
      if (entered.current) return;
      setVideoReady(true);
      window.setTimeout(() => {
        if (!entered.current) setVeilOn(false);
      }, 120);
      if (audioUnlocked.current) {
        playWithAudioFade(v, true);
      } else {
        playWithAudioFade(v, false, { forceMuted: true });
      }
    };

    v.pause();
    v.src = CLIP_B;
    v.load();
    v.addEventListener("loadeddata", onReady);
  };

  const onClipEnded = () => {
    if (entered.current) return;
    if (phaseRef.current === "a") {
      phaseRef.current = "hold";
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = null;
        cueClipB();
      }, END_HOLD_MS);
      return;
    }
    if (phaseRef.current === "b") finish(false);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.src = CLIP_A;
    // Prefer audible open; most cold browsers reject this and we fall muted
    // until the first tap unlocks (see onRootPointer).
    playWithAudioFade(v, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!videoReady) return;
    const t = window.setTimeout(() => {
      setVeilOn(false);
    }, 180);
    return () => clearTimeout(t);
  }, [videoReady]);

  useEffect(() => {
    const readyFallback = window.setTimeout(() => setVideoReady(true), 2200);
    const safety = window.setTimeout(() => finish(false), SAFETY_MS);
    return () => {
      clearTimeout(readyFallback);
      clearTimeout(safety);
      if (holdTimer.current != null) clearTimeout(holdTimer.current);
      fadeCancel.current.cancelled = true;
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

        <div
          className={`onyx-splash-veil${veilOn ? " on" : ""}`}
          aria-hidden
        />
      </div>
    </div>
  );
}
