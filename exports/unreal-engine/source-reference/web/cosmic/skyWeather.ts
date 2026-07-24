/**
 * Local-weather sky appearance — drives canvas gradients, clouds, rain, and star visibility.
 */

export type SkyWeatherSlot = {
  condition?: string;
  weatherCode?: number | null;
  cloudCover?: number | null;
  precipProb?: number | null;
  isDay?: boolean;
};

export type SkyWeatherAppearance = {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  vignette: string;
  cloudCover: number;
  cloudBrightness: number;
  starScale: number;
  rainIntensity: number;
  fogOpacity: number;
  effectiveWarmth: number;
  isDay: boolean;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function isPrecipCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
}

function isFogCode(code: number): boolean {
  return code === 45 || code === 48;
}

/** Resolve canvas palette + layer intensities from Open-Meteo slot + lux warmth. */
export function resolveSkyWeatherAppearance(
  slot: SkyWeatherSlot | null | undefined,
  warmth = 0.55,
): SkyWeatherAppearance {
  const code = slot?.weatherCode ?? 0;
  const cloudPct = slot?.cloudCover ?? (code === 3 ? 95 : code === 2 ? 55 : code === 1 ? 25 : 8);
  const cloudCover = clamp01(cloudPct / 100);
  const isDay = slot?.isDay ?? true;
  const precipProb = slot?.precipProb ?? 0;
  const raining = isPrecipCode(code) || precipProb > 45;
  const snowy = isSnowCode(code);
  const foggy = isFogCode(code);

  let skyTop: string;
  let skyMid: string;
  let skyBottom: string;
  let vignette: string;
  let starScale: number;
  let cloudBrightness: number;

  if (!isDay) {
    skyTop = cloudCover > 0.55 ? "#0a0d14" : "#030508";
    skyMid = cloudCover > 0.55 ? "#121820" : "#070b12";
    skyBottom = cloudCover > 0.55 ? "#1a2230" : "#101620";
    vignette = "rgba(15, 23, 42, 0.35)";
    starScale = clamp01((1 - cloudCover * 0.92) * (foggy ? 0.15 : 1));
    cloudBrightness = 0.22 + cloudCover * 0.18;
  } else if (cloudCover > 0.72 || code === 3) {
    skyTop = "#5a6472";
    skyMid = "#6e7888";
    skyBottom = "#8a939f";
    vignette = "rgba(71, 85, 105, 0.18)";
    starScale = 0.04;
    cloudBrightness = 0.55;
  } else if (cloudCover > 0.35 || code === 2) {
    skyTop = "#3d5a80";
    skyMid = "#5c7a9e";
    skyBottom = "#8aa4c0";
    vignette = "rgba(96, 165, 250, 0.08)";
    starScale = 0.08;
    cloudBrightness = 0.42;
  } else {
    skyTop = "#1e4a7a";
    skyMid = "#3d6fa5";
    skyBottom = "#7eb3e8";
    vignette = "rgba(96, 165, 250, 0.06)";
    starScale = 0.05;
    cloudBrightness = 0.3;
  }

  const rainIntensity = raining ? clamp01(0.35 + precipProb / 140 + (code >= 65 ? 0.25 : 0)) : 0;
  const fogOpacity = foggy ? clamp01(0.35 + cloudCover * 0.4) : clamp01(cloudCover * 0.08);

  let effectiveWarmth = warmth;
  if (!isDay) {
    effectiveWarmth = Math.max(warmth, 0.68 + cloudCover * 0.12);
  } else {
    effectiveWarmth = warmth * (1 - cloudCover * 0.35);
  }
  if (snowy) {
    cloudBrightness = Math.min(0.75, cloudBrightness + 0.15);
  }

  return {
    skyTop,
    skyMid,
    skyBottom,
    vignette,
    cloudCover,
    cloudBrightness,
    starScale,
    rainIntensity,
    fogOpacity,
    effectiveWarmth,
    isDay,
  };
}

/** Damp lux estimate when overcast or at night so UI warmth matches outside. */
export function weatherAdjustedLux(
  lux: number | null,
  cloudCoverPct: number | null | undefined,
  isDay: boolean,
): number | null {
  if (lux == null || !Number.isFinite(lux)) return null;
  const cover = clamp01((cloudCoverPct ?? 0) / 100);
  let out = lux * (1 - cover * 0.7);
  if (!isDay) out = Math.min(out, 65);
  return Math.max(0, out);
}

