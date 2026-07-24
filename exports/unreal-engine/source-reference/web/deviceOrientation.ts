/**
 * Portrait sky AR — delegates to continuous ENU view vector (see sphericalView.ts).
 */

import {
  buildViewBasis,
  deviceOrientationToBasis,
  deviceOrientationToViewEnu,
  enuToAltAz,
  type ViewBasis,
  type Vec3,
} from "./sphericalView";

export type { ViewBasis, Vec3 };

export function deviceViewEnu(
  event: DeviceOrientationEvent & { webkitCompassHeading?: number },
): Vec3 | null {
  return deviceOrientationToViewEnu(event);
}

export function deviceViewBasis(
  event: DeviceOrientationEvent & { webkitCompassHeading?: number },
): ViewBasis | null {
  return deviceOrientationToBasis(event);
}

export function deviceViewAltAz(event: DeviceOrientationEvent): { az: number; alt: number } | null {
  const v = deviceOrientationToViewEnu(event as DeviceOrientationEvent & { webkitCompassHeading?: number });
  if (!v) return null;
  return enuToAltAz(v);
}

export function deviceHeadingDeg(event: DeviceOrientationEvent): number | null {
  const v = deviceViewAltAz(event);
  return v?.az ?? null;
}

export function devicePitchDeg(event: DeviceOrientationEvent): number | null {
  const v = deviceViewAltAz(event);
  return v?.alt ?? null;
}

/** @deprecated Use deviceViewBasis — kept for imports that need roll-aware basis. */
export { buildViewBasis };
