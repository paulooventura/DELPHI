import type { GeoFix } from "./localSignals";

export function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Shortest-path blend between two compass bearings. */
export function lerpAngle(from: number, to: number, alpha: number): number {
  const delta = ((to - from + 540) % 360) - 180;
  return normalizeHeading(from + delta * alpha);
}

export function lerpScalar(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

const EARTH_RADIUS_M = 6_371_000;

export function geoDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function isStationary(fix: GeoFix, distFromSmoothM: number): boolean {
  const speed = fix.speedMps;
  if (speed != null && Number.isFinite(speed) && speed >= 1.2) return false;
  const acc = fix.accuracyM ?? 40;
  return distFromSmoothM < Math.max(12, acc * 0.55);
}

/** Damp GPS jitter while stationary; smooth more aggressively when accuracy is poor. */
export class GeoFixFilter {
  private lat: number | null = null;
  private lon: number | null = null;
  private lastEmitMs = 0;

  reset(): void {
    this.lat = null;
    this.lon = null;
    this.lastEmitMs = 0;
  }

  filter(fix: GeoFix): GeoFix | null {
    if (fix.latitude == null || fix.longitude == null) return null;

    if (this.lat == null || this.lon == null) {
      this.lat = fix.latitude;
      this.lon = fix.longitude;
      this.lastEmitMs = fix.timestampMs ?? Date.now();
      return fix;
    }

    const distM = geoDistanceM(this.lat, this.lon, fix.latitude, fix.longitude);
    const acc = fix.accuracyM ?? 40;
    const stationary = isStationary(fix, distM);
    const now = fix.timestampMs ?? Date.now();

    if (stationary && distM < Math.max(15, acc * 0.75)) {
      // Ignore micro-jitter inside the accuracy bubble.
      if (now - this.lastEmitMs < 2000) return null;
      this.lastEmitMs = now;
      return {
        ...fix,
        latitude: this.lat,
        longitude: this.lon,
        speedMps: fix.speedMps != null ? 0 : fix.speedMps,
      };
    }

    const alpha = stationary
      ? 0.1
      : acc < 18
        ? 0.42
        : acc < 45
          ? 0.28
          : 0.16;

    this.lat = lerpScalar(this.lat, fix.latitude, alpha);
    this.lon = lerpScalar(this.lon, fix.longitude, alpha);

    const bigJump = distM > Math.max(35, acc * 1.2);
    if (!bigJump && now - this.lastEmitMs < 280) return null;
    this.lastEmitMs = now;

    return {
      ...fix,
      latitude: this.lat,
      longitude: this.lon,
    };
  }
}

import type { Vec3 } from "./sphericalView";
import { enuToAltAz, slerpUnit } from "./sphericalView";

import type { SkyPoseHint } from "./orientationCalibration";
import { describeSkyPose } from "./orientationCalibration";

export type SmoothedOrientation = {
  view: Vec3;
  roll: number;
  heading: number | null;
  pitch: number | null;
  viewAz: number | null;
  viewAlt: number | null;
  beta: number | null;
  gamma: number | null;
  pose: SkyPoseHint;
};

/** RAF-throttled view-vector smoothing — continuous on the full sphere. */
export class OrientationFilter {
  private view: Vec3 = [0, 0, 1];
  private roll = 0;
  private hasView = false;
  private pending: SmoothedOrientation | null = null;
  private rafId = 0;
  private lastEmitMs = 0;

  constructor(private readonly onEmit: (reading: SmoothedOrientation) => void) {}

  push(raw: { view: Vec3; roll: number; beta: number | null; gamma: number | null }): void {
    const { az, alt } = enuToAltAz(raw.view);
    this.pending = {
      view: raw.view,
      roll: raw.roll,
      heading: az,
      pitch: alt,
      viewAz: az,
      viewAlt: alt,
      beta: raw.beta,
      gamma: raw.gamma,
      pose: describeSkyPose(raw.beta, raw.gamma),
    };
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => this.flush());
  }

  private flush(): void {
    this.rafId = 0;
    const raw = this.pending;
    if (!raw) return;

    const now = performance.now();
    if (now - this.lastEmitMs < 16) {
      this.rafId = requestAnimationFrame(() => this.flush());
      return;
    }
    this.lastEmitMs = now;
    this.pending = null;

    const { alt } = enuToAltAz(raw.view);
    const nearHorizon = Math.abs(alt) < 22;
    const t = nearHorizon ? 0.12 : 0.32;

    if (!this.hasView) {
      this.view = raw.view;
      this.roll = 0;
      this.hasView = true;
    } else {
      this.view = slerpUnit(this.view, raw.view, t);
      this.roll = 0;
    }

    const smoothed = enuToAltAz(this.view);
    const pending = raw;
    this.onEmit({
      view: this.view,
      roll: 0,
      heading: smoothed.az,
      pitch: smoothed.alt,
      viewAz: smoothed.az,
      viewAlt: smoothed.alt,
      beta: pending.beta,
      gamma: pending.gamma,
      pose: pending.pose,
    });
  }

  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.pending = null;
    this.hasView = false;
  }
}
