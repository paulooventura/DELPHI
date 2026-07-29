/**
 * Device access — location + orientation + motion.
 * Must run from a user gesture (Allow button). iOS will not show
 * DeviceOrientation/Motion dialogs from a mount effect.
 *
 * The UI gate is shown on EVERY page load until Allow is tapped for that load.
 * OS dialogs only appear when the browser still needs consent; if already
 * granted, the tap simply starts watches immediately.
 */

import { requestOrientationPermission } from "./localSignals";
import { requestMotionPermission } from "./deviceSensors";

/** Ever-asked marker (diagnostics / future); does not skip the open gate. */
const STORAGE_KEY = "delphi-device-access-v3";

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
  markDeviceAccessPrimed();
  return { location, orientation, motion };
}
