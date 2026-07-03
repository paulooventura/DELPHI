"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
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
  drawMoonGlyph,
  drawPlanetGlyph,
  drawSatelliteClusterGlyph,
  drawSatelliteGlyph,
  drawStarGlyph,
  drawSunGlyph,
} from "../lib/cosmic/skyIcons";
import { OBS, spectrumAccent } from "../lib/design/observatoryTokens";
import {
  altAzToEnu,
  buildViewBasis,
  enuToAltAz,
  groundBlendFromView,
  slerpUnit,
  type Vec3,
} from "../lib/sphericalView";
import { skyObjectsInView } from "../lib/starmap";
import { generateMockAircraft, computeAircraftTracks } from "../lib/cosmic/aircraftTracking";

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
  className?: string;
};

type Trackable = {
  id: string;
  kind: "planet" | "satellite" | "satellite-cluster" | "aircraft" | "asteroid" | "comet";
  name: string;
  az: number;
  alt: number;
  gsKnots?: number;
  baroAltFt?: number;
  altKm?: number;
};

const FOV_AZ = 90;
const FOV_ALT_HALF = 60;
const MICRO = OBS.typography.micro;
const TARGET_ENTER = 1.5;
const TARGET_EXIT = 2.8;

function drawHorizonRing(
  ctx: CanvasRenderingContext2D,
  project: (az: number, alt: number) => [number, number],
  w: number,
  h: number,
  stroke: string,
  width: number,
  glow?: string,
) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6;
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
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
  ctx.restore();
}

