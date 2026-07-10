/**
 * Canvas glyphs for sky objects — satellites, aircraft, planets, stars.
 */

import { OBS } from "../design/observatoryTokens";

export type AircraftIconKind = "jet" | "helicopter" | "prop" | "cargo";

export function inferAircraftIconKind(
  callsign: string,
  gsKnots: number,
  baroAltFt: number,
): AircraftIconKind {
  const cs = callsign.trim().toUpperCase();
  if (/^(HELI|LIFE|MEDEVAC|RESCUE|REACH|EVAC|N\d+HE)/.test(cs)) return "helicopter";
  if (gsKnots < 140 && baroAltFt < 10000) return "helicopter";
  if (/^(FDX|UPS|GTI|ABX|ATN|DHL|CLX|5X)/.test(cs)) return "cargo";
  if (gsKnots < 210 && baroAltFt < 16000) return "prop";
  return "jet";
}

export function drawStarGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  glow = false,
  twinkle = 0,
) {
  ctx.save();
  const bloom = glow ? 1.35 + Math.sin(twinkle) * 0.12 : 1;
  const coreR = r * bloom;

  if (glow || r > 1.8) {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, coreR * 3.2);
    halo.addColorStop(0, "rgba(220, 235, 255, 0.35)");
    halo.addColorStop(0.35, "rgba(200, 220, 255, 0.12)");
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, coreR * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = coreR * 3.8;
  }

  const spikes = 4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    const rad = i % 2 === 0 ? coreR : coreR * 0.42;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  if (glow) {
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(x - coreR * 2.2, y);
    ctx.lineTo(x + coreR * 2.2, y);
    ctx.moveTo(x, y - coreR * 2.2);
    ctx.lineTo(x, y + coreR * 2.2);
    ctx.lineWidth = Math.max(0.4, coreR * 0.22);
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawSunGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  locked: boolean,
) {
  ctx.save();
  const corona = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.8);
  corona.addColorStop(0, "rgba(255, 236, 170, 0.55)");
  corona.addColorStop(0.45, "rgba(251, 191, 36, 0.18)");
  corona.addColorStop(1, "transparent");
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.8, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, 0, x, y, r);
  core.addColorStop(0, "#fffef0");
  core.addColorStop(0.35, "#fde68a");
  core.addColorStop(0.7, "#fbbf24");
  core.addColorStop(1, "#ea580c");
  ctx.fillStyle = core;
  ctx.shadowColor = locked ? "rgba(251, 191, 36, 0.95)" : "rgba(251, 191, 36, 0.65)";
  ctx.shadowBlur = locked ? 18 : 12;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 248, 200, 0.45)";
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2);
    ctx.lineTo(x + Math.cos(a) * r * 1.65, y + Math.sin(a) * r * 1.65);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawMoonGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  illumination: number,
  locked: boolean,
) {
  ctx.save();
  const lit = Math.max(0.08, Math.min(1, illumination));

  const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.4);
  halo.addColorStop(0, "rgba(220, 230, 255, 0.28)");
  halo.addColorStop(1, "transparent");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  const sphere = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, r * 0.08, x, y, r);
  sphere.addColorStop(0, "#f8fafc");
  sphere.addColorStop(0.55, "#dbe4f0");
  sphere.addColorStop(1, "#94a3b8");
  ctx.fillStyle = sphere;
  ctx.shadowColor = locked ? "rgba(200, 210, 230, 0.85)" : "rgba(200, 210, 230, 0.45)";
  ctx.shadowBlur = locked ? 12 : 7;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  const shadowOff = (1 - lit) * r * 1.6 - r * 0.2;
  ctx.fillStyle = "rgba(8, 12, 22, 0.88)";
  ctx.beginPath();
  ctx.arc(x + shadowOff, y, r * 0.96, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

const PLANET_PALETTES: Record<string, [string, string, string]> = {
  mercury: ["#d6d0c4", "#9a9288", "#5c564e"],
  venus: ["#fff4d6", "#f5d78e", "#c9a227"],
  mars: ["#f0a090", "#c45c48", "#7a2820"],
  jupiter: ["#f0e6d0", "#d4b888", "#9a7048"],
  saturn: ["#f2ead8", "#d4c4a8", "#9a8868"],
  uranus: ["#b8e8f8", "#78c8e8", "#3898b8"],
  neptune: ["#88b8f8", "#4878d8", "#2848a8"],
  pluto: ["#d8c8b8", "#a89888", "#686058"],
};

export function drawPlanetGlyph(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  if (id === "sun") {
    drawSunGlyph(ctx, x, y, r, false);
    return;
  }
  if (id === "moon") {
    drawMoonGlyph(ctx, x, y, r, 0.55, false);
    return;
  }
  ctx.save();
  const palette = PLANET_PALETTES[id] ?? [color, color, "rgba(0,0,0,0.45)"];
  const atmo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.85);
  atmo.addColorStop(0, `${palette[0]}33`);
  atmo.addColorStop(1, "transparent");
  ctx.fillStyle = atmo;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.85, 0, Math.PI * 2);
  ctx.fill();

  const g = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, r * 0.05, x, y, r);
  g.addColorStop(0, palette[0]!);
  g.addColorStop(0.55, palette[1]!);
  g.addColorStop(1, palette[2]!);
  ctx.fillStyle = g;
  ctx.shadowColor = `${palette[0]}88`;
  ctx.shadowBlur = r * 1.8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (id === "saturn") {
    ctx.strokeStyle = "rgba(230, 210, 175, 0.75)";
    ctx.lineWidth = 0.75;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.65, r * 0.36, -0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r * 0.28, -0.15, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawSatelliteGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  locked: boolean,
  pulse: number,
) {
  ctx.save();
  const s = size * (locked ? 1.2 : 1.05);
  const fill = locked ? "rgba(52, 211, 153, 0.95)" : "rgba(125, 211, 252, 0.92)";
  const stroke = locked ? "rgba(52, 211, 153, 0.75)" : "rgba(186, 230, 253, 0.7)";
  ctx.translate(x, y);
  ctx.shadowColor = locked ? "rgba(52, 211, 153, 0.55)" : "rgba(125, 211, 252, 0.5)";
  ctx.shadowBlur = 4 + Math.sin(pulse) * 1.2;

  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.rect(-s * 0.22, -s * 0.14, s * 0.44, s * 0.28);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-s * 0.22, 0);
  ctx.lineTo(-s * 0.65, -s * 0.38);
  ctx.lineTo(-s * 0.65, s * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(s * 0.22, 0);
  ctx.lineTo(s * 0.65, -s * 0.38);
  ctx.lineTo(s * 0.65, s * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = locked ? "rgba(16, 185, 129, 0.5)" : "rgba(96, 165, 250, 0.35)";
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.14);
  ctx.lineTo(s * 0.08, -s * 0.55);
  ctx.lineTo(-s * 0.08, -s * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawSatelliteClusterGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
) {
  ctx.save();
  drawSatelliteGlyph(ctx, x - 4, y, 4.5, false, 0);
  drawSatelliteGlyph(ctx, x + 4, y - 2, 3.5, false, 1.2);
  if (count > 2) {
    drawSatelliteGlyph(ctx, x + 1, y + 4, 3, false, 2.1);
  }
  ctx.restore();
}

function drawJetGlyph(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.15, -s * 0.12);
  ctx.lineTo(-s * 0.55, -s * 0.42);
  ctx.lineTo(-s * 0.42, 0);
  ctx.lineTo(-s * 0.55, s * 0.42);
  ctx.lineTo(-s * 0.15, s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawHelicopterGlyph(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.55, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.7, -s * 0.38);
  ctx.lineTo(s * 0.7, -s * 0.38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.38);
  ctx.lineTo(0, -s * 0.62);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.1, s * 0.1);
  ctx.lineTo(s * 0.55, s * 0.55);
  ctx.stroke();
}

