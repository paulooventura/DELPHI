// Pure (non-React) wrappers around the web platform's device sensors.
//
// Every function here is defensive: it feature-detects, wraps all browser
// access in try/catch, never throws, and is safe to import on the server
// (no top-level `window` / `navigator` / `screen` access — all guarded inside
// function bodies). Each subscription returns its own cleanup so callers can
// guarantee no leaks. Non-standard sensor constructors (AmbientLightSensor,
// Magnetometer, Barometer, ProximitySensor, PressureObserver) are typed via
// local, module-scoped interfaces so they never collide with global types or
// the locally-typed copies in `localSignals.ts` / `cosmic/sensors.ts`.

import { batteryAvailable, vibrationAvailable } from "./platform";

export type SensorStatus =
  | "live"
  | "idle"
  | "permission-required"
  | "denied"
  | "unsupported";

/** Standard result for a streaming sensor subscription. */
export type SensorSubscription = {
  /** Whether the underlying API constructor / event exists at all. */
  supported: boolean;
  /** Idempotent teardown — always safe to call. */
  stop: () => void;
};

const GRAVITY = 9.80665;
const NOOP = (): void => {};

// ─── Generic Sensor API (Chrome / Android) ──────────────────────────────────

type SensorErrorEvent = Event & { error?: { name?: string; message?: string } };

interface GenericSensorLike {
  activated: boolean;
  start: () => void;
  stop: () => void;
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
}

type GenericSensorCtor<T extends GenericSensorLike> = new (
  options?: { frequency?: number },
) => T;

type AmbientLightSensorLike = GenericSensorLike & { illuminance: number };
type MagnetometerLike = GenericSensorLike & { x: number; y: number; z: number };
type BarometerLike = GenericSensorLike & { pressure: number };
type ProximitySensorLike = GenericSensorLike & {
  distance: number | null;
  near: boolean;
  max: number | null;
};

// Compute Pressure API (PressureObserver) — note this surfaces *compute/thermal*
// pressure states rather than barometric hPa; we use it only as a liveness
// fallback when a true `Barometer` sensor is unavailable.
type PressureState = "nominal" | "fair" | "serious" | "critical";
interface PressureRecordLike {
  source: string;
  state: PressureState;
  time: number;
}
interface PressureObserverLike {
  observe: (source: string) => Promise<void>;
  disconnect: () => void;
}
type PressureObserverCtor = new (
  callback: (records: PressureRecordLike[]) => void,
  options?: { sampleInterval?: number },
) => PressureObserverLike;

type SensorWindow = Window & {
  AmbientLightSensor?: GenericSensorCtor<AmbientLightSensorLike>;
  Magnetometer?: GenericSensorCtor<MagnetometerLike>;
  Barometer?: GenericSensorCtor<BarometerLike>;
  ProximitySensor?: GenericSensorCtor<ProximitySensorLike>;
  PressureObserver?: PressureObserverCtor;
};

function watchGenericSensor<T extends GenericSensorLike>(
  Ctor: GenericSensorCtor<T> | undefined,
  frequency: number,
  read: (sensor: T) => void,
  onError?: (reason: string) => void,
): SensorSubscription {
  if (!Ctor) return { supported: false, stop: NOOP };
  try {
    const sensor = new Ctor({ frequency });
    const onReading = () => read(sensor);
    const onErr = (event: Event) => {
      const name = (event as SensorErrorEvent).error?.name ?? "Error";
      onError?.(name);
    };
    sensor.addEventListener("reading", onReading);
    sensor.addEventListener("error", onErr);
    sensor.start();
    return {
      supported: true,
      stop: () => {
        try {
          sensor.removeEventListener("reading", onReading);
          sensor.removeEventListener("error", onErr);
          sensor.stop();
        } catch {
          /* ignore */
        }
      },
    };
  } catch (err) {
    onError?.(err instanceof Error ? err.name : "Error");
    return { supported: true, stop: NOOP };
  }
}

// ─── Permissions API helper (never assume it exists) ─────────────────────────

export async function queryPermission(
  name: string,
): Promise<PermissionState | "unsupported"> {
  if (typeof navigator === "undefined") return "unsupported";
  const perms = navigator.permissions;
  if (!perms || typeof perms.query !== "function") return "unsupported";
  try {
    const status = await perms.query({ name: name as PermissionName });
    return status.state;
  } catch {
    return "unsupported";
  }
}

// ─── Device motion (accelerometer / linear accel / gyroscope) ────────────────

type DeviceMotionEventStatic = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export type MotionReading = {
  /** accelerationIncludingGravity (m/s²). */
  accelG: { x: number | null; y: number | null; z: number | null };
  /** acceleration, gravity removed (m/s²). */
  accel: { x: number | null; y: number | null; z: number | null };
  /** rotationRate (deg/s). */
  rotation: { alpha: number | null; beta: number | null; gamma: number | null };
  intervalMs: number | null;
};

