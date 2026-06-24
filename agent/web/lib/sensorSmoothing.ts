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

export type SmoothedOrientation = {
  heading: number | null;
  pitch: number | null;
  viewAz: number | null;
  viewAlt: number | null;
};

/** RAF-throttled compass smoothing — cuts React/canvas churn from 60+ Hz sensor noise. */
export class OrientationFilter {
  private heading: number | null = null;
  private pitch: number | null = null;
  private viewAz: number | null = null;
  private viewAlt: number | null = null;
  private pending: SmoothedOrientation | null = null;
  private rafId = 0;
  private lastEmitMs = 0;

  constructor(private readonly onEmit: (reading: SmoothedOrientation) => void) {}

  push(raw: SmoothedOrientation): void {
    this.pending = raw;
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => this.flush());
  }

  private flush(): void {
    this.rafId = 0;
    const raw = this.pending;
    if (!raw) return;

    const now = performance.now();
    if (now - this.lastEmitMs < 48) {
      this.rafId = requestAnimationFrame(() => this.flush());
      return;
    }
    this.lastEmitMs = now;
    this.pending = null;

    const hAlpha = 0.14;
    const altForPitch = raw.viewAlt ?? raw.pitch;
    const nearHorizon = altForPitch != null && Math.abs(altForPitch) < 20;
    const pAlpha = nearHorizon ? 0.07 : 0.2;

    if (raw.heading != null) {
      this.heading =
        this.heading == null ? raw.heading : lerpAngle(this.heading, raw.heading, hAlpha);
    }
    if (raw.pitch != null) {
      this.pitch =
        this.pitch == null ? raw.pitch : lerpScalar(this.pitch, raw.pitch, pAlpha);
    }
    if (raw.viewAz != null) {
      this.viewAz =
        this.viewAz == null ? raw.viewAz : lerpAngle(this.viewAz, raw.viewAz, hAlpha);
    }
    if (raw.viewAlt != null) {
      this.viewAlt =
        this.viewAlt == null ? raw.viewAlt : lerpScalar(this.viewAlt, raw.viewAlt, pAlpha);
    }

    this.onEmit({
      heading: this.heading,
      pitch: this.pitch,
      viewAz: this.viewAz,
      viewAlt: this.viewAlt,
    });
  }

  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.pending = null;
  }
}
