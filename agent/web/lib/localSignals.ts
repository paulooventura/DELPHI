import {
  deviceHeadingDeg,
  devicePitchDeg,
  deviceViewAltAz,
} from "./deviceOrientation";
import { GeoFixFilter, OrientationFilter } from "./sensorSmoothing";

export type LocalSignals = {
  location: GeoFix;
  emf: {
    magneticFieldUt: number | null;
    method: string;
  };
  network: {
    effectiveType: string | null;
    downlinkMbps: number | null;
    rttMs: number | null;
    hint5G: string;
  };
};

export type GeoFix = {
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  altitudeM: number | null;
  altitudeAccuracyM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  timestampMs: number | null;
};

const EMPTY_GEO: GeoFix = {
  latitude: null,
  longitude: null,
  accuracyM: null,
  altitudeM: null,
  altitudeAccuracyM: null,
  speedMps: null,
  headingDeg: null,
  timestampMs: null,
};

const GEO_SNAPSHOT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 0,
};

/** Watch stream: allow a recent cached fix to reduce chip churn and jitter. */
const GEO_WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000,
};

function coordsToFix(coords: GeolocationCoordinates, timestampMs: number): GeoFix {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyM: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
    altitudeM: coords.altitude != null && Number.isFinite(coords.altitude) ? coords.altitude : null,
    altitudeAccuracyM: coords.altitudeAccuracy != null && Number.isFinite(coords.altitudeAccuracy)
      ? coords.altitudeAccuracy
      : null,
    speedMps: coords.speed != null && Number.isFinite(coords.speed) ? coords.speed : null,
    headingDeg: coords.heading != null && Number.isFinite(coords.heading) ? coords.heading : null,
    timestampMs,
  };
}

type DeviceOrientationEventWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type DeviceOrientationEventStatic = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type NetworkInformation = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
};

type NavigatorWithNetwork = Navigator & {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
};

type MagnetometerReading = {
  x: number;
  y: number;
  z: number;
  start: () => void;
  stop: () => void;
  addEventListener: (name: string, cb: () => void, opts?: { once?: boolean }) => void;
};

type WindowWithSensors = Window & {
  Magnetometer?: new (opts?: { frequency?: number }) => MagnetometerReading;
};

export function getNetworkInfo(): LocalSignals["network"] {
  const nav = navigator as NavigatorWithNetwork;
  const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  const effectiveType = conn?.effectiveType ?? null;
  const downlinkMbps = typeof conn?.downlink === "number" ? conn.downlink : null;
  const rttMs = typeof conn?.rtt === "number" ? conn.rtt : null;

  const hint5G = effectiveType === "4g"
    ? "Potential high-throughput connection (browser does not expose exact 5G radio state)."
    : "No 5G-grade hint exposed by browser network APIs.";

  return { effectiveType, downlinkMbps, rttMs, hint5G };
}

export async function getLocation(): Promise<GeoFix> {
  if (!("geolocation" in navigator)) {
    return { ...EMPTY_GEO };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(coordsToFix(pos.coords, pos.timestamp)),
      () => resolve({ ...EMPTY_GEO }),
      GEO_SNAPSHOT_OPTIONS,
    );
  });
}

/** Continuous position stream with stationary jitter filtering. */
export function watchLocation(onFix: (fix: GeoFix) => void, onError?: () => void): () => void {
  if (!("geolocation" in navigator)) return () => {};

  const filter = new GeoFixFilter();
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const raw = coordsToFix(pos.coords, pos.timestamp);
      const smoothed = filter.filter(raw);
      if (smoothed) onFix(smoothed);
    },
    () => onError?.(),
    GEO_WATCH_OPTIONS,
  );
  return () => {
    filter.reset();
    navigator.geolocation.clearWatch(id);
  };
}

// iOS 13+ requires this to be called from a user gesture (a click handler,
// not an effect) before "deviceorientation" will ever fire. Other browsers
// don't expose requestPermission at all, so this resolves true immediately.
export async function requestOrientationPermission(): Promise<boolean> {
  const DOE = (typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : undefined) as
    (typeof DeviceOrientationEvent & DeviceOrientationEventStatic) | undefined;
  if (DOE && typeof DOE.requestPermission === "function") {
    try {
      return (await DOE.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

function headingFromOrientation(event: DeviceOrientationEventWithCompass): number | null {
  return deviceHeadingDeg(event);
}

function pitchFromOrientation(event: DeviceOrientationEvent): number | null {
  return devicePitchDeg(event);
}

export type DeviceOrientationReading = {
  heading: number | null;
  pitch: number | null;
  /** Unified view direction when full orientation is available. */
  viewAz: number | null;
  viewAlt: number | null;
};

export { deviceViewAltAz } from "./deviceOrientation";

// Continuous heading + pitch from device tilt — call requestOrientationPermission() first.
export function watchDeviceOrientation(
  onReading: (reading: DeviceOrientationReading) => void,
): () => void {
  const filter = new OrientationFilter(onReading);
  const onOrientation = (event: Event) => {
    const e = event as DeviceOrientationEventWithCompass;
    const view = deviceViewAltAz(e);
    filter.push({
      heading: headingFromOrientation(e),
      pitch: pitchFromOrientation(e),
      viewAz: view?.az ?? null,
      viewAlt: view?.alt ?? null,
    });
  };
  window.addEventListener("deviceorientationabsolute", onOrientation, true);
  window.addEventListener("deviceorientation", onOrientation, true);
  return () => {
    filter.destroy();
    window.removeEventListener("deviceorientationabsolute", onOrientation, true);
    window.removeEventListener("deviceorientation", onOrientation, true);
  };
}

/** @deprecated Use watchDeviceOrientation */
export function watchCompassHeading(onHeading: (headingDeg: number | null) => void): () => void {
  return watchDeviceOrientation(({ heading }) => onHeading(heading));
}

export async function getMagneticField(): Promise<LocalSignals["emf"]> {
  const w = window as WindowWithSensors;
  const MagnetometerCtor = w.Magnetometer;
  if (!MagnetometerCtor) {
    return { magneticFieldUt: null, method: "magnetometer-api-unavailable" };
  }

  return new Promise((resolve) => {
    try {
      const sensor = new MagnetometerCtor({ frequency: 5 });
      sensor.addEventListener("reading", () => {
        const ut = Math.sqrt(sensor.x ** 2 + sensor.y ** 2 + sensor.z ** 2);
        sensor.stop();
        resolve({ magneticFieldUt: Number(ut.toFixed(2)), method: "magnetometer" });
      }, { once: true });

      sensor.start();

      window.setTimeout(() => {
        try { sensor.stop(); } catch {}
        resolve({ magneticFieldUt: null, method: "magnetometer-timeout" });
      }, 2500);
    } catch {
      resolve({ magneticFieldUt: null, method: "magnetometer-denied" });
    }
  });
}
