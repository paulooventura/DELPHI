"use client";

import { useSyncExternalStore } from "react";
import { clockState, subscribeClock, type ClockState } from "../lib/cosmic/pneumaClock";

const SERVER: ClockState = { mode: "live", atMs: 0, by: "", setAtMs: 0, agesMa: null, version: 0 };

/** Re-renders when the temple's clock changes mode or moment (not every frame). */
export function usePneumaClock(): ClockState {
  return useSyncExternalStore(subscribeClock, clockState, () => SERVER);
}
