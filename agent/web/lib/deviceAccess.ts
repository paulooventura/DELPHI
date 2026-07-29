/**
 * One-time device access — location + orientation + motion.
 * iOS requires orientation/motion requestPermission from a user gesture;
 * geolocation prompts when getCurrentPosition/watchPosition first run.
 */

import { requestOrientationPermission } from "./localSignals";
import { requestMotionPermission } from "./deviceSensors";

const STORAGE_KEY = "delphi-device-access-v1";

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
  orientation: boolean;
  motion: boolean;
};

/**
 * Ask for sensor permissions. Must be invoked from a click/tap handler
 * (not a setTimeout or mount effect) so iOS will show the dialogs.
 * Marks the ask as done either way — we only prompt once.
 */
export async function requestDeviceAccessPermissions(): Promise<DeviceAccessGrants> {
  // One dialog at a time — iOS stacks poorly if both fire together.
  const orientation = await requestOrientationPermission();
  const motion = await requestMotionPermission();
  markDeviceAccessPrimed();
  return { orientation, motion };
}
