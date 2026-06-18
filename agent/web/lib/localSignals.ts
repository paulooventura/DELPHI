export type LocalSignals = {
  capturedAt: string;
  location: {
    latitude: number | null;
    longitude: number | null;
    accuracyM: number | null;
  };
  compass: {
    headingDeg: number | null;
    method: string;
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
  thermal: {
    ambientC: number | null;
    note: string;
  };
  limitations: string[];
};

type DeviceOrientationEventWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
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

function getNetworkInfo(): LocalSignals["network"] {
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

async function getLocation(): Promise<LocalSignals["location"]> {
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
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 },
    );
  });
}

async function getCompassHeading(): Promise<LocalSignals["compass"]> {
  return new Promise((resolve) => {
    const onOrientation = (event: Event) => {
      const e = event as DeviceOrientationEventWithCompass;
      let heading = typeof e.webkitCompassHeading === "number" ? e.webkitCompassHeading : null;

      if (heading === null && typeof e.alpha === "number") {
        heading = (360 - e.alpha) % 360;
      }

      window.removeEventListener("deviceorientation", onOrientation);
      resolve({
        headingDeg: heading,
        method: heading === null ? "unavailable" : "deviceorientation",
      });
    };

    window.addEventListener("deviceorientation", onOrientation, { once: true });
    window.setTimeout(() => {
      window.removeEventListener("deviceorientation", onOrientation);
      resolve({ headingDeg: null, method: "timeout" });
    }, 2500);
  });
}

async function getMagneticField(): Promise<LocalSignals["emf"]> {
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

export async function captureLocalSignals(): Promise<LocalSignals> {
  const [location, compass, emf] = await Promise.all([
    getLocation(),
    getCompassHeading(),
    getMagneticField(),
  ]);

  const network = getNetworkInfo();

  return {
    capturedAt: new Date().toISOString(),
    location,
    compass,
    emf,
    network,
    thermal: {
      ambientC: null,
      note: "Browser runtime does not expose precise local thermal sensor data.",
    },
    limitations: [
      "Precise heat, 5G radio metrics, and calibrated EMF need dedicated hardware integrations.",
      "Web APIs provide directional and connectivity hints, not certified field instrumentation.",
    ],
  };
}
