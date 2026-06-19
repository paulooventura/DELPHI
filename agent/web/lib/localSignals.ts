export type LocalSignals = {
  location: {
    latitude: number | null;
    longitude: number | null;
    accuracyM: number | null;
  };
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

export async function getLocation(): Promise<LocalSignals["location"]> {
  if (!("geolocation" in navigator)) {
    return { latitude: null, longitude: null, accuracyM: null };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
      },
      () => resolve({ latitude: null, longitude: null, accuracyM: null }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
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

function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function headingFromOrientation(event: DeviceOrientationEventWithCompass): number | null {
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)) {
    return normalizeHeading(event.webkitCompassHeading);
  }
  if (typeof event.alpha !== "number" || !Number.isFinite(event.alpha)) return null;
  // absolute: alpha tracks compass north; relative: invert z-rotation
  const raw = event.absolute ? event.alpha : (360 - event.alpha) % 360;
  return normalizeHeading(raw);
}

// Continuous heading stream — call requestOrientationPermission() first.
// Listens to both absolute and relative orientation events (iOS / Android / Chrome).
// Returns an unsubscribe function.
export function watchCompassHeading(onHeading: (headingDeg: number | null) => void): () => void {
  const onOrientation = (event: Event) => {
    onHeading(headingFromOrientation(event as DeviceOrientationEventWithCompass));
  };
  window.addEventListener("deviceorientationabsolute", onOrientation, true);
  window.addEventListener("deviceorientation", onOrientation, true);
  return () => {
    window.removeEventListener("deviceorientationabsolute", onOrientation, true);
    window.removeEventListener("deviceorientation", onOrientation, true);
  };
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
