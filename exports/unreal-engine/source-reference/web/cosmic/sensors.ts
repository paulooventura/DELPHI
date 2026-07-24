import type { SensorSnapshot, UiSpectrum } from "./types";

const STANDARD_PRESSURE_HPA = 1013.25;

type AmbientLightSensorCtor = new (options?: { frequency?: number }) => {
  illuminance: number;
  start: () => void;
  stop: () => void;
  addEventListener: (type: "reading" | "error", cb: () => void) => void;
};

type WindowWithALS = Window & { AmbientLightSensor?: AmbientLightSensorCtor };

/** Map lux → UI spectrum (blue day ↔ amber night). */
export function luxToSpectrum(lux: number | null): UiSpectrum {
  if (lux == null || !Number.isFinite(lux)) {
    return { hue: 42, warmth: 0.55, accent: "#c9a227" };
  }
  const clamped = Math.max(0, Math.min(lux, 10000));
  const t = Math.log10(clamped + 1) / Math.log10(10001);
  const hue = 200 - t * 165;
  const warmth = 1 - t;
  const accent = warmth > 0.5 ? "#c9a227" : "#38bdf8";
  return { hue, warmth, accent };
}

export function pressureToBreath(pressureHpa: number | null): number {
  if (pressureHpa == null || !Number.isFinite(pressureHpa)) return 0.5;
  const delta = pressureHpa - STANDARD_PRESSURE_HPA;
  const norm = Math.max(-1, Math.min(1, delta / 25));
  return 0.5 + norm * 0.45;
}

export function buildSensorSnapshot(partial: {
  lat: number;
  lon: number;
  headingDeg?: number | null;
  altitudeM?: number | null;
  pressureHpa?: number | null;
  lux?: number | null;
}): SensorSnapshot {
  const pressureHpa = partial.pressureHpa ?? null;
  const lux = partial.lux ?? null;
  return {
    lat: partial.lat,
    lon: partial.lon,
    pressureHpa,
    pressureDeltaHpa: pressureHpa != null ? pressureHpa - STANDARD_PRESSURE_HPA : null,
    lux,
    lightSpectrum: luxToSpectrum(lux).warmth,
    atmosphericBreath: pressureToBreath(pressureHpa),
    headingDeg: partial.headingDeg ?? null,
    altitudeM: partial.altitudeM ?? null,
  };
}

/** Web Ambient Light Sensor (Chrome/Android; permission may be required). */
export function watchAmbientLux(onLux: (lux: number) => void): () => void {
  const w = window as WindowWithALS;
  const Ctor = w.AmbientLightSensor;
  if (!Ctor) return () => {};

  try {
    const sensor = new Ctor({ frequency: 5 });
    const onReading = () => {
      if (Number.isFinite(sensor.illuminance)) onLux(sensor.illuminance);
    };
    sensor.addEventListener("reading", onReading);
    sensor.start();
    return () => {
      try { sensor.stop(); } catch { /* ignore */ }
    };
  } catch {
    return () => {};
  }
}
