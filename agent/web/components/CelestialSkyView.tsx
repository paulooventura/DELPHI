"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { AircraftTrack } from "../lib/cosmic/aircraftTracking";
import {
  computeCelestialBodies,
  sampleEclipticPath,
  sampleMeridianArcs,
  type CelestialBody,
} from "../lib/cosmic/celestialBodies";
import { computeMinorBodies, type MinorBody } from "../lib/cosmic/minorBodies";
import { createPinchGestureController } from "../lib/cosmic/pinchGesture";
import {
  clusterSatellites,
  computeSatelliteTracks,
  parseTLECatalog,
  DEFAULT_TLE_CATALOG,
  type SatelliteCluster,
  type SatelliteTrack,
} from "../lib/cosmic/satelliteTracking";
import { createSkyHapticController } from "../lib/cosmic/skyHaptics";
import {
  createZoomedSkyProjector,
  formatZoom,
  getSkyDetailLevel,
  planetTextureBlend,
  shouldClusterSatellites,
  starFieldOpacity,
} from "../lib/cosmic/skyZoom";
import { angularSeparationDeg } from "../lib/cosmic/celestialBodies";
import {
  drawAircraftGlyph,
  drawAsteroidGlyph,
  drawCometGlyph,
  drawConstellationLabel,
  drawConstellationLines,
  drawDeepSkyGlyph,
  drawMoonGlyph,
  drawPlanetGlyph,
  drawSatelliteClusterGlyph,
  drawSatelliteGlyph,
  drawStarGlyph,
  drawSunGlyph,
} from "../lib/cosmic/skyIcons";
import { CONSTELLATION_FIGURES } from "../lib/constellationLines";
import { DEEP_SKY_OBJECTS } from "../lib/deepSkyCatalog";
import { BRIGHT_STARS } from "../lib/brightStars";
import { milkyWayCloud } from "../lib/milkyWay";
import { raDecToAltAz } from "../lib/skyPositions";
import { OBS, spectrumAccent } from "../lib/design/observatoryTokens";
import { smoothViewAzAltAdaptive } from "../lib/sensorSmoothing";
import {
  altAzToEnu,
  buildStableViewBasis,
  enuToAltAz,
  groundBlendFromView,
  type Vec3,
  type ViewBasis,
  type SkyProjector,
} from "../lib/sphericalView";
import {
  drawCloudLayer,
  drawFogLayer,
  drawRainLayer,
  lerpAppearance,
  resolveSkyWeatherAppearance,
  type SkyWeatherSlot,
} from "../lib/cosmic/skyWeather";
import { skyObjectsInView } from "../lib/starmap";
import { generateMockAircraft, computeAircraftTracks } from "../lib/cosmic/aircraftTracking";
import { loreForSkyObject } from "../lib/skyObjectLore";
import { SkyObjectDetailPanel, type SkyObjectDetail } from "./SkyObjectDetailPanel";

export type LiveAttitude = { view: Vec3; roll: number };

export type CelestialSkyViewProps = {
  lat: number;
  lon: number;
  /** Observer elevation (m) for topocentric parallax. */
  observerAltM?: number;
  headingDeg: number;
  pitchDeg: number;
  /** When set, the canvas reads attitude every frame without React re-renders. */
  liveAttitudeRef?: RefObject<LiveAttitude>;
  observationTime: Date;
  distanceRank?: number;
  liveHeading?: boolean;
  livePitch?: boolean;
  /** When false, skip target lock (phone too flat / invalid AR pose). */
  arPoseReady?: boolean;
  hapticsEnabled?: boolean;
  warmth?: number;
  /** Open-Meteo slot for local sky palette + clouds */
  weather?: SkyWeatherSlot | null;
  className?: string;
};

type Trackable = {
  id: string;
  kind: "planet" | "satellite" | "satellite-cluster" | "aircraft" | "asteroid" | "comet" | "deepsky" | "star";
  name: string;
  az: number;
  alt: number;
  gsKnots?: number;
  baroAltFt?: number;
  altKm?: number;
  magnitude?: number;
  bodyId?: string;
  iconKind?: AircraftTrack["iconKind"];
  depIata?: string;
  arrIata?: string;
  airlineIata?: string;
  aircraftIcao?: string;
  regNumber?: string;
  status?: string;
  verticalRateMps?: number;
  rangeM?: number;
};

type HitTarget = {
  id: string;
  x: number;
  y: number;
  radius: number;
  trackable: Trackable;
};

const KIND_META: Record<Trackable["kind"], { label: string; emoji: string; accent: string }> = {
  planet: { label: "Planet", emoji: "🪐", accent: "#a5b4fc" },
  satellite: { label: "Satellite", emoji: "🛰", accent: "#7dd3fc" },
  "satellite-cluster": { label: "Satellite cluster", emoji: "🛰", accent: "#7dd3fc" },
  aircraft: { label: "Aircraft", emoji: "✈", accent: "#cbd5e1" },
  asteroid: { label: "Asteroid", emoji: "◇", accent: "#d6d3d1" },
  comet: { label: "Comet", emoji: "☄", accent: "#bae6fd" },
  deepsky: { label: "Deep sky", emoji: "✦", accent: "#c4b5fd" },
  star: { label: "Star", emoji: "★", accent: "#fde68a" },
};

