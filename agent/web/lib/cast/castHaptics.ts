/**
 * Cast-ritual haptics — bag rub, coin rattle, finger-on-deck glide.
 * Uses Capacitor Taptic when native; Vibration API on Android web.
 */

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { hapticsMuted, installHapticLifecycle, pulseHaptic } from "../haptics";

export type CastBuzz =
  | "tap"
  | "rub"
  | "shake"
  | "toss"
  | "draw"
  | "card"
  | "settle";

let lastRub = 0;
let lastShake = 0;
let lastCard = 0;

function canCap(): boolean {
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

/** Fire a cast-gesture buzz (throttled for continuous rub / card glide). */
export function castBuzz(kind: CastBuzz): void {
  if (typeof window === "undefined") return;
  installHapticLifecycle();
  if (hapticsMuted()) return;

  const now = performance.now();

  if (kind === "rub") {
    if (now - lastRub < 55) return;
    lastRub = now;
  } else if (kind === "card") {
    if (now - lastCard < 42) return;
    lastCard = now;
  } else if (kind === "shake") {
    if (now - lastShake < 70) return;
    lastShake = now;
  }

  if (canCap()) {
    void (async () => {
      try {
        switch (kind) {
          case "tap":
          case "card":
            await Haptics.impact({ style: ImpactStyle.Light });
            return;
          case "rub":
            await Haptics.selectionChanged();
            return;
          case "shake":
            await Haptics.impact({ style: ImpactStyle.Medium });
            return;
          case "toss":
          case "draw":
            await Haptics.impact({ style: ImpactStyle.Heavy });
            return;
          case "settle":
            await Haptics.impact({ style: ImpactStyle.Medium });
            await new Promise(r => setTimeout(r, 50));
            await Haptics.impact({ style: ImpactStyle.Light });
            return;
        }
      } catch {
        /* fall through */
      }
      webBuzz(kind);
    })();
    return;
  }

  webBuzz(kind);
}

function webBuzz(kind: CastBuzz): void {
  switch (kind) {
    case "tap":
      vibrateWeb(10);
      break;
    case "rub":
      vibrateWeb(7);
      break;
    case "card":
      vibrateWeb(6);
      break;
    case "shake":
      vibrateWeb([12, 18, 12]);
      break;
    case "toss":
      vibrateWeb([18, 30, 22, 40, 28]);
      break;
    case "draw":
      void pulseHaptic("deep");
      break;
    case "settle":
      vibrateWeb([16, 40, 10, 30, 20]);
      break;
  }
}

export function stopCastBuzz(): void {
  vibrateWeb(0);
}
