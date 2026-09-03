/**
 * Device access — location + orientation + motion.
 * Must run from a user gesture (Allow button). iOS will not show
 * DeviceOrientation/Motion dialogs from a mount effect.
 *
 * The permissions UI shows after the splash, once per app open
 * (sessionStorage). Closing the tab/page or uninstalling clears it.
 * Returning from Studies, Tonal, or other doors in the same open does not
 * show it again. OS dialogs only appear when the browser still needs
 * consent; if already granted, Allow just starts watches.
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
