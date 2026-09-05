"use client";

import { useEffect, useRef } from "react";
import { requestWakeLock, type WakeLockSentinelLike } from "../lib/deviceSensors";

/**
 * Keep the phone screen awake while Delphi is open and visible.
 * Screen Wake Lock + silent looping video + Capacitor KeepAwake (native shell).
 * Re-acquires after focus, visibility, lock release, and on a heartbeat.
 *
 * iOS will still suspend if the user leaves Delphi or locks the device —
 * we only hold the display while the app is in the foreground.
 */
export function useScreenWakeLock(enabled = true) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wantedRef = useRef(enabled);
  const nativeOnRef = useRef(false);

  useEffect(() => {
    wantedRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let cancelled = false;
    let heartbeat = 0;

    async function nativeKeepAwake(on: boolean) {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const mod = await import("@capacitor-community/keep-awake").catch(() => null);
        if (!mod?.KeepAwake) return;
        if (on) {
          await mod.KeepAwake.keepAwake();
          nativeOnRef.current = true;
        } else if (nativeOnRef.current) {
          await mod.KeepAwake.allowSleep();
          nativeOnRef.current = false;
        }
      } catch {
        /* web / plugin missing */
      }
    }

    function ensureVideo(): HTMLVideoElement | null {
      if (videoRef.current) return videoRef.current;
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("muted", "");
      video.setAttribute("aria-hidden", "true");
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.volume = 0;
      video.tabIndex = -1;
      video.style.cssText =
        "position:fixed;width:2px;height:2px;opacity:0.01;pointer-events:none;bottom:0;left:0;z-index:-1;";
      video.src = "/silent-keepawake.mp4";
      document.body.appendChild(video);
      videoRef.current = video;
      return video;
    }

    async function startVideo() {
      const video = ensureVideo();
      if (!video) return;
      try {
        if (video.paused) await video.play();
      } catch {
        /* needs a user gesture — pointer/touch handlers retry */
      }
    }

    function lockStillHeld(): boolean {
      const s = sentinelRef.current;
      if (!s) return false;
      return s.released !== true;
    }

    async function acquireWakeLock() {
      if (cancelled || !wantedRef.current) return;
      if (document.visibilityState !== "visible") return;

      if (!lockStillHeld()) {
        const sentinel = await requestWakeLock();
        if (cancelled) {
          void sentinel?.release?.();
          return;
        }
        if (sentinel) {
          sentinelRef.current = sentinel;
          sentinel.addEventListener("release", () => {
            if (sentinelRef.current === sentinel) sentinelRef.current = null;
            if (!cancelled && wantedRef.current && document.visibilityState === "visible") {
              void acquire();
            }
          });
        }
      }
      // Always keep the silent video running — phones sometimes drop wakeLock quietly.
      await startVideo();
    }

    async function acquire() {
      if (cancelled || !wantedRef.current) return;
      await nativeKeepAwake(true);
      await acquireWakeLock();
    }

    void acquire();

    const onVis = () => {
      if (document.visibilityState === "visible" && wantedRef.current) void acquire();
    };
    const onGesture = () => {
      if (wantedRef.current) void acquire();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    window.addEventListener("focus", onVis);
    document.addEventListener("pointerdown", onGesture, { passive: true });
    document.addEventListener("touchstart", onGesture, { passive: true });

    heartbeat = window.setInterval(() => {
      if (!wantedRef.current || document.visibilityState !== "visible") return;
      void acquire();
    }, 25_000);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("touchstart", onGesture);
      const s = sentinelRef.current;
      sentinelRef.current = null;
      void s?.release?.();
      void nativeKeepAwake(false);
      const video = videoRef.current;
      videoRef.current = null;
      if (video) {
        try {
          video.pause();
          video.removeAttribute("src");
          video.srcObject = null;
          video.load();
        } catch {
          /* ignore */
        }
        video.remove();
      }
    };
  }, [enabled]);
}
