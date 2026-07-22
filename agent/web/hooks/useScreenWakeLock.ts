"use client";

import { useEffect, useRef } from "react";
import { requestWakeLock, type WakeLockSentinelLike } from "../lib/deviceSensors";

/**
 * Keeps the screen awake while the app is open (mobile especially).
 * Uses the Screen Wake Lock API when available, with a silent looping
 * video fallback for Safari / older WebViews that lack wakeLock.
 * Re-acquires after visibility returns and after the first user gesture.
 */
export function useScreenWakeLock(enabled = true) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wantedRef = useRef(enabled);

  useEffect(() => {
    wantedRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let cancelled = false;

    function ensureVideoFallback() {
      if (typeof document === "undefined") return null;
      if (videoRef.current) return videoRef.current;
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.style.cssText =
        "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0;";
      // Silent 1×1 canvas stream — keeps some mobile browsers from sleeping
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, 1, 1);
        }
        const stream = canvas.captureStream?.(1);
        if (stream) {
          video.srcObject = stream;
        }
      } catch {
        /* captureStream unavailable — wakeLock-only path */
      }
      document.body.appendChild(video);
      videoRef.current = video;
      return video;
    }

    async function startVideoFallback() {
      const video = ensureVideoFallback();
      if (!video?.srcObject) return;
      try {
        await video.play();
      } catch {
        /* needs gesture — retry on pointerdown */
      }
    }

    async function acquire() {
      if (cancelled || !wantedRef.current) return;

      if (!sentinelRef.current) {
        const sentinel = await requestWakeLock();
        if (cancelled) {
          void sentinel?.release?.();
          return;
        }
        if (sentinel) {
          sentinelRef.current = sentinel;
          sentinel.addEventListener("release", () => {
            if (sentinelRef.current === sentinel) sentinelRef.current = null;
          });
          return;
        }
      }

      if (!sentinelRef.current) {
        await startVideoFallback();
      }
    }

    void acquire();

    const onVis = () => {
      if (document.visibilityState === "visible" && wantedRef.current) void acquire();
    };
    const onGesture = () => {
      if (wantedRef.current) void acquire();
    };

    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("pointerdown", onGesture, { passive: true });
    document.addEventListener("touchstart", onGesture, { passive: true });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("touchstart", onGesture);
      const s = sentinelRef.current;
      sentinelRef.current = null;
      void s?.release?.();
      const video = videoRef.current;
      videoRef.current = null;
      if (video) {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch {
          /* ignore */
        }
        video.remove();
      }
    };
  }, [enabled]);
}