function drawPropGlyph(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(s * 0.85, 0);
  ctx.lineTo(-s * 0.5, -s * 0.5);
  ctx.lineTo(-s * 0.2, 0);
  ctx.lineTo(-s * 0.5, s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-s * 0.55, 0, s * 0.12, s * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCargoGlyph(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  ctx.moveTo(s * 0.7, -s * 0.18);
  ctx.lineTo(-s * 0.55, -s * 0.18);
  ctx.lineTo(-s * 0.7, 0);
  ctx.lineTo(-s * 0.55, s * 0.18);
  ctx.lineTo(s * 0.7, s * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-s * 0.35, -s * 0.1, s * 0.35, s * 0.2);
}

export function drawAircraftGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  headingDeg: number,
  kind: AircraftIconKind,
  locked: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(headingDeg * (Math.PI / 180));
  const s = size * (locked ? 1.2 : 1);
  ctx.fillStyle = locked ? "rgba(52, 211, 153, 0.92)" : "rgba(240, 248, 255, 0.9)";
  ctx.strokeStyle = locked ? "rgba(52, 211, 153, 0.75)" : "rgba(186, 230, 253, 0.75)";
  ctx.lineWidth = 0.85;
  ctx.shadowColor = locked ? "rgba(52, 211, 153, 0.45)" : "rgba(186, 230, 253, 0.35)";
  ctx.shadowBlur = locked ? 6 : 3.5;

  switch (kind) {
    case "helicopter":
      drawHelicopterGlyph(ctx, s);
      break;
    case "prop":
      drawPropGlyph(ctx, s);
      break;
    case "cargo":
      drawCargoGlyph(ctx, s);
      break;
    default:
      drawJetGlyph(ctx, s);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawCometGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  locked: boolean,
) {
  ctx.save();
  const tail = size * (locked ? 5.2 : 4);
  const grad = ctx.createLinearGradient(x, y, x - tail, y - tail * 0.35);
  grad.addColorStop(0, color);
  grad.addColorStop(0.25, "rgba(186, 230, 253, 0.55)");
  grad.addColorStop(1, "transparent");
  ctx.strokeStyle = grad;
  ctx.lineWidth = locked ? 2.2 : 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - tail, y - tail * 0.35);
  ctx.stroke();
  const nucleus = ctx.createRadialGradient(x, y, 0, x, y, size * 0.7);
  nucleus.addColorStop(0, "#f0f9ff");
  nucleus.addColorStop(0.5, color);
  nucleus.addColorStop(1, "rgba(56, 120, 160, 0.8)");
  ctx.fillStyle = nucleus;
  ctx.shadowColor = "rgba(186, 230, 253, 0.65)";
  ctx.shadowBlur = locked ? 10 : 6;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawAsteroidGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  locked: boolean,
) {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 2.2);
  glow.addColorStop(0, `${color}55`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, size * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.strokeStyle = locked ? "rgba(52, 211, 153, 0.75)" : "rgba(210, 200, 175, 0.55)";
  ctx.lineWidth = 0.8;
  ctx.shadowColor = locked ? "rgba(52, 211, 153, 0.45)" : "rgba(210, 200, 175, 0.35)";
  ctx.shadowBlur = locked ? 6 : 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI * 2) / 6 + 0.2;
    const rad = size * (0.75 + (i % 2) * 0.2);
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Soft constellation stick figure between projected star points. */
export function drawConstellationLines(
  ctx: CanvasRenderingContext2D,
  segments: Array<[[number, number], [number, number]]>,
  color: string,
  glow: string,
  pulse: number,
) {
  if (segments.length === 0) return;
  ctx.save();
  const breathe = 0.88 + Math.sin(pulse * 0.7) * 0.06;
  ctx.globalAlpha = breathe;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.15;
  ctx.lineCap = "round";
  ctx.shadowColor = glow;
  ctx.shadowBlur = 6;
  for (const [[x0, y0], [x1, y1]] of segments) {
    if (x0 < -5000 || x1 < -5000) continue;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawConstellationLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  color: string,
) {
  ctx.save();
  ctx.font = `600 9px ${OBS.typography.micro}`;
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(201, 162, 39, 0.35)";
  ctx.shadowBlur = 4;
  ctx.fillText(name, x, y);
  ctx.restore();
}

export function drawDeepSkyGlyph(
  ctx: CanvasRenderingContext2D,
  kind: "galaxy" | "nebula" | "cluster",
  x: number,
  y: number,
  size: number,
  color: string,
  pulse: number,
) {
  ctx.save();
  const breathe = 0.9 + Math.sin(pulse * 0.5) * 0.08;
  const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 3.2);
  halo.addColorStop(0, `${color}44`);
  halo.addColorStop(0.5, `${color}18`);
  halo.addColorStop(1, "transparent");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, size * 3.2 * breathe, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}88`;
  ctx.lineWidth = 0.7;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;

  if (kind === "galaxy") {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.4 + Math.sin(pulse * 0.3) * 0.05);
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.6, size * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.55, size * 0.3, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.stroke();
    ctx.restore();
  } else if (kind === "nebula") {
    for (let i = 0; i < 3; i++) {
      const a = pulse * 0.2 + i * 2.1;
      ctx.beginPath();
      ctx.ellipse(
        x + Math.cos(a) * size * 0.3,
        y + Math.sin(a) * size * 0.2,
        size * (1.1 + i * 0.15),
        size * (0.65 + i * 0.1),
        a * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.globalAlpha = 0.35 - i * 0.08;
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + pulse * 0.15;
      const sx = x + Math.cos(a) * size * 0.9;
      const sy = y + Math.sin(a) * size * 0.65;
      ctx.beginPath();
      ctx.arc(sx, sy, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "#fff8e7";
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}