function buildObjectDetail(
  trackable: Trackable,
  bodies: CelestialBody[],
  minorBodies: MinorBody[],
  observationTime: Date,
): SkyObjectDetail {
  const meta = KIND_META[trackable.kind];
  const lines: Array<{ label: string; value: string }> = [
    { label: "Azimuth", value: `${Math.round(trackable.az)}°` },
    { label: "Elevation", value: `${Math.round(trackable.alt)}°` },
  ];

  const planet = bodies.find(b => b.id === trackable.id);
  if (planet) {
    lines.push(
      { label: "Magnitude", value: planet.magnitude.toFixed(1) },
      { label: "Right ascension", value: `${planet.raHours.toFixed(2)} h` },
      { label: "Declination", value: `${planet.decDeg.toFixed(2)}°` },
    );
  }

  const minor = minorBodies.find(m => m.id === trackable.id);
  if (minor) {
    lines.push(
      { label: "Type", value: minor.kind === "comet" ? "Comet" : "Main-belt asteroid" },
      { label: "Magnitude", value: minor.magnitude.toFixed(1) },
    );
  }

  if (trackable.gsKnots != null) {
    if (trackable.depIata && trackable.arrIata) {
      lines.push({ label: "Route", value: `${trackable.depIata} → ${trackable.arrIata}` });
    }
    if (trackable.airlineIata) {
      lines.push({ label: "Airline", value: trackable.airlineIata });
    }
    if (trackable.aircraftIcao) {
      lines.push({ label: "Aircraft", value: trackable.aircraftIcao });
    }
    if (trackable.regNumber) {
      lines.push({ label: "Registration", value: trackable.regNumber });
    }
    if (trackable.status) {
      lines.push({ label: "Status", value: trackable.status });
    }
    lines.push(
      { label: "Ground speed", value: `${Math.round(trackable.gsKnots)} kt` },
      { label: "Altitude", value: `${Math.round(trackable.baroAltFt ?? 0).toLocaleString()} ft` },
    );
    if (trackable.rangeM != null) {
      lines.push({ label: "Slant range", value: `${(trackable.rangeM / 1000).toFixed(1)} km` });
    }
    if (trackable.verticalRateMps != null && Math.abs(trackable.verticalRateMps) > 0.2) {
      const fpm = Math.round(trackable.verticalRateMps * 196.85);
      lines.push({ label: "Vertical rate", value: `${fpm > 0 ? "+" : ""}${fpm} ft/min` });
    }
  }

  if (trackable.altKm != null) {
    lines.push({ label: "Orbital altitude", value: `${trackable.altKm.toFixed(0)} km` });
  }

  if (trackable.kind === "satellite-cluster") {
    lines.push({ label: "Group", value: "Multiple LEO objects in this patch of sky" });
  }

  if (trackable.kind === "deepsky") {
    const dso = DEEP_SKY_OBJECTS.find(d => d.id === trackable.id);
    if (dso?.subtitle) lines.push({ label: "Catalog", value: dso.subtitle });
  }

  if (trackable.kind === "star") {
    const star = BRIGHT_STARS.find(s => `star:${s.id}` === trackable.id);
    if (star) {
      lines.push({ label: "Constellation", value: star.constellation });
      lines.push({ label: "Magnitude", value: star.mag.toFixed(2) });
      if (star.spectralType) lines.push({ label: "Spectral type", value: star.spectralType });
      if (star.distanceLy != null) {
        lines.push({
          label: "Distance",
          value: `~${star.distanceLy.toLocaleString()} ly`,
        });
      }
    }
  }

  const lore = loreForSkyObject({
    id: trackable.id,
    kind: trackable.kind,
    name: trackable.name,
    date: observationTime,
  });

  return {
    id: trackable.id,
    kind: meta.label,
    name: trackable.name,
    az: trackable.az,
    alt: trackable.alt,
    emoji: meta.emoji,
    accent: meta.accent,
    lines,
    lore: lore ?? undefined,
  };
}

const FOV_AZ = 90;
const FOV_ALT_HALF = 60;
const MICRO = OBS.typography.micro;
const TARGET_ENTER = 1.5;
const TARGET_EXIT = 2.8;

