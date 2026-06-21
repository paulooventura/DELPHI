"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ambientLightSupported,
  batterySupported,
  gForceFromAccel,
  magnetometerSupported,
  micSupported,
  motionNeedsPermission,
  motionSupported,
  pressureSupport,
  proximitySupported,
  readHardwareInfo,
  readScreenOrientation,
  requestMotionPermission,
  requestWakeLock,
  startMicMeter,
  tiltFromAccelG,
  vibrate as fireVibration,
  vibrationSupported,
  wakeLockSupported,
  watchAmbientLight,
  watchBattery,
  watchMagnetometer,
  watchMotion,
  watchOnline,
  watchPressure,
  watchProximity,
  watchScreenOrientation,
  type MicController,
  type MotionReading,
  type SensorStatus,
  type WakeLockSentinelLike,
} from "../lib/deviceSensors";

export type AmbientCallback = (ambient: {
  lux: number | null;
  pressureHpa: number | null;
}) => void;

export type UseDeviceSensorsOptions = {
  /** Called (throttled ~2/sec) whenever lux or pressure changes. */
  onAmbient?: AmbientCallback;
};

export type DeviceSensorsState = {
  motion: {
    status: SensorStatus;
    accelG: { x: number | null; y: number | null; z: number | null };
    accel: { x: number | null; y: number | null; z: number | null };
    rotation: { alpha: number | null; beta: number | null; gamma: number | null };
    tiltDeg: number | null;
    gForce: number | null;
    intervalMs: number | null;
  };
  shake: { status: SensorStatus; count: number; intensity: number | null };
  steps: { status: SensorStatus; count: number; cadenceSpm: number | null };
  light: { status: SensorStatus; lux: number | null };
  proximity: { status: SensorStatus; near: boolean | null; distanceCm: number | null };
  battery: {
    status: SensorStatus;
    level: number | null;
    charging: boolean | null;
    chargingTimeS: number | null;
    dischargingTimeS: number | null;
  };
  mic: { status: SensorStatus; db: number | null; freqHz: number | null };
  pressure: { status: SensorStatus; hpa: number | null; method: string };
  magnetometer: { status: SensorStatus; ut: number | null };
  orientation: { status: SensorStatus; type: string | null; angle: number | null };
  hardware: {
    cores: number | null;
    deviceMemoryGb: number | null;
    pixelRatio: number | null;
    maxTouchPoints: number | null;
    online: boolean | null;
  };
  vibration: { status: SensorStatus };
  wakeLock: { status: SensorStatus; active: boolean };
};

export type DeviceSensorsControls = {
  enableMotion: () => Promise<void>;
  enableMic: () => Promise<void>;
  disableMic: () => void;
  pulse: (pattern?: number | number[]) => void;
  toggleWakeLock: () => Promise<void>;
};

const SHAKE_THRESHOLD = 14; // m/s² delta
const SHAKE_DEBOUNCE_MS = 320;
const STEP_THRESHOLD = 1.7; // m/s² above running mean magnitude
const STEP_MIN_INTERVAL_MS = 260; // ~230 steps/min ceiling
const CADENCE_WINDOW_MS = 6000;
const FLUSH_MS = 120;
const AMBIENT_THROTTLE_MS = 500;
const MOTION_PROBE_MS = 1500;

function createInitialState(): DeviceSensorsState {
  return {
    motion: {
      status: "idle",
      accelG: { x: null, y: null, z: null },
      accel: { x: null, y: null, z: null },
      rotation: { alpha: null, beta: null, gamma: null },
      tiltDeg: null,
      gForce: null,
      intervalMs: null,
    },
    shake: { status: "idle", count: 0, intensity: null },
    steps: { status: "idle", count: 0, cadenceSpm: null },
    light: { status: "idle", lux: null },
    proximity: { status: "idle", near: null, distanceCm: null },
    battery: {
      status: "idle",
      level: null,
      charging: null,
      chargingTimeS: null,
      dischargingTimeS: null,
    },
    mic: { status: "idle", db: null, freqHz: null },
    pressure: { status: "idle", hpa: null, method: "none" },
    magnetometer: { status: "idle", ut: null },
    orientation: { status: "idle", type: null, angle: null },
    hardware: {
      cores: null,
      deviceMemoryGb: null,
      pixelRatio: null,
      maxTouchPoints: null,
      online: null,
    },
    vibration: { status: "idle" },
    wakeLock: { status: "idle", active: false },
  };
}

