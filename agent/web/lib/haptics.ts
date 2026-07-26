/**
 * Cross-platform haptics — Capacitor (real Taptic on iOS) → Vibration API fallback.
 * Muted automatically when the app is backgrounded / closed so a pending second-tick
 * cannot buzz after the user leaves.
 */

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export type HapticKind = "second" | "minute" | "tick" | "step" | "deep";

let muted = false;
/** Bumps whenever we mute so in-flight async pulses abort mid-sequence. */
let epoch = 0;
let lifecycleInstalled = false;

function canUseCapacitor(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function vibrateWeb(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
}

function syncMuteFromVisibility(): void {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "hidden") {
    muted = true;
  }
}

/** Hard-mute (and cancel web vibration). Used on background / unmount. */
export function muteHaptics(): void {
  muted = true;
  epoch += 1;
  vibrateWeb(0);
}

export function unmuteHaptics(): void {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    muted = true;
    return;
  }
  muted = false;
}

export function hapticsMuted(): boolean {
  syncMuteFromVisibility();
  return muted;
}

/**
 * Install once: mute on hide/pagehide, unmute on return.
 * Safe to call repeatedly — only attaches listeners once.
 */
export function installHapticLifecycle(): void {
  if (typeof window === "undefined" || lifecycleInstalled) return;
  lifecycleInstalled = true;

  const onVis = () => {
    if (document.visibilityState === "hidden") muteHaptics();
    else unmuteHaptics();
  };
  const onHide = () => muteHaptics();

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("freeze", onHide);
  // iOS Capacitor often fires blur as the shell is dismissed.
  window.addEventListener("blur", onHide);
  window.addEventListener("focus", () => unmuteHaptics());

  syncMuteFromVisibility();
}

/** Soft second tick / confirmation / depth steps / minute bloom. */
export async function pulseHaptic(kind: HapticKind): Promise<void> {
  if (typeof window === "undefined") return;
  installHapticLifecycle();
  syncMuteFromVisibility();
  if (muted) return;

  const myEpoch = epoch;

  if (canUseCapacitor()) {
    try {
      switch (kind) {
        case "second":
        case "tick":
          if (muted || myEpoch !== epoch) return;
          await Haptics.impact({ style: ImpactStyle.Light });
          return;
        case "step":
          if (muted || myEpoch !== epoch) return;
          await Haptics.impact({ style: ImpactStyle.Medium });
          return;
        case "deep":
        case "minute":
          if (muted || myEpoch !== epoch) return;
          await Haptics.impact({ style: ImpactStyle.Heavy });
          // A short second hit for the “chime” feel on minute / deep.
          await new Promise(r => setTimeout(r, 40));
          if (muted || myEpoch !== epoch) return;
          await Haptics.notification({ type: NotificationType.Success });
          return;
        default:
          if (muted || myEpoch !== epoch) return;
          await Haptics.selectionStart();
          return;
      }
    } catch {
      /* fall through to web */
    }
  }

  if (muted || myEpoch !== epoch) return;

  switch (kind) {
    case "second":
      vibrateWeb(6);
      break;
    case "tick":
      vibrateWeb(8);
      break;
    case "step":
      vibrateWeb(14);
      break;
    case "deep":
      vibrateWeb([20, 40, 30]);
      break;
    case "minute":
      vibrateWeb([12, 50, 12, 50, 24]);
      break;
  }
}

/** Cancel in-flight web vibration and abort multi-hit sequences (does not stay muted). */
export function cancelHaptic(): void {
  epoch += 1;
  vibrateWeb(0);
}