/** Horizon great-circle — faint dashed reference, not a UI seam. */
function drawHorizonRing(
  ctx: CanvasRenderingContext2D,
  project: (az: number, alt: number) => [number, number],
  w: number,
  h: number,
  stroke: string,
  width: number,
  _glow?: string,
) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.min(width, 0.7);
  ctx.lineCap = "round";
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  let started = false;
  for (let az = 0; az <= 360; az += 3) {
    const [x, y] = project(az, 0);
    if (x < -9000) {
      started = false;
      continue;
    }
    if (x < -30 || x > w + 30 || y < -30 || y > h + 30) continue;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Steep magnitude → size + opacity. Mag −1.5 dominant; mag ≥4 barely a whisper.
 * Widens brightness range so depth reads on an onyx field.
 */
function starVisual(mag: number): { r: number; alpha: number; glow: boolean } {
  const t = Math.max(0, Math.min(1, (4.6 - mag) / 6.1));
  const steep = Math.pow(t, 2.65);
  return {
    r: 0.28 + steep * 4.3,
    alpha: 0.05 + steep * 0.95,
    glow: mag < 1.15,
  };
}

/** Soft presence for constellation scaffold near aim center (0.1 far → 1 near). */
function aimPresence(x: number, y: number, cx: number, cy: number, w: number, h: number): number {
  const dist = Math.hypot(x - cx, y - cy);
  const reach = Math.min(w, h) * 0.42;
  return 0.1 + 0.9 * Math.max(0, 1 - dist / reach);
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Array<{ az: number; alt: number }>,
  project: (az: number, alt: number) => [number, number],
  w: number,
  h: number,
  stroke: string,
  width: number,
  dash?: number[],
  glow?: string,
  alpha = 1,
) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6;
  }
  ctx.beginPath();
  let started = false;
  for (const p of points) {
    const [x, y] = project(p.az, p.alt);
    if (x < -20 || x > w + 20 || y < -20 || y > h + 20) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.setLineDash(dash ?? []);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPlanetTexture(
  ctx: CanvasRenderingContext2D,
  body: CelestialBody,
  x: number,
  y: number,
  blend: number,
  baseR: number,
) {
  if (blend <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = blend;
  const r = baseR * (1 + blend * 2.5);

  if (body.id === "mars") {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, "#e89070");
    g.addColorStop(0.6, "#c04030");
    g.addColorStop(1, "#802820");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 50, 40, 0.4)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(x + (i - 1) * r * 0.25, y + (i - 1) * r * 0.15, r * 0.35, r * 0.12, i * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (body.id === "jupiter") {
    const g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, "#d4c4a8");
    g.addColorStop(0.3, "#c9a880");
    g.addColorStop(0.5, "#e8dcc8");
    g.addColorStop(0.7, "#b89870");
    g.addColorStop(1, "#a08060");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 140, 100, 0.5)";
    ctx.lineWidth = 0.6;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(x, y + i * r * 0.22, r * 0.95, r * 0.08, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (body.id === "saturn") {
    ctx.fillStyle = "#c9b896";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(200, 180, 150, 0.65)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6, r * 0.35, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.35, r * 0.28, -0.2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.05, x, y, r);
    g.addColorStop(0, body.color);
    g.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  body: CelestialBody,
  x: number,
  y: number,
  belowHorizon: boolean,
  locked: boolean,
  texBlend: number,
  showLabel = false,
) {
  const baseR = body.id === "sun" ? 9.5 : body.id === "moon" ? 7.5 : 5.5;
  const alpha = belowHorizon ? 0.3 : 1;

  ctx.save();
  if (locked) {
    ctx.strokeStyle = OBS.celestial.targetLock;
    ctx.globalAlpha = alpha * 0.95;
    ctx.shadowColor = OBS.celestial.targetGlow;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, baseR + 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(x - baseR - 14, y);
    ctx.lineTo(x - baseR - 5, y);
    ctx.moveTo(x + baseR + 5, y);
    ctx.lineTo(x + baseR + 14, y);
    ctx.moveTo(x, y - baseR - 14);
    ctx.lineTo(x, y - baseR - 5);
    ctx.moveTo(x, y + baseR + 5);
    ctx.lineTo(x, y + baseR + 14);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawPlanetTexture(ctx, body, x, y, texBlend, baseR);

  if (body.id === "sun") {
    ctx.globalAlpha = alpha;
    drawSunGlyph(ctx, x, y, baseR * 1.05, locked);
    ctx.globalAlpha = 1;
  } else if (body.id === "moon") {
    ctx.globalAlpha = alpha;
    drawMoonGlyph(ctx, x, y, baseR, 0.52, locked);
    ctx.globalAlpha = 1;
  } else if (texBlend < 0.35) {
    ctx.globalAlpha = alpha;
    drawPlanetGlyph(ctx, body.id, x, y, baseR, body.color);
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = alpha * (1 - texBlend * 0.6);
    ctx.fillStyle = body.color;
    ctx.shadowColor = locked ? OBS.celestial.targetGlow : "rgba(226, 232, 240, 0.25)";
    ctx.shadowBlur = locked ? 8 : 3;
    ctx.beginPath();
    ctx.arc(x, y, baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  if (showLabel) {
    const label = locked
      ? `${body.name} · ${Math.round(body.az)}° · ${Math.round(body.alt)}°`
      : body.name;
    ctx.font = locked ? `600 10px ${MICRO}` : `500 8px ${MICRO}`;
    ctx.fillStyle = locked
      ? OBS.celestial.targetLock
      : `rgba(238, 236, 251, ${belowHorizon ? 0.32 : 0.58})`;
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - baseR - (locked ? 14 : 7));
  }
  ctx.restore();
}

function drawMinorBody(
  ctx: CanvasRenderingContext2D,
  body: MinorBody,
  x: number,
  y: number,
  belowHorizon: boolean,
  locked: boolean,
  scale: number,
  showLabel = false,
) {
  const baseR = body.kind === "comet" ? 4.8 : 4;
  const alpha = belowHorizon ? 0.32 : 1;

  ctx.save();
  if (locked) {
    ctx.strokeStyle = OBS.celestial.targetLock;
    ctx.globalAlpha = alpha * 0.95;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, baseR + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (body.kind === "comet") {
    ctx.globalAlpha = alpha;
    drawCometGlyph(ctx, x, y, baseR, body.color, locked);
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = alpha;
    drawAsteroidGlyph(ctx, x, y, baseR, body.color, locked);
    ctx.globalAlpha = 1;
  }

  if (showLabel) {
    ctx.font = locked ? `600 9px ${MICRO}` : `500 8px ${MICRO}`;
    ctx.fillStyle = locked
      ? OBS.celestial.targetLock
      : `rgba(238, 236, 251, ${belowHorizon ? 0.32 : 0.62})`;
    ctx.textAlign = "center";
    const suffix = body.kind === "comet" ? " ☄" : " ◇";
    ctx.fillText(
      locked ? `${body.name} · ${Math.round(body.az)}° · ${Math.round(body.alt)}°` : `${body.name}${suffix}`,
      x,
      y - baseR - (locked ? 12 : 6),
    );
  }
  ctx.restore();
}

function drawAircraft(
  ctx: CanvasRenderingContext2D,
  track: AircraftTrack,
  x: number,
  y: number,
  project: (az: number, alt: number) => [number, number],
  locked: boolean,
) {
  ctx.save();
  const size = locked ? 8 : 6.5;

  if (track.trail.length > 1) {
    ctx.beginPath();
    let started = false;
    for (const p of track.trail) {
      const [tx, ty] = project(p.az, p.alt);
      if (!started) { ctx.moveTo(tx, ty); started = true; }
      else ctx.lineTo(tx, ty);
    }
    ctx.strokeStyle = locked ? "rgba(169, 156, 255, 0.4)" : "rgba(140, 124, 255, 0.18)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  drawAircraftGlyph(ctx, x, y, size, track.headingDeg, track.iconKind, locked);
  if (locked) {
    ctx.strokeStyle = OBS.celestial.targetLock;
    ctx.lineWidth = 0.85;
    ctx.strokeRect(x - size - 6, y - size - 6, (size + 6) * 2, (size + 6) * 2);
  }

  ctx.restore();

  if (!locked) return;
  const altStr = track.baroAltFt >= 1000
    ? `${Math.round(track.baroAltFt / 1000)},${String(Math.round(track.baroAltFt % 1000)).padStart(3, "0").slice(0, 1)}00ft`
    : `${Math.round(track.baroAltFt)}ft`;
  const label =
    `${track.callsign} · ${Math.round(track.az)}° az · ${Math.round(track.alt)}° alt · ${track.gsKnots}kt`;
  ctx.font = `500 7px ${MICRO}`;
  ctx.fillStyle = OBS.celestial.targetLock;
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - size - 5);
}

function drawSatellite(
  ctx: CanvasRenderingContext2D,
  track: SatelliteTrack,
  x: number,
  y: number,
  project: (az: number, alt: number) => [number, number],
  locked: boolean,
  pulse: number,
) {
  ctx.save();
  const size = locked ? 6.5 : 5.2 + Math.sin(pulse) * 0.35;

  if (track.trail.length > 1) {
    ctx.beginPath();
    let started = false;
    for (const p of track.trail) {
      const [tx, ty] = project(p.az, p.alt);
      if (!started) { ctx.moveTo(tx, ty); started = true; }
      else ctx.lineTo(tx, ty);
    }
    ctx.strokeStyle = locked ? "rgba(169, 156, 255, 0.45)" : "rgba(140, 124, 255, 0.22)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

  drawSatelliteGlyph(ctx, x, y, size, locked, pulse);

  if (locked) {
    ctx.strokeStyle = OBS.celestial.targetLock;
    ctx.lineWidth = 0.85;
    ctx.strokeRect(x - size - 5, y - size - 5, (size + 5) * 2, (size + 5) * 2);
  }
  ctx.restore();

  if (!locked) return;
  const shortName = track.name.includes("STARLINK")
    ? track.name.replace("STARLINK-", "SL-")
    : track.name.includes("ISS") ? "ISS TRACK" : track.name.slice(0, 12);
  const label = `${shortName} · ${Math.round(track.az)}° az · ${Math.round(track.alt)}° alt`;
  ctx.font = `500 7px ${MICRO}`;
  ctx.fillStyle = OBS.celestial.targetLock;
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - size - 4);
}

function drawSatelliteCluster(
  ctx: CanvasRenderingContext2D,
  cluster: SatelliteCluster,
  x: number,
  y: number,
  showLabel = false,
) {
  drawSatelliteClusterGlyph(ctx, x, y, cluster.count);
  if (!showLabel) return;
  ctx.font = `500 7px ${MICRO}`;
  ctx.fillStyle = "rgba(169, 156, 255, 0.55)";
  ctx.textAlign = "center";
  ctx.fillText(`${cluster.count} SATS`, x, y - 10);
}

function drawTargetLockFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  pulse: number,
) {
  ctx.save();
  const breathe = 0.85 + Math.sin(pulse * 0.9) * 0.15;
  const s = size * breathe;
  ctx.strokeStyle = OBS.celestial.targetLock;
  ctx.shadowColor = OBS.celestial.targetGlow;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, s + 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(x - s - 10, y);
  ctx.lineTo(x - s, y);
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + s + 10, y);
  ctx.moveTo(x, y - s - 10);
  ctx.lineTo(x, y - s);
  ctx.moveTo(x, y + s);
  ctx.lineTo(x, y + s + 10);
  ctx.stroke();
  ctx.restore();
}

function projectRaDecToScreen(
  raHours: number,
  decDeg: number,
  date: Date,
  latDeg: number,
  lonDeg: number,
  altM: number,
  toXY: SkyProjector["toXY"],
): { x: number; y: number; az: number; alt: number } | null {
  const { az, alt } = raDecToAltAz(date, latDeg, lonDeg, raHours, decDeg, altM);
  if (alt < -6) return null;
  const [x, y] = toXY(az, alt);
  if (x < -8000) return null;
  return { x, y, az, alt };
}

/** Diffuse galactic-plane cloud — feathered blobs, no hard edges or banding. */
function drawMilkyWayBand(
  ctx: CanvasRenderingContext2D,
  date: Date,
  lat: number,
  lon: number,
  altM: number,
  project: SkyProjector,
  w: number,
  h: number,
  alpha: number,
) {
  if (alpha < 0.03) return;
  const cloud = milkyWayCloud();
  ctx.save();
  for (const p of cloud) {
    const scr = projectRaDecToScreen(p.ra, p.dec, date, lat, lon, altM, project.toXY);
    if (!scr || !project.inView(scr.x, scr.y, w, h, p.size + 40)) continue;
    const a = alpha * p.opacity;
    if (a < 0.006) continue;
    const g = ctx.createRadialGradient(scr.x, scr.y, 0, scr.x, scr.y, p.size);
    g.addColorStop(0, `rgba(210, 200, 255, ${a})`);
    g.addColorStop(0.32, `rgba(165, 155, 235, ${a * 0.42})`);
    g.addColorStop(0.65, `rgba(120, 110, 200, ${a * 0.12})`);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(scr.x, scr.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWarmCrosshair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  accent: string,
  pulse: number,
  warmth: number,
) {
  const breathe = 0.92 + Math.sin(pulse * 1.1) * 0.05;
  ctx.save();
  const ring = ctx.createRadialGradient(cx, cy, 4, cx, cy, 28 * breathe);
  ring.addColorStop(0, "rgba(169, 156, 255, 0.2)");
  ring.addColorStop(1, "transparent");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, 28 * breathe, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.shadowColor = OBS.night.glow;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(cx, cy, 14 * breathe, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.moveTo(cx, cy - 16);
  ctx.lineTo(cx, cy + 16);
  ctx.stroke();
  ctx.restore();
}

function findTargetLock(
  headingDeg: number,
  pitchDeg: number,
  trackables: Trackable[],
  prevId: string | null,
): Trackable | null {
  let best: { t: Trackable; sep: number } | null = null;
  for (const t of trackables) {
    const sep = angularSeparationDeg(headingDeg, pitchDeg, t.az, t.alt);
    if (sep <= TARGET_ENTER && (!best || sep < best.sep)) {
      best = { t, sep };
    }
  }
  if (best) return best.t;
  if (prevId) {
    const prev = trackables.find(t => t.id === prevId);
    if (prev) {
      const sep = angularSeparationDeg(headingDeg, pitchDeg, prev.az, prev.alt);
      if (sep <= TARGET_EXIT) return prev;
    }
  }
  return null;
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  subBlend: number,
  appearance: ReturnType<typeof resolveSkyWeatherAppearance>,
  timeSec: number,
) {
  const cx = w * 0.5;
  const cy = h * 0.42;
  const r = Math.max(w, h) * 0.85;

  const cosmic = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
  cosmic.addColorStop(0, appearance.skyMid);
  cosmic.addColorStop(0.45, appearance.skyTop);
  cosmic.addColorStop(1, appearance.skyBottom);
  ctx.fillStyle = cosmic;
  ctx.fillRect(0, 0, w, h);

  const horizonWash = ctx.createLinearGradient(0, h * 0.2, 0, h);
  horizonWash.addColorStop(0, "transparent");
  horizonWash.addColorStop(0.55, appearance.isDay ? "rgba(255,255,255,0.04)" : "rgba(30,41,59,0.12)");
  horizonWash.addColorStop(1, appearance.isDay ? "rgba(200,220,240,0.08)" : "rgba(15,23,42,0.22)");
  ctx.fillStyle = horizonWash;
  ctx.fillRect(0, 0, w, h);

  drawCloudLayer(ctx, w, h, appearance.cloudCover, appearance.cloudBrightness, appearance.isDay, timeSec);
  drawFogLayer(ctx, w, h, appearance.fogOpacity);
  drawRainLayer(ctx, w, h, appearance.rainIntensity, timeSec);

  if (subBlend > 0.001) {
    const earth = ctx.createLinearGradient(0, h * 0.35, 0, h);
    earth.addColorStop(0, `rgba(12, 12, 17, ${subBlend * 0.55})`);
    earth.addColorStop(0.55, `rgba(7, 7, 9, ${subBlend * 0.75})`);
    earth.addColorStop(1, `rgba(3, 3, 4, ${subBlend * 0.92})`);
    ctx.fillStyle = earth;
    ctx.fillRect(0, 0, w, h);
  }

  const vignette = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, appearance.vignette);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Soft violet pool at the bottom edge — onyx “light enters from above”.
  const warmthHaze = ctx.createLinearGradient(0, h * 0.45, 0, h);
  warmthHaze.addColorStop(0, "transparent");
  warmthHaze.addColorStop(0.7, "rgba(140, 124, 255, 0.06)");
  warmthHaze.addColorStop(1, "rgba(58, 47, 143, 0.18)");
  ctx.fillStyle = warmthHaze;
  ctx.fillRect(0, 0, w, h);
}

export function CelestialSkyView({
  lat,
  lon,
  observerAltM = 0,
  headingDeg,
  pitchDeg,
  liveAttitudeRef,
  observationTime,
  distanceRank = 50,
  liveHeading = false,
  livePitch = false,
  arPoseReady = true,
  hapticsEnabled = true,
  warmth = 0.55,
  weather = null,
  className = "",
}: CelestialSkyViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hapticsRef = useRef(createSkyHapticController());
  const pinchRef = useRef(createPinchGestureController());
  const groundBlendRef = useRef(0);
  const lockRef = useRef<string | null>(null);
  const lockGlowRef = useRef(0);
  const pulseRef = useRef(0);
  const aircraftRef = useRef<AircraftTrack[]>([]);
  const satellitesRef = useRef<SatelliteTrack[]>([]);
  const hitTargetsRef = useRef<HitTarget[]>([]);
  const tapRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const hudZoomRef = useRef("1.0×");
  const hudLayersRef = useRef("");
  const aircraftSourceRef = useRef<"live" | "mock">("mock");
  const nearestAirportRef = useRef<string | null>(null);
  const lockReadoutRef = useRef<string | null>(null);
  const hudTickRef = useRef(0);
  const [selectedDetail, setSelectedDetail] = useState<SkyObjectDetail | null>(null);
  const propsAttitudeRef = useRef<LiveAttitude>({
    view: altAzToEnu(headingDeg, pitchDeg),
    roll: 0,
  });
  const smoothAttitudeRef = useRef<LiveAttitude>({
    view: altAzToEnu(headingDeg, pitchDeg),
    roll: 0,
  });
  const basisRef = useRef<ViewBasis | null>(null);
  const weatherAppearRef = useRef(resolveSkyWeatherAppearance(weather, warmth));
  const weatherTargetRef = useRef(resolveSkyWeatherAppearance(weather, warmth));

  useLayoutEffect(() => {
    weatherTargetRef.current = resolveSkyWeatherAppearance(weather, warmth);
  }, [weather, warmth]);

  useLayoutEffect(() => {
    propsAttitudeRef.current = { view: altAzToEnu(headingDeg, pitchDeg), roll: 0 };
  }, [headingDeg, pitchDeg]);

  const bodies = useMemo(
    () => computeCelestialBodies(observationTime, lat, lon, observerAltM),
    [observationTime, lat, lon, observerAltM],
  );

  const minorBodies = useMemo(
    () => computeMinorBodies(observationTime, lat, lon, observerAltM),
    [observationTime, lat, lon, observerAltM],
  );

  const stars = useMemo(
    () => skyObjectsInView(lat, lon, 0, 0, observationTime, 360, 180, distanceRank).stars,
    [lat, lon, observationTime, distanceRank],
  );

  const tleCatalog = useMemo(() => parseTLECatalog(DEFAULT_TLE_CATALOG), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pinch = pinchRef.current;
    pinch.attach(canvas);

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      tapRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const onPointerUp = (e: PointerEvent) => {
      const tap = tapRef.current;
      tapRef.current = null;
      if (!tap?.active) return;
      const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
      if (moved > 10) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      let best: HitTarget | null = null;
      for (const hit of hitTargetsRef.current) {
        const d = Math.hypot(px - hit.x, py - hit.y);
        if (d <= hit.radius && (!best || d < Math.hypot(px - best.x, py - best.y))) {
          best = hit;
        }
      }
      if (best) {
        setSelectedDetail(buildObjectDetail(best.trackable, bodies, minorBodies, observationTime));
        if (hapticsEnabled) {
          try { navigator.vibrate?.([4, 36, 8]); } catch { /* ignore */ }
        }
      }
    };
    const onPointerCancel = () => { tapRef.current = null; };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    return () => {
      pinch.detach();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [bodies, minorBodies, hapticsEnabled, observationTime]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const altM = Math.max(0, observerAltM ?? 0);
        const obs = { latDeg: lat, lonDeg: lon, altM };
        const q = `lat=${lat}&lon=${lon}&alt=${Math.round(altM)}`;
        const mockAircraft = computeAircraftTracks(
          generateMockAircraft(obs, Math.floor(lat * 10 + lon), 8),
          obs,
        );
        const mockSatellites = computeSatelliteTracks(
          tleCatalog,
          obs,
          observationTime,
        );
        const [acRes, satRes] = await Promise.all([
          fetch(`/api/sky/aircraft?${q}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/sky/satellites?${q}&live=1`).then(r => r.ok ? r.json() : null),
        ]);
        if (cancelled) return;
        if (acRes?.aircraft?.length) {
          aircraftRef.current = acRes.aircraft;
          aircraftSourceRef.current = acRes.source === "live" ? "live" : "mock";
          nearestAirportRef.current = acRes.nearestAirport
            ? `${acRes.nearestAirport.name} (${acRes.nearestAirport.iata}) · ${acRes.nearestAirport.distanceKm.toFixed(0)} km`
            : null;
        } else {
          aircraftRef.current = mockAircraft;
          aircraftSourceRef.current = "mock";
          nearestAirportRef.current = null;
        }
        if (satRes?.satellites?.length) {
          satellitesRef.current = satRes.satellites;
        } else {
          satellitesRef.current = mockSatellites;
        }
      } catch {
        if (!cancelled) {
          const altM = Math.max(0, observerAltM ?? 0);
          const obs = { latDeg: lat, lonDeg: lon, altM };
          aircraftRef.current = computeAircraftTracks(
            generateMockAircraft(obs, Math.floor(lat * 10 + lon), 8),
            obs,
          );
          satellitesRef.current = computeSatelliteTracks(
            tleCatalog,
            obs,
            observationTime,
          );
        }
      }
    };
    void load();
    const id = setInterval(load, 45000);
    return () => { cancelled = true; clearInterval(id); };
  }, [lat, lon, observerAltM, tleCatalog, observationTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let last = performance.now();

    const paint = (now: number) => {
      const dt = Math.min(0.064, (now - last) / 1000);
      last = now;
      pulseRef.current += dt * 2.6;

      const target = liveAttitudeRef?.current ?? propsAttitudeRef.current;
      const smooth = smoothAttitudeRef.current;
      smooth.view = smoothViewAzAltAdaptive(smooth.view, target.view);
      smooth.roll = 0;

      const viewAtt = enuToAltAz(smooth.view);
      const viewHeading = viewAtt.az;
      const viewPitch = viewAtt.alt;
      const basis = buildStableViewBasis(smooth.view, basisRef.current);
      basisRef.current = basis;

      pinchRef.current.tick(dt);
      const scale = pinchRef.current.getScale();
      hudTickRef.current += dt;
      if (hudTickRef.current > 0.25) {
        hudTickRef.current = 0;
        hudZoomRef.current = formatZoom(scale);
      }

      const targetGround = groundBlendFromView(smooth.view);
      groundBlendRef.current += (targetGround - groundBlendRef.current) * 0.028;

      weatherAppearRef.current = lerpAppearance(
        weatherAppearRef.current,
        weatherTargetRef.current,
        0.035,
      );
      const sky = weatherAppearRef.current;
      const skyWarmth = sky.effectiveWarmth;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      paintBackground(ctx, w, h, groundBlendRef.current, sky, pulseRef.current);

      const detail = getSkyDetailLevel(scale);
      const starAlpha = starFieldOpacity(scale) * sky.starScale;
      const texBlend = planetTextureBlend(scale);
      const project = createZoomedSkyProjector(w, h, basis, scale, FOV_AZ, FOV_ALT_HALF);
      const accent = spectrumAccent(skyWarmth);

      drawHorizonRing(
        ctx,
        project.toXY,
        w,
        h,
        OBS.celestial.horizon,
        OBS.vector.strokeMin,
      );

      // Milky Way + constellations + bright field at every zoom (night-weighted).
      const nightWayfinding = sky.isDay ? 0.18 : 1;
      if (starAlpha > 0.06) {
        drawMilkyWayBand(
          ctx,
          observationTime,
          lat,
          lon,
          observerAltM,
          project,
          w,
          h,
          starAlpha * nightWayfinding * 0.55,
        );
      }

      if (detail === "wide") {
        drawPath(
          ctx,
          sampleEclipticPath(observationTime, lat, lon, 8, observerAltM),
          project.toXY,
          w,
          h,
          OBS.celestial.ecliptic,
          0.45,
          [5, 8],
          undefined,
          0.85,
        );

        for (const arc of sampleMeridianArcs()) {
          drawPath(
            ctx,
            arc,
            project.toXY,
            w,
            h,
            OBS.celestial.meridian,
            0.4,
            [2, 8],
            undefined,
            0.7,
          );
        }
      }

      const hits: HitTarget[] = [];
      const trackables: Trackable[] = [];

      // Recompute ephemeris every frame — wall clock + GPS fix, not stale React memo.
      const skyTime = new Date();
      const liveBodies = computeCelestialBodies(skyTime, lat, lon, observerAltM);
      const liveMinorBodies = computeMinorBodies(skyTime, lat, lon, observerAltM);

      for (const dso of DEEP_SKY_OBJECTS) {
        const pt = projectRaDecToScreen(dso.ra, dso.dec, observationTime, lat, lon, observerAltM, project.toXY);
        if (!pt || pt.alt < 8) continue;
        trackables.push({
          id: dso.id,
          kind: "deepsky",
          name: dso.name,
          az: pt.az,
          alt: pt.alt,
        });
      }

      for (const body of liveBodies) {
        trackables.push({
          id: body.id,
          kind: "planet" as const,
          name: body.name,
          az: body.az,
          alt: body.alt,
        });
      }

      for (const mb of liveMinorBodies) {
        trackables.push({
          id: mb.id,
          kind: mb.kind,
          name: mb.name,
          az: mb.az,
          alt: mb.alt,
          magnitude: mb.magnitude,
        });
      }

      for (const ac of aircraftRef.current) {
        trackables.push({
          id: ac.id,
          kind: "aircraft",
          name: ac.callsign,
          az: ac.az,
          alt: ac.alt,
          gsKnots: ac.gsKnots,
          baroAltFt: ac.baroAltFt,
          iconKind: ac.iconKind,
          depIata: ac.depIata,
          arrIata: ac.arrIata,
          airlineIata: ac.airlineIata,
          aircraftIcao: ac.aircraftIcao,
          regNumber: ac.regNumber,
          status: ac.status,
          verticalRateMps: ac.verticalRateMps,
          rangeM: ac.rangeM,
        });
      }

      const satTracks = satellitesRef.current;
      if (shouldClusterSatellites(scale)) {
        const clusters = clusterSatellites(satTracks);
        for (const item of clusters) {
          if ("count" in item) {
            trackables.push({
              id: item.id,
              kind: "satellite-cluster",
              name: `${item.count} satellites`,
              az: item.az,
              alt: item.alt,
            });
          } else {
            trackables.push({
              id: item.id,
              kind: "satellite",
              name: item.name,
              az: item.az,
              alt: item.alt,
              altKm: item.altKm,
            });
          }
        }
      } else {
        for (const sat of satTracks) {
          trackables.push({
            id: sat.id,
            kind: "satellite",
            name: sat.name,
            az: sat.az,
            alt: sat.alt,
            altKm: sat.altKm,
          });
        }
      }

      const locked = arPoseReady
        ? findTargetLock(viewHeading, viewPitch, trackables, lockRef.current)
        : null;
      lockRef.current = locked?.id ?? null;
      lockGlowRef.current += ((locked ? 1 : 0) - lockGlowRef.current) * 0.06;

      // Labels only on attention: aim lock + at most 1–2 brightest celestial in view.
      const labelCands: Array<{ id: string; brightness: number }> = [];
      for (const star of BRIGHT_STARS) {
        const pt = projectRaDecToScreen(
          star.ra, star.dec, observationTime, lat, lon, observerAltM, project.toXY,
        );
        if (!pt || pt.alt < 0 || !project.inView(pt.x, pt.y, w, h)) continue;
        labelCands.push({ id: `star:${star.id}`, brightness: -star.mag });
      }
      for (const dso of DEEP_SKY_OBJECTS) {
        const pt = projectRaDecToScreen(
          dso.ra, dso.dec, observationTime, lat, lon, observerAltM, project.toXY,
        );
        if (!pt || pt.alt < 0 || !project.inView(pt.x, pt.y, w, h)) continue;
        // Slightly demote DSOs so they don't shout over 1st-mag stars.
        labelCands.push({ id: dso.id, brightness: -dso.mag - 2.2 });
      }
      for (const body of liveBodies) {
        const [bx, by] = project.toXY(body.az, body.alt);
        if (body.alt < 0 || !project.inView(bx, by, w, h, 24)) continue;
        labelCands.push({ id: body.id, brightness: -body.magnitude });
      }
      labelCands.sort((a, b) => b.brightness - a.brightness);
      const labelIds = new Set<string>();
      if (locked) labelIds.add(locked.id);
      let brightSlots = 0;
      for (const c of labelCands) {
        if (brightSlots >= 2) break;
        if (labelIds.has(c.id)) continue;
        labelIds.add(c.id);
        brightSlots++;
      }

      for (let si = 0; si < stars.length; si++) {
        const star = stars[si]!;
        const [x, y] = project.toXY(star.az, star.alt);
        if (!project.inView(x, y, w, h)) continue;
        const below = star.alt < 0;
        const vis = starVisual(star.mag);
        ctx.globalAlpha = starAlpha * (below ? 0.22 : 1) * vis.alpha;
        drawStarGlyph(
          ctx,
          x,
          y,
          vis.r,
          below ? OBS.celestial.starBelow : OBS.celestial.starAbove,
          !below && vis.glow,
          pulseRef.current + si * 0.37,
        );
        ctx.globalAlpha = 1;
      }

      // Bright navigational field — seats constellation figures (not distance-ranked).
      if (starAlpha > 0.06) {
        for (let bi = 0; bi < BRIGHT_STARS.length; bi++) {
          const star = BRIGHT_STARS[bi]!;
          const pt = projectRaDecToScreen(
            star.ra, star.dec, observationTime, lat, lon, observerAltM, project.toXY,
          );
          if (!pt || !project.inView(pt.x, pt.y, w, h)) continue;
          const below = pt.alt < 0;
          const vis = starVisual(star.mag);
          ctx.globalAlpha =
            starAlpha * nightWayfinding * (below ? 0.2 : 1) * vis.alpha;
          drawStarGlyph(
            ctx,
            pt.x,
            pt.y,
            vis.r,
            below ? OBS.celestial.starBelow : OBS.celestial.starAbove,
            !below && vis.glow,
            pulseRef.current + bi * 0.29,
          );
          if (!below && labelIds.has(`star:${star.id}`)) {
            ctx.font = `500 8px ${MICRO}`;
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(238, 236, 251, 0.55)";
            ctx.fillText(star.name, pt.x, pt.y - vis.r - 6);
          }
          ctx.globalAlpha = 1;

          if (!below) {
            const starTrackable: Trackable = {
              id: `star:${star.id}`,
              kind: "star",
              name: star.name,
              az: pt.az,
              alt: pt.alt,
              magnitude: star.mag,
            };
            hits.push({
              id: starTrackable.id,
              x: pt.x,
              y: pt.y,
              radius: Math.max(14, vis.r + 10),
              trackable: starTrackable,
            });
          }
        }
      }

      // Wayfinding layer — quiet scaffold; labels only on attention.
      if (starAlpha > 0.08) {
        const cxAim = w / 2;
        const cyAim = h / 2;
        for (const fig of CONSTELLATION_FIGURES) {
          const segments: Array<[[number, number], [number, number]]> = [];
          let visibleLines = 0;
          let labelPt: { x: number; y: number; alt: number } | null = null;
          for (const [a, b] of fig.lines) {
            const p0 = projectRaDecToScreen(a[0], a[1], observationTime, lat, lon, observerAltM, project.toXY);
            const p1 = projectRaDecToScreen(b[0], b[1], observationTime, lat, lon, observerAltM, project.toXY);
            if (!p0 || !p1) continue;
            segments.push([[p0.x, p0.y], [p1.x, p1.y]]);
            visibleLines++;
          }
          if (visibleLines < 1) continue;
          const lp = projectRaDecToScreen(
            fig.label.ra, fig.label.dec, observationTime, lat, lon, observerAltM, project.toXY,
          );
          if (lp) labelPt = lp;
          const presence = labelPt
            ? aimPresence(labelPt.x, labelPt.y, cxAim, cyAim, w, h)
            : 0.12;
          const lineAlpha = nightWayfinding * presence * (detail === "wide" ? 0.85 : 0.65);
          ctx.save();
          ctx.globalAlpha = lineAlpha;
          drawConstellationLines(ctx, segments, fig.color, fig.glow, pulseRef.current);
          ctx.restore();
          if (labelPt && labelPt.alt > -2 && presence > 0.55) {
            ctx.save();
            ctx.globalAlpha = lineAlpha * 0.9;
            drawConstellationLabel(ctx, labelPt.x, labelPt.y - 8, fig.name, "rgba(200, 190, 255, 0.45)");
            ctx.restore();
          }
        }

        for (const dso of DEEP_SKY_OBJECTS) {
          const pt = projectRaDecToScreen(dso.ra, dso.dec, observationTime, lat, lon, observerAltM, project.toXY);
          if (!pt || !project.inView(pt.x, pt.y, w, h, 20)) continue;
          const dsoT = Math.max(0, Math.min(1, (9.5 - dso.mag) / 9.5));
          const dsoSteep = Math.pow(dsoT, 2.4);
          const size = Math.max(2.2, 2.4 + dsoSteep * 5.5);
          ctx.save();
          ctx.globalAlpha =
            nightWayfinding * (sky.isDay ? 0.35 : 1) * (0.1 + dsoSteep * 0.42);
          drawDeepSkyGlyph(ctx, dso.kind, pt.x, pt.y, size, dso.color, pulseRef.current);
          if (labelIds.has(dso.id)) {
            ctx.font = `500 8px ${MICRO}`;
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(226, 232, 240, 0.5)";
            ctx.fillText(dso.name, pt.x, pt.y + size + 10);
          }
          ctx.restore();
          const tr = trackables.find(t => t.id === dso.id);
          if (tr) {
            hits.push({ id: dso.id, x: pt.x, y: pt.y, radius: 14, trackable: tr });
          }
        }
      }

      if (hapticsEnabled) {
        hapticsRef.current.update(viewHeading, viewPitch, locked?.id ?? null, {
          cardinalsEnabled: Math.abs(viewPitch) > 6,
        });
      }

      if (locked) {
        const speedStr = locked.gsKnots != null
          ? `${locked.gsKnots} kt GS`
          : locked.altKm != null
            ? `${locked.altKm.toFixed(0)} km alt`
            : "";
        lockReadoutRef.current =
          `◉ ${locked.name} · ${Math.round(locked.az)}° az · ${Math.round(locked.alt)}° alt${speedStr ? ` · ${speedStr}` : ""}`;
      } else {
        lockReadoutRef.current = null;
      }

      for (const ac of aircraftRef.current) {
        const [x, y] = project.toXY(ac.az, ac.alt);
        if (!project.inView(x, y, w, h, 20)) continue;
        drawAircraft(ctx, ac, x, y, project.toXY, locked?.id === ac.id);
        hits.push({
          id: ac.id,
          x,
          y,
          radius: 18,
          trackable: trackables.find(t => t.id === ac.id)!,
        });
      }

      if (shouldClusterSatellites(scale)) {
        for (const item of clusterSatellites(satTracks)) {
          const [x, y] = project.toXY(item.az, item.alt);
          if (!project.inView(x, y, w, h, 16)) continue;
          if ("count" in item) {
            drawSatelliteCluster(ctx, item, x, y, locked?.id === item.id);
            hits.push({
              id: item.id,
              x,
              y,
              radius: 16,
              trackable: trackables.find(t => t.id === item.id)!,
            });
          } else {
            drawSatellite(ctx, item, x, y, project.toXY, locked?.id === item.id, pulseRef.current);
            hits.push({
              id: item.id,
              x,
              y,
              radius: 16,
              trackable: trackables.find(t => t.id === item.id)!,
            });
          }
        }
      } else {
        for (const sat of satTracks) {
          const [x, y] = project.toXY(sat.az, sat.alt);
          if (!project.inView(x, y, w, h, 16)) continue;
          drawSatellite(ctx, sat, x, y, project.toXY, locked?.id === sat.id, pulseRef.current);
          hits.push({
            id: sat.id,
            x,
            y,
            radius: 16,
            trackable: trackables.find(t => t.id === sat.id)!,
          });
        }
      }

      for (const body of liveBodies) {
        const [x, y] = project.toXY(body.az, body.alt);
        if (!project.inView(x, y, w, h, 24)) continue;
        drawBody(
          ctx,
          body,
          x,
          y,
          body.alt < 0,
          locked?.id === body.id,
          texBlend,
          locked?.id === body.id || labelIds.has(body.id),
        );
        hits.push({
          id: body.id,
          x,
          y,
          radius: body.id === "sun" ? 22 : body.id === "moon" ? 20 : 16,
          trackable: trackables.find(t => t.id === body.id)!,
        });
      }

      for (const mb of liveMinorBodies) {
        const [x, y] = project.toXY(mb.az, mb.alt);
        if (!project.inView(x, y, w, h, 16)) continue;
        drawMinorBody(
          ctx,
          mb,
          x,
          y,
          mb.alt < 0,
          locked?.id === mb.id,
          scale,
          locked?.id === mb.id,
        );
        hits.push({
          id: mb.id,
          x,
          y,
          radius: 14,
          trackable: trackables.find(t => t.id === mb.id)!,
        });
      }

      hitTargetsRef.current = hits.filter(h => h.trackable);
      const inViewAc = aircraftRef.current.filter(ac => {
        const [x, y] = project.toXY(ac.az, ac.alt);
        return project.inView(x, y, w, h, 20);
      }).length;
      const inViewSat = satTracks.filter(sat => {
        const [x, y] = project.toXY(sat.az, sat.alt);
        return project.inView(x, y, w, h, 16);
      }).length;
      hudLayersRef.current = `${aircraftSourceRef.current === "live" ? "● LIVE ADS-B" : "○ Demo traffic"} · ${inViewAc}/${aircraftRef.current.length} aircraft · ${inViewSat}/${satTracks.length} sats · ${minorBodies.length} minor bodies`;

      const cx = w / 2;
      const cy = h / 2;
      drawWarmCrosshair(ctx, cx, cy, accent, pulseRef.current, skyWarmth);

      if (locked) {
        const lt = trackables.find(t => t.id === locked.id);
        if (lt) {
          const [lx, ly] = project.toXY(lt.az, lt.alt);
          drawTargetLockFrame(ctx, lx, ly, locked.kind === "aircraft" ? 8 : 6, pulseRef.current);
        }
      }

      ctx.font = `500 10px ${MICRO}`;
      ctx.fillStyle = skyWarmth > 0.5 ? "rgba(245, 158, 11, 0.88)" : "rgba(226, 232, 240, 0.88)";
      ctx.textAlign = "left";
      ctx.fillText(
        `${liveHeading || livePitch ? "● Live" : "○ Manual"} · ${observationTime.toLocaleTimeString()} · ${hudZoomRef.current}${weather?.condition ? ` · ${weather.condition}` : ""}`,
        10,
        15,
      );
      ctx.font = `500 8px ${MICRO}`;
      ctx.fillStyle = "rgba(186, 230, 253, 0.62)";
      ctx.textAlign = "left";
      ctx.fillText(`${hudLayersRef.current} · tap object for details`, 10, 27);
      if (nearestAirportRef.current) {
        ctx.font = `500 8px ${MICRO}`;
        ctx.fillStyle = "rgba(148, 163, 184, 0.58)";
        ctx.fillText(`Nearest airport · ${nearestAirportRef.current}`, 10, 39);
      }
      ctx.textAlign = "right";
      ctx.fillText(
        `${Math.round(viewHeading).toString().padStart(3, " ")}° az · ${Math.round(viewPitch).toString().padStart(2, " ")}° alt`,
        w - 10,
        15,
      );

      const moon = bodies.find(b => b.id === "moon");
      if (moon && moon.alt > -5) {
        const sep = angularSeparationDeg(viewHeading, viewPitch, moon.az, moon.alt);
        const dAz = ((moon.az - viewHeading + 540) % 360) - 180;
        const dAlt = moon.alt - viewPitch;
        const moonLabel =
          sep < 4
            ? `☽ Moon locked · ${Math.round(moon.az)}° · ${Math.round(moon.alt)}°`
            : `☽ Moon ${Math.round(moon.az)}° · ${Math.round(moon.alt)}° · ${sep.toFixed(0)}° off`;
        ctx.font = `600 9px ${MICRO}`;
        ctx.fillStyle = sep < 6 ? "rgba(251, 191, 36, 0.95)" : "rgba(226, 232, 240, 0.72)";
        ctx.textAlign = "left";
        ctx.fillText(moonLabel, 10, nearestAirportRef.current ? 52 : 40);

        if (sep > 8) {
          const edgePad = 22;
          let ax = w / 2;
          let ay = h / 2;
          if (Math.abs(dAz) >= Math.abs(dAlt)) {
            ax = dAz > 0 ? w - edgePad : edgePad;
            ay = h / 2 + Math.max(-h * 0.35, Math.min(h * 0.35, dAlt * 2.2));
          } else {
            ay = dAlt > 0 ? edgePad + 18 : h - edgePad;
            ax = w / 2 + Math.max(-w * 0.35, Math.min(w * 0.35, dAz * 2.2));
          }
          ctx.save();
          ctx.strokeStyle = "rgba(251, 191, 36, 0.75)";
          ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 5]);
          ctx.beginPath();
          ctx.moveTo(w / 2, h / 2);
          ctx.lineTo(ax, ay);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = `700 11px ${MICRO}`;
          ctx.textAlign = "center";
          ctx.fillText("☽", ax, ay + 4);
          ctx.font = `500 7px ${MICRO}`;
          ctx.fillStyle = "rgba(251, 191, 36, 0.75)";
          ctx.fillText("align compass", ax, ay + 14);
          ctx.restore();
        }
      }

      if (lockReadoutRef.current) {
        ctx.font = `600 9px ${MICRO}`;
        ctx.fillStyle = OBS.celestial.targetLock;
        ctx.textAlign = "center";
        ctx.shadowColor = OBS.celestial.targetGlow;
        ctx.shadowBlur = 4;
        ctx.fillText(lockReadoutRef.current, w / 2, h - 10);
        ctx.shadowBlur = 0;
      }

      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [
    lat,
    lon,
    observationTime,
    bodies,
    minorBodies,
    stars,
    hapticsEnabled,
    liveHeading,
    livePitch,
    arPoseReady,
    observerAltM,
    warmth,
    weather,
    liveAttitudeRef,
  ]);

  return (
    <div className="cp-sky-canvas-wrap">
      <canvas
        ref={canvasRef}
        className={`cp-celestial-sky cp-tabular${className ? ` ${className}` : ""}`}
        aria-label="Celestial sky view with horizon, tracking layers, and pinch zoom"
      />
      {selectedDetail && (
        <SkyObjectDetailPanel detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
      )}
    </div>
  );
}
