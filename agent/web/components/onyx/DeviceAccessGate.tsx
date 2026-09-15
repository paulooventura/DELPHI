"use client";

/**
 * After splash, once per app open until Allow access is tapped.
 * Backdrop: Paulo’s locked-off sacred-void film (replaces still), with its
 * own dissolve soundtrack via AudioBus — never hard-cut.
 */

import { useEffect, useRef } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { getClockAudio, resumeClockAudio } from "../../lib/clockSfx";
import {
  AUDIO_BUS,
  connectClipWithTail,
  ensureAudioBus,
  fadeIn,
  fadeOut,
} from "../../lib/audioBus";

const VOID_VIDEO = `/pneuma-boot-void.mp4?v=${DELPHI_BUILD}`;
const VOID_AUDIO = `/pneuma-boot-void-audio.m4a?v=${DELPHI_BUILD}`;

export function DeviceAccessGate({
  onAllow,
  busy = false,
}: {
  onAllow: () => void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const dissolveRef = useRef<((onDone?: () => void) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      v.loop = true;
      void v.play().catch(() => {});
    }

    (async () => {
      try {
        const ctx = (await resumeClockAudio()) ?? getClockAudio();
        if (!ctx || cancelled) return;
        ensureAudioBus(ctx);
        const res = await fetch(VOID_AUDIO);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        if (cancelled) return;

        // Ensure splash channel is clear before void bed.
        fadeOut("splash", 80);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const { dry, stopDissolve } = connectClipWithTail(ctx, src);
        const t0 = ctx.currentTime;
        dry.gain.setValueAtTime(AUDIO_BUS.SILENCE, t0);
        dry.gain.exponentialRampToValueAtTime(1, t0 + AUDIO_BUS.CLIP_FADE_IN_MS / 1000);
        fadeIn("splash", AUDIO_BUS.CLIP_FADE_IN_MS, 1);
        src.onended = () => {
          if (srcRef.current === src) {
            srcRef.current = null;
            stopDissolve();
          }
        };
        src.start(0);
        srcRef.current = src;
        dissolveRef.current = stopDissolve;
      } catch {
        /* visual gate still works without bed */
      }
    })();

    return () => {
      cancelled = true;
      const dissolve = dissolveRef.current;
      dissolveRef.current = null;
      if (dissolve) {
        dissolve(() => {
          try {
            srcRef.current?.stop();
          } catch {
            /* ignore */
          }
          srcRef.current = null;
        });
      } else {
        try {
          srcRef.current?.stop();
        } catch {
          /* ignore */
        }
        srcRef.current = null;
        fadeOut("splash", AUDIO_BUS.CLIP_FADE_OUT_MS);
      }
    };
  }, []);

  return (
    <div className="onyx-root" role="dialog" aria-label="Allow location and sensors">
      <div className="onyx-device onyx-access-gate">
        <button
          type="button"
          className={`onyx-access-cta${busy ? " busy" : ""}`}
          disabled={busy}
          onClick={onAllow}
        >
          <video
            ref={videoRef}
            className="onyx-access-backdrop"
            src={VOID_VIDEO}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden
          />
          <span className="onyx-access-cta-label">
            {busy ? "Requesting…" : "Allow access"}
          </span>
        </button>
      </div>
    </div>
  );
}
