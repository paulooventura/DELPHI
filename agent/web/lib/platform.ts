/** Lightweight platform sniffing for sensor capability messaging. */

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** Safari (including iOS) blocks many hardware APIs in the web view. */
export function isSafariLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);
}

/** iOS Safari exposes vibrate but ignores it. */
export function vibrationAvailable(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  return !isIOS();
}

/** Battery Status API is unavailable in iOS Safari / installed PWAs. */
export function batteryAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isIOS()) return false;
  return "getBattery" in navigator;
}

/** Generic Sensor API (AmbientLight, Barometer, Proximity, Magnetometer). */
export function genericSensorsLikely(): boolean {
  if (typeof window === "undefined") return false;
  if (isIOS()) return false;
  return isAndroid() || ("AmbientLightSensor" in window);
}

/** Rough outdoor lux from solar day angle (0° = solar noon). */
export function estimateOutdoorLux(solarDayAngleDeg: number | null | undefined): number | null {
  if (solarDayAngleDeg == null || !Number.isFinite(solarDayAngleDeg)) return null;
  const elevDeg = 90 - Math.abs(solarDayAngleDeg);
  if (elevDeg <= -6) return 0.5;
  const elevRad = (Math.max(0, elevDeg) * Math.PI) / 180;
  return Math.round(110_000 * Math.sin(elevRad));
}

export const SENSOR_HINTS = {
  proximity:
    "Uses the front IR sensor — reports NEAR when your hand/face is close (mostly Android).",
  magnetometer:
    "Measures Earth's magnetic field (µT). Strong spikes = nearby metal or EMF; steady ~25–65 µT is normal.",
  barometer:
    "Hardware barometer reads air pressure. Safari/iOS does not expose it — we fall back to weather data.",
  ambientLight:
    "Hardware light sensor in lux. Not available in iOS Safari — estimated from sun position when possible.",
  battery:
    "Device charge level. iOS Safari does not expose battery APIs to websites.",
  vibration:
    "Triggers the phone vibration motor. iOS Safari does not support the Vibration API.",
} as const;