/** Screen-stabilized horizon band when the sight line is near level. */
function drawStableHorizonOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  viewPitch: number,
  fovAltHalf: number,
  warmth: number,
) {
  const fade = Math.max(0, 1 - Math.abs(viewPitch) / 16);
  if (fade < 0.04) return;
  const y = h / 2 - (viewPitch / fovAltHalf) * (h / 2);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.strokeStyle = warmth > 0.5 ? "rgba(245, 158, 11, 0.42)" : "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 1.2;
  ctx.shadowColor = warmth > 0.5 ? "rgba(245, 158, 11, 0.25)" : "rgba(255, 255, 255, 0.15)";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
  ctx.restore();
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
) {
  const baseR = body.id === "sun" ? 8 : body.id === "moon" ? 6.5 : 4.5;
  const alpha = belowHorizon ? 0.3 : 1;

  ctx.save();
  if (locked) {
    ctx.strokeStyle = `rgba(16, 185, 129, ${alpha * 0.95})`;
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

  const label = body.id === "moon" || locked
    ? `${body.name} · ${Math.round(body.az)}° · ${Math.round(body.alt)}°`
    : body.name;
  ctx.font = locked ? `600 10px ${MICRO}` : `500 9px ${MICRO}`;
  ctx.fillStyle = locked
    ? "rgba(16, 185, 129, 0.95)"
    : `rgba(226, 232, 240, ${belowHorizon ? 0.38 : 0.72})`;
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - baseR - (locked ? 14 : 7));
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
) {
  const baseR = body.kind === "comet" ? 3.5 : 2.8;
  const alpha = belowHorizon ? 0.28 : 1;
  const showLabel = locked || scale >= 1.35;

  ctx.save();
  if (locked) {
    ctx.strokeStyle = `rgba(16, 185, 129, ${alpha * 0.95})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, baseR + 9, 0, Math.PI * 2);
    ctx.stroke();
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
      ? "rgba(16, 185, 129, 0.95)"
      : `rgba(226, 232, 240, ${belowHorizon ? 0.32 : 0.62})`;
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
  const size = locked ? 7 : 5;

  if (track.trail.length > 1) {
    ctx.beginPath();
    let started = false;
    for (const p of track.trail) {
      const [tx, ty] = project(p.az, p.alt);
      if (!started) { ctx.moveTo(tx, ty); started = true; }
      else ctx.lineTo(tx, ty);
    }
    ctx.strokeStyle = locked ? "rgba(16, 185, 129, 0.35)" : "rgba(148, 163, 184, 0.18)";
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

  const altStr = track.baroAltFt >= 1000
    ? `${Math.round(track.baroAltFt / 1000)},${String(Math.round(track.baroAltFt % 1000)).padStart(3, "0").slice(0, 1)}00ft`
    : `${Math.round(track.baroAltFt)}ft`;
  const label = locked
    ? `${track.callsign} · ${Math.round(track.az)}° az · ${Math.round(track.alt)}° alt · ${track.gsKnots}kt`
    : `${track.callsign} | ${altStr.replace(",", ",")}`;
  ctx.font = `500 7px ${MICRO}`;
  ctx.fillStyle = locked ? "rgba(16, 185, 129, 0.92)" : "rgba(148, 163, 184, 0.72)";
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
  const size = locked ? 5.5 : 4.2 + Math.sin(pulse) * 0.4;

  if (track.trail.length > 1) {
    ctx.beginPath();
    let started = false;
    for (const p of track.trail) {
      const [tx, ty] = project(p.az, p.alt);
      if (!started) { ctx.moveTo(tx, ty); started = true; }
      else ctx.lineTo(tx, ty);
    }
    ctx.strokeStyle = locked ? "rgba(16, 185, 129, 0.4)" : "rgba(96, 165, 250, 0.22)";
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

  const shortName = track.name.includes("STARLINK")
    ? track.name.replace("STARLINK-", "SL-")
    : track.name.includes("ISS") ? "ISS TRACK" : track.name.slice(0, 12);
  const label = locked
    ? `${shortName} · ${Math.round(track.az)}° az · ${Math.round(track.alt)}° alt`
    : shortName;
  ctx.font = `500 7px ${MICRO}`;
  ctx.fillStyle = locked ? "rgba(16, 185, 129, 0.92)" : "rgba(148, 163, 184, 0.68)";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - size - 4);
}

function drawSatelliteCluster(
  ctx: CanvasRenderingContext2D,
  cluster: SatelliteCluster,
  x: number,
  y: number,
) {
  drawSatelliteClusterGlyph(ctx, x, y, cluster.count);
  ctx.font = `600 7px ${MICRO}`;
  ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
  ctx.textAlign = "center";
  ctx.fillText(`${cluster.count} SATS`, x, y - 10);
}

function drawTargetLockFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.strokeStyle = OBS.celestial.targetLock;
  ctx.shadowColor = OBS.celestial.targetGlow;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 0.85;
  const s = size;
  ctx.beginPath();
  ctx.moveTo(x - s - 8, y);
  ctx.lineTo(x - s, y);
  ctx.moveTo(x + s, y);
  ctx.lineTo(x + s + 8, y);
  ctx.moveTo(x, y - s - 8);
  ctx.lineTo(x, y - s);
  ctx.moveTo(x, y + s);
  ctx.lineTo(x, y + s + 8);
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
  warmth: number,
) {
  const cx = w * 0.5;
  const cy = h * 0.42;
  const r = Math.max(w, h) * 0.85;

  const cosmic = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
  cosmic.addColorStop(0, OBS.space.core);
  cosmic.addColorStop(0.55, "#0a0e16");
  cosmic.addColorStop(1, OBS.space.outer);
  ctx.fillStyle = cosmic;
  ctx.fillRect(0, 0, w, h);

  if (subBlend > 0.001) {
    const earth = ctx.createLinearGradient(0, h * 0.35, 0, h);
    earth.addColorStop(0, `rgba(26, 18, 8, ${subBlend * 0.55})`);
    earth.addColorStop(0.55, `rgba(18, 12, 6, ${subBlend * 0.75})`);
    earth.addColorStop(1, `rgba(10, 7, 4, ${subBlend * 0.92})`);
    ctx.fillStyle = earth;
    ctx.fillRect(0, 0, w, h);
  }

  const vignette = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, warmth > 0.5 ? "rgba(217, 119, 6, 0.06)" : "rgba(96, 165, 250, 0.05)");
  ctx.fillStyle = vignette;
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
  className = "",
}: CelestialSkyViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hapticsRef = useRef(createSkyHapticController());
  const pinchRef = useRef(createPinchGestureController());
  const groundBlendRef = useRef(0);
  const lockRef = useRef<string | null>(null);
  const pulseRef = useRef(0);
  const aircraftRef = useRef<AircraftTrack[]>([]);
  const satellitesRef = useRef<SatelliteTrack[]>([]);
  const hudZoomRef = useRef("1.0×");
  const lockReadoutRef = useRef<string | null>(null);
  const hudTickRef = useRef(0);
  const propsAttitudeRef = useRef<LiveAttitude>({
    view: altAzToEnu(headingDeg, pitchDeg),
    roll: 0,
  });
  const smoothAttitudeRef = useRef<LiveAttitude>({
    view: altAzToEnu(headingDeg, pitchDeg),
    roll: 0,
  });

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
    return () => pinch.detach();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const q = `lat=${lat}&lon=${lon}&alt=200`;
        const [acRes, satRes] = await Promise.all([
          fetch(`/api/sky/aircraft?${q}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/sky/satellites?${q}`).then(r => r.ok ? r.json() : null),
        ]);
        if (cancelled) return;
        if (acRes?.aircraft) aircraftRef.current = acRes.aircraft;
        else {
          aircraftRef.current = computeAircraftTracks(
            generateMockAircraft({ latDeg: lat, lonDeg: lon, altM: 200 }),
            { latDeg: lat, lonDeg: lon, altM: 200 },
          );
        }
        if (satRes?.satellites) satellitesRef.current = satRes.satellites;
        else {
          satellitesRef.current = computeSatelliteTracks(
            tleCatalog,
            { latDeg: lat, lonDeg: lon, altM: 200 },
            observationTime,
          );
        }
      } catch {
        if (!cancelled) {
          aircraftRef.current = computeAircraftTracks(
            generateMockAircraft({ latDeg: lat, lonDeg: lon, altM: 200 }),
            { latDeg: lat, lonDeg: lon, altM: 200 },
          );
          satellitesRef.current = computeSatelliteTracks(
            tleCatalog,
            { latDeg: lat, lonDeg: lon, altM: 200 },
            observationTime,
          );
        }
      }
    };
    void load();
    const id = setInterval(load, 45000);
    return () => { cancelled = true; clearInterval(id); };
  }, [lat, lon, tleCatalog, observationTime]);

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
      pulseRef.current += dt * 4;

      const target = liveAttitudeRef?.current ?? propsAttitudeRef.current;
      const smooth = smoothAttitudeRef.current;
      if (liveAttitudeRef) {
        smooth.view = target.view;
      } else {
        const { alt: targetAlt } = enuToAltAz(target.view);
        const nearHorizon = Math.abs(targetAlt) < 28;
        const viewT = nearHorizon ? 0.18 : 0.28;
        smooth.view = slerpUnit(smooth.view, target.view, viewT);
      }
      smooth.roll = 0;

      const viewAtt = enuToAltAz(smooth.view);
      const viewHeading = viewAtt.az;
      const viewPitch = viewAtt.alt;
      const basis = buildViewBasis(smooth.view, 0);

      pinchRef.current.tick(dt);
      const scale = pinchRef.current.getScale();
      hudTickRef.current += dt;
      if (hudTickRef.current > 0.25) {
        hudTickRef.current = 0;
        hudZoomRef.current = formatZoom(scale);
      }

      const targetGround = groundBlendFromView(smooth.view);
      groundBlendRef.current += (targetGround - groundBlendRef.current) * 0.06;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      paintBackground(ctx, w, h, groundBlendRef.current, warmth);

      const detail = getSkyDetailLevel(scale);
      const starAlpha = starFieldOpacity(scale);
      const texBlend = planetTextureBlend(scale);
      const project = createZoomedSkyProjector(w, h, basis, scale, FOV_AZ, FOV_ALT_HALF);
      const accent = spectrumAccent(warmth);

      drawHorizonRing(
        ctx,
        project.toXY,
        w,
        h,
        OBS.celestial.horizon,
        OBS.vector.strokeMax,
        warmth > 0.5 ? OBS.night.glow : OBS.day.glow,
      );
      drawStableHorizonOverlay(ctx, w, h, viewPitch, FOV_ALT_HALF, warmth);

      if (detail === "wide") {
        drawPath(
          ctx,
          sampleEclipticPath(observationTime, lat, lon, 8, observerAltM),
          project.toXY,
          w,
          h,
          OBS.celestial.ecliptic,
          OBS.vector.strokeMin,
          [5, 6],
          OBS.night.glow,
        );

        for (const arc of sampleMeridianArcs()) {
          drawPath(
            ctx,
            arc,
            project.toXY,
            w,
            h,
            OBS.celestial.meridian,
            OBS.vector.strokeMin,
            [3, 7],
          );
        }
      }

      for (const star of stars) {
        const [x, y] = project.toXY(star.az, star.alt);
        if (!project.inView(x, y, w, h)) continue;
        const below = star.alt < 0;
        const r = Math.max(0.5, (3.4 - star.mag) * 0.85);
        ctx.globalAlpha = starAlpha * (below ? 0.3 : Math.min(1, 0.4 + (3.4 - star.mag) / 5.5));
        drawStarGlyph(
          ctx,
          x,
          y,
          r,
          below ? OBS.celestial.starBelow : OBS.celestial.starAbove,
          !below && star.mag < 2.2,
        );
        ctx.globalAlpha = 1;
      }

      const trackables: Trackable[] = [];

      for (const body of bodies) {
        trackables.push({
          id: body.id,
          kind: "planet" as const,
          name: body.name,
          az: body.az,
          alt: body.alt,
        });
      }

      for (const mb of minorBodies) {
        trackables.push({
          id: mb.id,
          kind: mb.kind,
          name: mb.name,
          az: mb.az,
          alt: mb.alt,
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

      if (hapticsEnabled && Math.abs(viewPitch) > 6) {
        hapticsRef.current.update(viewHeading, viewPitch, locked?.id ?? null);
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
      }

      if (shouldClusterSatellites(scale)) {
        for (const item of clusterSatellites(satTracks)) {
          if (!("count" in item)) continue;
          const [x, y] = project.toXY(item.az, item.alt);
          if (!project.inView(x, y, w, h, 16)) continue;
          drawSatelliteCluster(ctx, item, x, y);
        }
      } else {
        for (const sat of satTracks) {
          const [x, y] = project.toXY(sat.az, sat.alt);
          if (!project.inView(x, y, w, h, 16)) continue;
          drawSatellite(ctx, sat, x, y, project.toXY, locked?.id === sat.id, pulseRef.current);
        }
      }

      for (const body of bodies) {
        const [x, y] = project.toXY(body.az, body.alt);
        if (!project.inView(x, y, w, h, 24)) continue;
        drawBody(ctx, body, x, y, body.alt < 0, locked?.id === body.id, texBlend);
      }

      if (detail !== "wide" || scale >= 1.1) {
        for (const mb of minorBodies) {
          const [x, y] = project.toXY(mb.az, mb.alt);
          if (!project.inView(x, y, w, h, 16)) continue;
          drawMinorBody(ctx, mb, x, y, mb.alt < 0, locked?.id === mb.id, scale);
        }
      }

      const cx = w / 2;
      const cy = h / 2;
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.shadowColor = warmth > 0.5 ? OBS.night.glow : OBS.day.glow;
      ctx.shadowBlur = 5;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy);
      ctx.lineTo(cx + 12, cy);
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy + 12);
      ctx.stroke();
      ctx.restore();

      if (locked) {
        const lt = trackables.find(t => t.id === locked.id);
        if (lt) {
          const [lx, ly] = project.toXY(lt.az, lt.alt);
          drawTargetLockFrame(ctx, lx, ly, locked.kind === "aircraft" ? 7 : 5);
        }
      }

      ctx.font = `500 10px ${MICRO}`;
      ctx.fillStyle = warmth > 0.5 ? "rgba(245, 158, 11, 0.88)" : "rgba(226, 232, 240, 0.88)";
      ctx.textAlign = "left";
      ctx.fillText(
        `${liveHeading || livePitch ? "● Live" : "○ Manual"} · ${observationTime.toLocaleTimeString()} · ${hudZoomRef.current} · astro`,
        10,
        15,
      );
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
        ctx.fillText(moonLabel, 10, 28);

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
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(w / 2, h / 2);
          ctx.lineTo(ax, ay);
          ctx.stroke();
          ctx.font = `700 11px ${MICRO}`;
          ctx.textAlign = "center";
          ctx.fillText("☽", ax, ay + 4);
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
    liveAttitudeRef,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={`cp-celestial-sky cp-tabular${className ? ` ${className}` : ""}`}
      aria-label="Celestial sky view with horizon, tracking layers, and pinch zoom"
    />
  );
}