function puff(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number,
  bright: number,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  const core = `rgba(${Math.round(220 * bright)}, ${Math.round(228 * bright)}, ${Math.round(238 * bright)}, ${alpha})`;
  const edge = `rgba(${Math.round(180 * bright)}, ${Math.round(190 * bright)}, ${Math.round(205 * bright)}, 0)`;
  g.addColorStop(0, core);
  g.addColorStop(0.55, core.replace(/[\d.]+\)$/, `${alpha * 0.55})`));
  g.addColorStop(1, edge);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Soft procedural cloud field — cover 0–1. */
export function drawCloudLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cover: number,
  bright: number,
  isDay: boolean,
  timeSec: number,
) {
  if (cover < 0.06) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const layers = Math.floor(3 + cover * 5);
  for (let i = 0; i < layers; i++) {
    const seed = i * 97.13 + 0.5;
    const drift = Math.sin(timeSec * 0.018 + seed) * 18;
    const x = (((seed * 0.618) % 1) * 1.25 - 0.12) * w + drift;
    const y = (((seed * 0.371) % 1) * 0.42 + 0.04) * h;
    const rx = (0.14 + (seed % 0.12)) * w * (0.35 + cover * 0.45);
    const ry = rx * (0.28 + (seed % 0.08));
    const alpha = (0.08 + cover * 0.22) * (isDay ? 1 : 0.75);
    puff(ctx, x, y, rx, ry, alpha, bright);
    puff(ctx, x + rx * 0.35, y - ry * 0.2, rx * 0.65, ry * 0.85, alpha * 0.9, bright);
    puff(ctx, x - rx * 0.28, y + ry * 0.1, rx * 0.55, ry * 0.8, alpha * 0.85, bright);
  }
  ctx.restore();
}

export function drawRainLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  intensity: number,
  timeSec: number,
) {
  if (intensity < 0.05) return;
  ctx.save();
  ctx.strokeStyle = `rgba(148, 163, 184, ${0.12 + intensity * 0.35})`;
  ctx.lineWidth = 0.8;
  const count = Math.floor(40 + intensity * 120);
  for (let i = 0; i < count; i++) {
    const seed = i * 31.7;
    const x = ((seed * 0.91) % 1) * w;
    const phase = (timeSec * (90 + (seed % 40)) + seed * 40) % h;
    const y = phase;
    const len = 8 + (seed % 10) + intensity * 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y + len);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFogLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opacity: number,
) {
  if (opacity < 0.04) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, h * 0.35, 0, h);
  g.addColorStop(0, `rgba(200, 210, 220, ${opacity * 0.15})`);
  g.addColorStop(0.6, `rgba(180, 190, 200, ${opacity * 0.35})`);
  g.addColorStop(1, `rgba(160, 170, 180, ${opacity * 0.5})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function lerpAppearance(
  prev: SkyWeatherAppearance,
  next: SkyWeatherAppearance,
  t: number,
): SkyWeatherAppearance {
  const a = clamp01(t);
  const lerp = (x: number, y: number) => x + (y - x) * a;
  return {
    ...next,
    cloudCover: lerp(prev.cloudCover, next.cloudCover),
    cloudBrightness: lerp(prev.cloudBrightness, next.cloudBrightness),
    starScale: lerp(prev.starScale, next.starScale),
    rainIntensity: lerp(prev.rainIntensity, next.rainIntensity),
    fogOpacity: lerp(prev.fogOpacity, next.fogOpacity),
    effectiveWarmth: lerp(prev.effectiveWarmth, next.effectiveWarmth),
    skyTop: next.skyTop,
    skyMid: next.skyMid,
    skyBottom: next.skyBottom,
    vignette: next.vignette,
    isDay: next.isDay,
  };
}

/** Build slot from cycles weather + current hour. */
export function weatherSlotForHour(
  weather: {
    condition: string;
    weatherCode?: number | null;
    cloudCover?: number | null;
    isDay?: boolean;
    precipProb?: number | null;
    hourly?: Array<{
      hour: number;
      condition: string;
      weatherCode?: number | null;
      cloudCover?: number | null;
      precipProb?: number | null;
      isDay?: boolean;
    }>;
  } | null | undefined,
  date: Date,
): SkyWeatherSlot | null {
  if (!weather) return null;
  const hour = date.getHours();
  const slot = weather.hourly?.find(h => h.hour === hour);
  return {
    condition: slot?.condition ?? weather.condition,
    weatherCode: slot?.weatherCode ?? weather.weatherCode ?? null,
    cloudCover: slot?.cloudCover ?? weather.cloudCover ?? null,
    precipProb: slot?.precipProb ?? weather.precipProb ?? null,
    isDay: slot?.isDay ?? weather.isDay ?? (hour >= 6 && hour < 20),
  };
}