function cloneState(s: DeviceSensorsState): DeviceSensorsState {
  return {
    motion: { ...s.motion, accelG: { ...s.motion.accelG }, accel: { ...s.motion.accel }, rotation: { ...s.motion.rotation } },
    shake: { ...s.shake },
    steps: { ...s.steps },
    light: { ...s.light },
    proximity: { ...s.proximity },
    battery: { ...s.battery },
    mic: { ...s.mic },
    pressure: { ...s.pressure },
    magnetometer: { ...s.magnetometer },
    orientation: { ...s.orientation },
    hardware: { ...s.hardware },
    vibration: { ...s.vibration },
    wakeLock: { ...s.wakeLock },
  };
}

/**
 * Aggregates every available device sensor into one reactive state object plus
 * control functions. All listeners/streams are torn down on unmount and on
 * disable. State commits are throttled (~8/sec) so high-frequency motion/mic
 * data never floods React.
 */
export function useDeviceSensors(
  options: UseDeviceSensorsOptions = {},
): { state: DeviceSensorsState; controls: DeviceSensorsControls } {
  const [state, setState] = useState<DeviceSensorsState>(createInitialState);

  const dataRef = useRef<DeviceSensorsState>(state);
  const dirtyRef = useRef(false);

  // Latest onAmbient without re-subscribing sensors.
  const onAmbientRef = useRef<AmbientCallback | undefined>(options.onAmbient);
  useEffect(() => {
    onAmbientRef.current = options.onAmbient;
  }, [options.onAmbient]);
  const lastAmbientEmitRef = useRef(0);
  const luxRef = useRef<number | null>(null);
  const pressureRef = useRef<number | null>(null);

  // Motion-derived accumulators.
  const lastAccelGRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const lastShakeAtRef = useRef(0);
  const magMeanRef = useRef<number | null>(null);
  const lastStepAtRef = useRef(0);
  const stepTimesRef = useRef<number[]>([]);
  const motionStartedRef = useRef(false);

  // Subscription teardown handles.
  const motionStopRef = useRef<() => void>(() => {});
  const micStopRef = useRef<MicController | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const wakeLockWantedRef = useRef(false);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const maybeEmitAmbient = useCallback(() => {
    const cb = onAmbientRef.current;
    if (!cb) return;
    const now = Date.now();
    if (now - lastAmbientEmitRef.current < AMBIENT_THROTTLE_MS) return;
    lastAmbientEmitRef.current = now;
    cb({ lux: luxRef.current, pressureHpa: pressureRef.current });
  }, []);

  // ── Motion / shake / steps shared handler ─────────────────────────────────
  const handleMotion = useCallback(
    (reading: MotionReading) => {
      const d = dataRef.current;
      motionStartedRef.current = true;

      d.motion.accelG = { ...reading.accelG };
      d.motion.accel = { ...reading.accel };
      d.motion.rotation = { ...reading.rotation };
      d.motion.intervalMs = reading.intervalMs;
      d.motion.tiltDeg = tiltFromAccelG(reading.accelG.x, reading.accelG.y, reading.accelG.z);
      d.motion.gForce = gForceFromAccel(reading.accel.x, reading.accel.y, reading.accel.z);
      d.motion.status = "live";
      d.shake.status = "live";
      d.steps.status = "live";

      const { x, y, z } = reading.accelG;
      if (x != null && y != null && z != null) {
        const now = Date.now();

        // Shake: large frame-to-frame change in the gravity-inclusive vector.
        const prev = lastAccelGRef.current;
        if (prev) {
          const delta = Math.sqrt(
            (x - prev.x) ** 2 + (y - prev.y) ** 2 + (z - prev.z) ** 2,
          );
          d.shake.intensity = delta;
          if (delta > SHAKE_THRESHOLD && now - lastShakeAtRef.current > SHAKE_DEBOUNCE_MS) {
            lastShakeAtRef.current = now;
            d.shake.count += 1;
          }
        }
        lastAccelGRef.current = { x, y, z };

        // Pedometer: peak detection on the de-meaned magnitude.
        const mag = Math.sqrt(x * x + y * y + z * z);
        const mean = magMeanRef.current;
        magMeanRef.current = mean == null ? mag : mean * 0.9 + mag * 0.1;
        const baseline = magMeanRef.current ?? mag;
        if (
          mag - baseline > STEP_THRESHOLD &&
          now - lastStepAtRef.current > STEP_MIN_INTERVAL_MS
        ) {
          lastStepAtRef.current = now;
          d.steps.count += 1;
          const times = stepTimesRef.current;
          times.push(now);
          while (times.length > 0 && now - times[0] > CADENCE_WINDOW_MS) times.shift();
          if (times.length >= 2) {
            const span = times[times.length - 1] - times[0];
            d.steps.cadenceSpm = span > 0 ? ((times.length - 1) / span) * 60000 : null;
          }
        } else {
          const times = stepTimesRef.current;
          while (times.length > 0 && now - times[0] > CADENCE_WINDOW_MS) times.shift();
          if (times.length < 2) d.steps.cadenceSpm = 0;
        }
      }
      markDirty();
    },
    [markDirty],
  );

  const startMotionListeners = useCallback(() => {
    if (motionStartedRef.current && dataRef.current.motion.status === "live") return;
    motionStopRef.current();
    motionStopRef.current = watchMotion(handleMotion);
  }, [handleMotion]);

  const enableMotion = useCallback(async () => {
    if (!motionSupported()) {
      const d = dataRef.current;
      d.motion.status = "unsupported";
      d.shake.status = "unsupported";
      d.steps.status = "unsupported";
      markDirty();
      return;
    }
    const granted = await requestMotionPermission();
    if (!granted) {
      const d = dataRef.current;
      d.motion.status = "denied";
      d.shake.status = "denied";
      d.steps.status = "denied";
      markDirty();
      return;
    }
    startMotionListeners();
  }, [markDirty, startMotionListeners]);

  // ── Mic controls ──────────────────────────────────────────────────────────
  const disableMic = useCallback(() => {
    micStopRef.current?.stop();
    micStopRef.current = null;
    const d = dataRef.current;
    d.mic.status = micSupported() ? "idle" : "unsupported";
    d.mic.db = null;
    d.mic.freqHz = null;
    markDirty();
  }, [markDirty]);

  const enableMic = useCallback(async () => {
    if (!micSupported()) {
      dataRef.current.mic.status = "unsupported";
      markDirty();
      return;
    }
    if (micStopRef.current) return;
    const controller = await startMicMeter((reading) => {
      const d = dataRef.current;
      d.mic.db = reading.db;
      d.mic.freqHz = reading.freqHz;
      d.mic.status = "live";
      markDirty();
    });
    if (!controller) {
      dataRef.current.mic.status = "denied";
      markDirty();
      return;
    }
    micStopRef.current = controller;
    dataRef.current.mic.status = "live";
    markDirty();
  }, [markDirty]);

  // ── Vibration ───────────────────────────────────────────────────────────────
  const pulse = useCallback(
    (pattern: number | number[] = [40, 60, 120]) => {
      fireVibration(pattern);
    },
    [],
  );

  // ── Wake lock ─────────────────────────────────────────────────────────────
  const releaseWakeLock = useCallback(() => {
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    if (sentinel) void sentinel.release().catch(() => {});
    dataRef.current.wakeLock.active = false;
    markDirty();
  }, [markDirty]);

  const acquireWakeLock = useCallback(async () => {
    const sentinel = await requestWakeLock();
    if (!sentinel) {
      dataRef.current.wakeLock.status = "denied";
      dataRef.current.wakeLock.active = false;
      markDirty();
      return;
    }
    wakeLockRef.current = sentinel;
    const onRelease = () => {
      if (wakeLockRef.current === sentinel) {
        wakeLockRef.current = null;
        dataRef.current.wakeLock.active = false;
        markDirty();
      }
    };
    sentinel.addEventListener("release", onRelease);
    dataRef.current.wakeLock.status = "live";
    dataRef.current.wakeLock.active = true;
    markDirty();
  }, [markDirty]);

  const toggleWakeLock = useCallback(async () => {
    if (!wakeLockSupported()) {
      dataRef.current.wakeLock.status = "unsupported";
      markDirty();
      return;
    }
    if (wakeLockWantedRef.current) {
      wakeLockWantedRef.current = false;
      releaseWakeLock();
    } else {
      wakeLockWantedRef.current = true;
      await acquireWakeLock();
    }
  }, [acquireWakeLock, markDirty, releaseWakeLock]);

  // ── Auto-start sensors + commit loop ───────────────────────────────────────
  useEffect(() => {
    const d = dataRef.current;

    // Static / one-shot context.
    d.hardware = readHardwareInfo();
    const orientation = readScreenOrientation();
    d.orientation = {
      status: typeof screen !== "undefined" && screen.orientation ? "live" : "idle",
      type: orientation.type,
      angle: orientation.angle,
    };
    d.vibration.status = vibrationSupported() ? "idle" : "unsupported";
    d.wakeLock.status = wakeLockSupported() ? "idle" : "unsupported";
    d.mic.status = micSupported() ? "idle" : "unsupported";
    markDirty();

    // Light.
    if (!ambientLightSupported()) d.light.status = "unsupported";
    const light = watchAmbientLight(
      (lux) => {
        luxRef.current = lux;
        dataRef.current.light.lux = lux;
        dataRef.current.light.status = "live";
        maybeEmitAmbient();
        markDirty();
      },
      (reason) => {
        dataRef.current.light.status = reason === "NotAllowedError" ? "denied" : "unsupported";
        markDirty();
      },
    );

    // Magnetometer.
    if (!magnetometerSupported()) d.magnetometer.status = "unsupported";
    const mag = watchMagnetometer(
      (ut) => {
        dataRef.current.magnetometer.ut = ut;
        dataRef.current.magnetometer.status = "live";
        markDirty();
      },
      (reason) => {
        dataRef.current.magnetometer.status = reason === "NotAllowedError" ? "denied" : "unsupported";
        markDirty();
      },
    );

    // Pressure.
    const support = pressureSupport();
    d.pressure.method = support;
    if (support === "none") d.pressure.status = "unsupported";
    const pressure = watchPressure(
      (hpa) => {
        pressureRef.current = hpa;
        dataRef.current.pressure.hpa = hpa;
        dataRef.current.pressure.status = "live";
        maybeEmitAmbient();
        markDirty();
      },
      (reason) => {
        dataRef.current.pressure.status = reason === "NotAllowedError" ? "denied" : "unsupported";
        markDirty();
      },
      () => {
        // Compute Pressure liveness only (no hPa available).
        if (dataRef.current.pressure.status !== "live") {
          dataRef.current.pressure.status = "live";
          markDirty();
        }
      },
    );

    // Proximity.
    if (!proximitySupported()) d.proximity.status = "unsupported";
    const proximity = watchProximity(
      (reading) => {
        dataRef.current.proximity.near = reading.near;
        dataRef.current.proximity.distanceCm = reading.distanceCm;
        dataRef.current.proximity.status = "live";
        markDirty();
      },
      (reason) => {
        dataRef.current.proximity.status = reason === "NotAllowedError" ? "denied" : "unsupported";
        markDirty();
      },
    );

    // Battery (async).
    let batteryStop: (() => void) | null = null;
    if (!batterySupported()) {
      d.battery.status = "unsupported";
    } else {
      void watchBattery((reading) => {
        const b = dataRef.current.battery;
        b.level = reading.level;
        b.charging = reading.charging;
        b.chargingTimeS = reading.chargingTimeS;
        b.dischargingTimeS = reading.dischargingTimeS;
        b.status = "live";
        markDirty();
      }).then((stop) => {
        batteryStop = stop;
      });
    }

    // Orientation live updates.
    const orientationStop = watchScreenOrientation((reading) => {
      dataRef.current.orientation.type = reading.type;
      dataRef.current.orientation.angle = reading.angle;
      markDirty();
    });

    // Online/offline.
    const onlineStop = watchOnline((online) => {
      dataRef.current.hardware.online = online;
      markDirty();
    });

    // Motion: gesture-gated on iOS, auto-attempt elsewhere.
    let motionProbe: number | undefined;
    if (!motionSupported()) {
      d.motion.status = "unsupported";
      d.shake.status = "unsupported";
      d.steps.status = "unsupported";
    } else if (motionNeedsPermission()) {
      d.motion.status = "permission-required";
      d.shake.status = "permission-required";
      d.steps.status = "permission-required";
    } else {
      startMotionListeners();
      motionProbe = window.setTimeout(() => {
        if (!motionStartedRef.current) {
          const dd = dataRef.current;
          dd.motion.status = "permission-required";
          dd.shake.status = "permission-required";
          dd.steps.status = "permission-required";
          markDirty();
        }
      }, MOTION_PROBE_MS);
    }
    markDirty();

    // Throttled commit loop.
    const flush = window.setInterval(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setState(cloneState(dataRef.current));
    }, FLUSH_MS);

    // Re-acquire wake lock when the page becomes visible again.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && wakeLockWantedRef.current && !wakeLockRef.current) {
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      light.stop();
      mag.stop();
      pressure.stop();
      proximity.stop();
      orientationStop();
      onlineStop();
      motionStopRef.current();
      motionStopRef.current = () => {};
      if (batteryStop) batteryStop();
      if (motionProbe) window.clearTimeout(motionProbe);
      window.clearInterval(flush);
      document.removeEventListener("visibilitychange", onVisibility);
      micStopRef.current?.stop();
      micStopRef.current = null;
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel) void sentinel.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    controls: { enableMotion, enableMic, disableMic, pulse, toggleWakeLock },
  };
}
