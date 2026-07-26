/**
 * Cross-platform haptics — Capacitor (real Taptic on iOS) → Vibration API fallback.
 */

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export type HapticKind = "second" | "minute" | "tick" | "step" | "deep";

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

/** Soft second tick / confirmation / depth steps / minute bloom. */
export async function pulseHaptic(kind: HapticKind): Promise<void> {
  if (typeof window === "undefined") return;

  if (canUseCapacitor()) {
    try {
      switch (kind) {
        case "second":
        case "tick":
          await Haptics.impact({ style: ImpactStyle.Light });
          return;
        case "step":
          await Haptics.impact({ style: ImpactStyle.Medium });
          return;
        case "deep":
        case "minute":
          await Haptics.impact({ style: ImpactStyle.Heavy });
          // A short second hit for the “chime” feel on minute / deep.
          await new Promise(r => setTimeout(r, 40));
          await Haptics.notification({ type: NotificationType.Success });
          return;
        default:
          await Haptics.selectionStart();
          return;
      }
    } catch {
      /* fall through to web */
    }
  }

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

/** Cancel any in-flight web vibration (no-op on iOS Capacitor). */
export function cancelHaptic(): void {
  vibrateWeb(0);
}
