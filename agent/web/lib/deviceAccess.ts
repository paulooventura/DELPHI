/**
 * Device access — location + orientation + motion.
 * Must run from a user gesture (Allow button). iOS will not show
 * DeviceOrientation/Motion dialogs from a mount effect.
 *
 * The permissions screen shows after the splash once per install (App Review 5.1.1):
 * "Continue" asks now; "Not now" asks nothing, and each feature asks on the tap that
 * needs it (the sky on open, Cast and the sensor array for motion, alerts on their chip).
 * Later opens with "continue" start watches like a same-session return.
 */

import { requestOrientationPermission } from "./localSignals";
import { requestMotionPermission } from "./deviceSensors";

/** Install-lifetime marker (survives refresh; gone after uninstall). */
const STORAGE_KEY = "delphi-device-access-v3";
/** Page-session grant — dies when the tab/page closes. */
const SESSION_KEY = "delphi-access-session-v1";

export function hasPrimedDeviceAccess(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markDeviceAccessPrimed(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function hasAccessThisSession(): boolean {
  try {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAccessThisSession(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* private mode */
  }
  markDeviceAccessPrimed();
}

/** The one-time answer on the permissions screen. */
const CHOICE_KEY = "delphi-access-choice-v1";
export type AccessChoice = "continue" | "later";

/** Stored answer; installs that granted before this screen count as "continue". */
export function accessChoice(): AccessChoice | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(CHOICE_KEY);
    if (v === "continue" || v === "later") return v;
  } catch {
    return null;
  }
  return hasPrimedDeviceAccess() ? "continue" : null;
}

export function setAccessChoice(choice: AccessChoice): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    /* private mode: the screen shows again next open */
  }
}

export type DeviceAccessGrants = {
  location: boolean;
  orientation: boolean;
  motion: boolean;
};

/** Kick geolocation on the gesture stack — do not await this before sensor asks. */
function requestLocationAccess(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(false);
  }
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  });
}

/**
 * Ask for location + sensors. Call from a click/tap handler only.
 * Location is started synchronously before any await so iOS/Android
 * still treat it as user-gesture prompted.
 */
export async function requestDeviceAccessPermissions(): Promise<DeviceAccessGrants> {
  // 1) Start location immediately (gesture still live).
  const locationPromise = requestLocationAccess();
  // 2) Orientation then motion — one dialog at a time on iOS.
  const orientation = await requestOrientationPermission();
  const motion = await requestMotionPermission();
  const location = await locationPromise;
  markAccessThisSession();
  return { location, orientation, motion };
}
