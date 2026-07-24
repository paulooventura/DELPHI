/**
 * Scale-dependent field-of-view and level-of-detail for deep-space zoom.
 */

import type { ViewBasis } from "../sphericalView";
import { createSphericalSkyProjector, type SkyProjector } from "../sphericalView";

export type SkyDetailLevel = "wide" | "telephoto";

const LOD_WIDE_MAX = 3;
const LOD_TELE_MIN = 4;

/** Exponential FOV reduction: scale 1 = full sky, scale 50 = 50× telephoto. */
export function effectiveFov(scale: number, baseFovAz: number, baseFovAltHalf: number) {
  const s = Math.max(1, scale);
  return {
    fovAz: baseFovAz / s,
    fovAltHalf: baseFovAltHalf / s,
  };
}

export function getSkyDetailLevel(scale: number): SkyDetailLevel {
  if (scale >= LOD_TELE_MIN) return "telephoto";
  return "wide";
}

export function starFieldOpacity(scale: number): number {
  if (scale <= LOD_WIDE_MAX) return 1;
  const t = Math.min(1, (scale - LOD_WIDE_MAX) / (LOD_TELE_MIN - LOD_WIDE_MAX + 2));
  return Math.max(0, 1 - t);
}

export function planetTextureBlend(scale: number): number {
  if (scale <= LOD_WIDE_MAX) return 0;
  return Math.min(1, (scale - LOD_WIDE_MAX) / 6);
}

export function shouldClusterSatellites(scale: number): boolean {
  return scale <= LOD_WIDE_MAX;
}

export function createZoomedSkyProjector(
  width: number,
  height: number,
  basis: ViewBasis,
  scale: number,
  baseFovAz = 85,
  baseFovAltHalf = 42,
): SkyProjector {
  const { fovAz, fovAltHalf } = effectiveFov(scale, baseFovAz, baseFovAltHalf);
  return createSphericalSkyProjector(width, height, basis, fovAz, fovAltHalf);
}

/** Format zoom factor for HUD (e.g. "12.4×"). */
export function formatZoom(scale: number): string {
  return scale >= 10 ? `${scale.toFixed(0)}×` : `${scale.toFixed(1)}×`;
}
