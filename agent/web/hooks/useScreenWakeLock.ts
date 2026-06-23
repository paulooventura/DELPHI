"use client";

import { useEffect, useRef } from "react";
import { requestWakeLock, type WakeLockSentinelLike } from "../lib/deviceSensors";

/**
 * Keeps the screen awake while the app is open. Re-acquires after tab visibility
 * returns (wake locks are released when the page is hidden).
 */
export function useScreenWakeLock(enabled = true) {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const wantedRef = useRef(enabled);

  useEffect(() => {
    wantedRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let cancelled = false;

    async function acquire() {
      if (cancelled || !wantedRef.current) return;
      if (sentinelRef.current) return;
      const sentinel = await requestWakeLock();
      if (cancelled || !sentinel) return;
      sentinelRef.current = sentinel;
      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
      });
    }

    void acquire();

    const onVis = () => {
      if (document.visibilityState === "visible" && wantedRef.current) void acquire();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      const s = sentinelRef.current;
      sentinelRef.current = null;
      void s?.release?.();
    };
  }, [enabled]);
}