export function motionSupported(): boolean {
  return typeof window !== "undefined" && "DeviceMotionEvent" in window;
}

/** True when an explicit user-gesture permission call is required (iOS 13+). */
export function motionNeedsPermission(): boolean {
  if (typeof DeviceMotionEvent === "undefined") return false;
  const DME = DeviceMotionEvent as unknown as DeviceMotionEventStatic;
  return typeof DME.requestPermission === "function";
}

/**
 * iOS 13+ requires this from a user gesture before `devicemotion` will fire.
 * Other browsers don't expose requestPermission, so this resolves true.
 */
export async function requestMotionPermission(): Promise<boolean> {
  if (typeof DeviceMotionEvent === "undefined") return false;
  const DME = DeviceMotionEvent as unknown as DeviceMotionEventStatic;
  if (typeof DME.requestPermission === "function") {
    try {
      return (await DME.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export function watchMotion(onReading: (reading: MotionReading) => void): () => void {
  if (typeof window === "undefined") return NOOP;
  const handler = (event: DeviceMotionEvent) => {
    const ag = event.accelerationIncludingGravity;
    const a = event.acceleration;
    const rr = event.rotationRate;
    onReading({
      accelG: { x: ag?.x ?? null, y: ag?.y ?? null, z: ag?.z ?? null },
      accel: { x: a?.x ?? null, y: a?.y ?? null, z: a?.z ?? null },
      rotation: { alpha: rr?.alpha ?? null, beta: rr?.beta ?? null, gamma: rr?.gamma ?? null },
      intervalMs: typeof event.interval === "number" ? event.interval : null,
    });
  };
  window.addEventListener("devicemotion", handler);
  return () => window.removeEventListener("devicemotion", handler);
}

/** Tilt angle (deg) of the device away from flat, from gravity vector. */
export function tiltFromAccelG(
  x: number | null,
  y: number | null,
  z: number | null,
): number | null {
  if (x == null || y == null || z == null) return null;
  const mag = Math.sqrt(x * x + y * y + z * z);
  if (mag < 0.001) return null;
  const cos = Math.max(-1, Math.min(1, z / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** g-force magnitude from gravity-removed linear acceleration. */
export function gForceFromAccel(
  x: number | null,
  y: number | null,
  z: number | null,
): number | null {
  if (x == null && y == null && z == null) return null;
  const mag = Math.sqrt((x ?? 0) ** 2 + (y ?? 0) ** 2 + (z ?? 0) ** 2);
  return mag / GRAVITY;
}

// ─── Ambient light → lux ─────────────────────────────────────────────────────

export function ambientLightSupported(): boolean {
  return typeof window !== "undefined" && "AmbientLightSensor" in window;
}

export function watchAmbientLight(
  onLux: (lux: number) => void,
  onError?: (reason: string) => void,
): SensorSubscription {
  if (typeof window === "undefined") return { supported: false, stop: NOOP };
  return watchGenericSensor(
    (window as SensorWindow).AmbientLightSensor,
    5,
    (sensor) => {
      if (Number.isFinite(sensor.illuminance)) onLux(sensor.illuminance);
    },
    onError,
  );
}

// ─── Magnetometer → µT magnitude ─────────────────────────────────────────────

export function magnetometerSupported(): boolean {
  return typeof window !== "undefined" && "Magnetometer" in window;
}

export function watchMagnetometer(
  onMicroTesla: (ut: number) => void,
  onError?: (reason: string) => void,
): SensorSubscription {
  if (typeof window === "undefined") return { supported: false, stop: NOOP };
  return watchGenericSensor(
    (window as SensorWindow).Magnetometer,
    5,
    (sensor) => {
      const ut = Math.sqrt(sensor.x ** 2 + sensor.y ** 2 + sensor.z ** 2);
      if (Number.isFinite(ut)) onMicroTesla(ut);
    },
    onError,
  );
}

// ─── Barometer / pressure → hPa ──────────────────────────────────────────────

export type PressureSupport = "barometer" | "compute-pressure" | "none";

export function pressureSupport(): PressureSupport {
  if (typeof window === "undefined") return "none";
  if ("Barometer" in window) return "barometer";
  if ("PressureObserver" in window) return "compute-pressure";
  return "none";
}

/**
 * Streams barometric pressure in hPa from the generic `Barometer` sensor.
 * When only the Compute Pressure API is present we attach it for liveness but
 * it does not expose hPa, so `onHpa` is never called in that case (the caller
 * keeps a null reading while still flagging the sensor as supported/live).
 */
export function watchPressure(
  onHpa: (hpa: number) => void,
  onError?: (reason: string) => void,
  onComputePressure?: (state: PressureState) => void,
): SensorSubscription {
  if (typeof window === "undefined") return { supported: false, stop: NOOP };
  const w = window as SensorWindow;

  if (w.Barometer) {
    return watchGenericSensor(
      w.Barometer,
      2,
      (sensor) => {
        if (Number.isFinite(sensor.pressure)) onHpa(sensor.pressure);
      },
      onError,
    );
  }

  if (w.PressureObserver) {
    try {
      const observer = new w.PressureObserver((records) => {
        const last = records[records.length - 1];
        if (last) onComputePressure?.(last.state);
      });
      let disconnected = false;
      void observer.observe("cpu").catch(() => onError?.("NotAllowedError"));
      return {
        supported: true,
        stop: () => {
          if (disconnected) return;
          disconnected = true;
          try {
            observer.disconnect();
          } catch {
            /* ignore */
          }
        },
      };
    } catch (err) {
      onError?.(err instanceof Error ? err.name : "Error");
      return { supported: true, stop: NOOP };
    }
  }

  return { supported: false, stop: NOOP };
}

// ─── Proximity ───────────────────────────────────────────────────────────────

export type ProximityReading = {
  near: boolean | null;
  distanceCm: number | null;
  maxCm: number | null;
};

type ProximityWindow = Window & {
  onuserproximity?: unknown;
  ondeviceproximity?: unknown;
};

export function proximitySupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ProximitySensor" in window ||
    "onuserproximity" in window ||
    "ondeviceproximity" in window
  );
}

export function watchProximity(
  onReading: (reading: ProximityReading) => void,
  onError?: (reason: string) => void,
): SensorSubscription {
  if (typeof window === "undefined") return { supported: false, stop: NOOP };
  const w = window as SensorWindow;

  if (w.ProximitySensor) {
    return watchGenericSensor(
      w.ProximitySensor,
      5,
      (sensor) => {
        onReading({
          near: sensor.near ?? null,
          distanceCm: sensor.distance ?? null,
          maxCm: sensor.max ?? null,
        });
      },
      onError,
    );
  }

  const pw = window as ProximityWindow;
  const hasLegacy = "onuserproximity" in pw || "ondeviceproximity" in pw;
  if (!hasLegacy) return { supported: false, stop: NOOP };

  const onUser = (event: Event) => {
    const ev = event as Event & { near?: boolean };
    onReading({ near: ev.near ?? null, distanceCm: null, maxCm: null });
  };
  const onDevice = (event: Event) => {
    const ev = event as Event & { value?: number; max?: number };
    onReading({
      near: null,
      distanceCm: typeof ev.value === "number" ? ev.value : null,
      maxCm: typeof ev.max === "number" ? ev.max : null,
    });
  };
  window.addEventListener("userproximity", onUser);
  window.addEventListener("deviceproximity", onDevice);
  return {
    supported: true,
    stop: () => {
      window.removeEventListener("userproximity", onUser);
      window.removeEventListener("deviceproximity", onDevice);
    },
  };
}

// ─── Battery ─────────────────────────────────────────────────────────────────

export type BatteryReading = {
  level: number | null;
  charging: boolean | null;
  chargingTimeS: number | null;
  dischargingTimeS: number | null;
};

type BatteryManagerLike = EventTarget & {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
};

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManagerLike>;
};

export function batterySupported(): boolean {
  return batteryAvailable();
}

const BATTERY_EVENTS = [
  "levelchange",
  "chargingchange",
  "chargingtimechange",
  "dischargingtimechange",
] as const;

export async function watchBattery(
  onReading: (reading: BatteryReading) => void,
): Promise<() => void> {
  if (typeof navigator === "undefined") return NOOP;
  const nav = navigator as NavigatorWithBattery;
  if (typeof nav.getBattery !== "function") return NOOP;
  try {
    const battery = await nav.getBattery();
    const emit = () => {
      onReading({
        level: Number.isFinite(battery.level) ? battery.level : null,
        charging: battery.charging,
        chargingTimeS: Number.isFinite(battery.chargingTime) ? battery.chargingTime : null,
        dischargingTimeS: Number.isFinite(battery.dischargingTime)
          ? battery.dischargingTime
          : null,
      });
    };
    emit();
    for (const evt of BATTERY_EVENTS) battery.addEventListener(evt, emit);
    return () => {
      for (const evt of BATTERY_EVENTS) battery.removeEventListener(evt, emit);
    };
  } catch {
    return NOOP;
  }
}

// ─── Microphone level (opt-in) ───────────────────────────────────────────────

export type MicReading = { db: number | null; freqHz: number | null };
export type MicController = { stop: () => void };

type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };

export function micSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/**
 * Opens the mic, builds an AnalyserNode, and reports RMS level (dBFS) plus the
 * dominant frequency (Hz) until `stop()` is called. Returns null when the API
 * is missing or the user denies access. Releases the track + AudioContext on
 * stop so there is no dangling capture indicator.
 */
export async function startMicMeter(
  onReading: (reading: MicReading) => void,
): Promise<MicController | null> {
  if (typeof window === "undefined" || !micSupported()) return null;
  const AudioCtor =
    window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
  if (!AudioCtor) return null;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return null;
  }

  let ctx: AudioContext;
  try {
    ctx = new AudioCtor();
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  const timeData = new Float32Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  let raf = 0;
  let active = true;

  const loop = () => {
    if (!active) return;
    analyser.getFloatTimeDomainData(timeData);
    let sumSq = 0;
    for (let i = 0; i < timeData.length; i += 1) sumSq += timeData[i] * timeData[i];
    const rms = Math.sqrt(sumSq / timeData.length);
    const db = rms > 1e-7 ? 20 * Math.log10(rms) : null;

    analyser.getByteFrequencyData(freqData);
    let maxVal = 0;
    let maxIdx = -1;
    for (let i = 0; i < freqData.length; i += 1) {
      if (freqData[i] > maxVal) {
        maxVal = freqData[i];
        maxIdx = i;
      }
    }
    const nyquist = ctx.sampleRate / 2;
    const freqHz =
      maxIdx >= 0 && maxVal > 8 ? (maxIdx / freqData.length) * nyquist : null;

    onReading({ db, freqHz });
    raf = window.requestAnimationFrame(loop);
  };
  raf = window.requestAnimationFrame(loop);

  return {
    stop: () => {
      active = false;
      if (raf) window.cancelAnimationFrame(raf);
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      void ctx.close().catch(() => {});
    },
  };
}

// ─── Screen orientation ──────────────────────────────────────────────────────

export type OrientationReading = { type: string | null; angle: number | null };

type WindowWithLegacyOrientation = Window & { orientation?: number };

export function readScreenOrientation(): OrientationReading {
  if (typeof window === "undefined") return { type: null, angle: null };
  if (typeof screen !== "undefined" && screen.orientation) {
    return {
      type: screen.orientation.type ?? null,
      angle:
        typeof screen.orientation.angle === "number"
          ? screen.orientation.angle
          : null,
    };
  }
  const legacy = (window as WindowWithLegacyOrientation).orientation;
  return { type: null, angle: typeof legacy === "number" ? legacy : null };
}

export function watchScreenOrientation(
  onChange: (reading: OrientationReading) => void,
): () => void {
  if (typeof window === "undefined") return NOOP;
  const handler = () => onChange(readScreenOrientation());
  if (typeof screen !== "undefined" && screen.orientation) {
    screen.orientation.addEventListener("change", handler);
    return () => screen.orientation.removeEventListener("change", handler);
  }
  window.addEventListener("orientationchange", handler);
  return () => window.removeEventListener("orientationchange", handler);
}

// ─── Hardware / context ──────────────────────────────────────────────────────

export type HardwareInfo = {
  cores: number | null;
  deviceMemoryGb: number | null;
  pixelRatio: number | null;
  maxTouchPoints: number | null;
  online: boolean | null;
};

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

export function readHardwareInfo(): HardwareInfo {
  if (typeof navigator === "undefined") {
    return {
      cores: null,
      deviceMemoryGb: null,
      pixelRatio: null,
      maxTouchPoints: null,
      online: null,
    };
  }
  const nav = navigator as NavigatorWithMemory;
  return {
    cores:
      typeof navigator.hardwareConcurrency === "number"
        ? navigator.hardwareConcurrency
        : null,
    deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    pixelRatio:
      typeof window !== "undefined" && typeof window.devicePixelRatio === "number"
        ? window.devicePixelRatio
        : null,
    maxTouchPoints:
      typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : null,
    online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
  };
}

export function watchOnline(onChange: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return NOOP;
  const goOnline = () => onChange(true);
  const goOffline = () => onChange(false);
  window.addEventListener("online", goOnline);
  window.addEventListener("offline", goOffline);
  return () => {
    window.removeEventListener("online", goOnline);
    window.removeEventListener("offline", goOffline);
  };
}

// ─── Vibration (output) ──────────────────────────────────────────────────────

export function vibrationSupported(): boolean {
  return vibrationAvailable();
}

export function vibrate(pattern: number | number[]): boolean {
  if (!vibrationSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

// ─── Wake Lock (output) ──────────────────────────────────────────────────────

export type WakeLockSentinelLike = EventTarget & {
  released: boolean;
  release: () => Promise<void>;
};

type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };
type NavigatorWithWakeLock = Navigator & { wakeLock?: WakeLockLike };

export function wakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export async function requestWakeLock(): Promise<WakeLockSentinelLike | null> {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as NavigatorWithWakeLock;
  if (!nav.wakeLock) return null;
  try {
    return await nav.wakeLock.request("screen");
  } catch {
    return null;
  }
}
