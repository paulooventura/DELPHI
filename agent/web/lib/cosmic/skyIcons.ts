/**
 * Canvas glyphs for sky objects — satellites, aircraft, planets, stars.
 */

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
) {
  ctx.save();
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 2.5;
  }
  const spikes = 4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.38;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
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
  const core = ctx.createRadialGradient(x, y, 0, x, y, r);
  core.addColorStop(0, "#fff8e0");
  core.addColorStop(0.45, "#fbbf24");
  core.addColorStop(1, "#d97706");
  ctx.fillStyle = core;
  ctx.shadowColor = locked ? "rgba(251, 191, 36, 0.9)" : "rgba(251, 191, 36, 0.55)";
  ctx.shadowBlur = locked ? 14 : 8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 248, 200, 0.55)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15);
    ctx.lineTo(x + Math.cos(a) * r * 1.55, y + Math.sin(a) * r * 1.55);
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
  ctx.fillStyle = "#e8ecf4";
  ctx.shadowColor = locked ? "rgba(200, 210, 230, 0.8)" : "rgba(200, 210, 230, 0.35)";
  ctx.shadowBlur = locked ? 8 : 4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  const shadowOff = (1 - lit) * r * 1.6 - r * 0.2;
  ctx.fillStyle = "rgba(8, 12, 22, 0.92)";
  ctx.beginPath();
  ctx.arc(x + shadowOff, y, r * 0.96, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

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
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (id === "saturn") {
    ctx.strokeStyle = "rgba(210, 190, 160, 0.7)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.55, r * 0.34, -0.15, 0, Math.PI * 2);
    ctx.stroke();
  }
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
  const s = size * (locked ? 1.15 : 1);
  const fill = locked ? "rgba(16, 185, 129, 0.95)" : "rgba(96, 165, 250, 0.9)";
  const stroke = locked ? "rgba(16, 185, 129, 0.7)" : "rgba(148, 163, 184, 0.65)";
  ctx.translate(x, y);
  ctx.shadowColor = locked ? "rgba(16, 185, 129, 0.5)" : "rgba(96, 165, 250, 0.4)";
  ctx.shadowBlur = 3 + Math.sin(pulse) * 1.5;

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
  ctx.fillStyle = locked ? "rgba(16, 185, 129, 0.92)" : "rgba(226, 232, 240, 0.88)";
  ctx.strokeStyle = locked ? "rgba(16, 185, 129, 0.75)" : "rgba(148, 163, 184, 0.7)";
  ctx.lineWidth = 0.85;
  ctx.shadowColor = locked ? "rgba(16, 185, 129, 0.45)" : "rgba(148, 163, 184, 0.25)";
  ctx.shadowBlur = locked ? 5 : 2;

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
  const tail = size * (locked ? 4.5 : 3.2);
  const grad = ctx.createLinearGradient(x, y, x - tail, y - tail * 0.35);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, "rgba(136, 200, 232, 0.45)");
  grad.addColorStop(1, "transparent");
  ctx.strokeStyle = grad;
  ctx.lineWidth = locked ? 2 : 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - tail, y - tail * 0.35);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(136, 200, 232, 0.5)";
  ctx.shadowBlur = locked ? 6 : 3;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
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
  ctx.fillStyle = color;
  ctx.strokeStyle = locked ? "rgba(16, 185, 129, 0.7)" : "rgba(180, 170, 150, 0.5)";
  ctx.lineWidth = 0.7;
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
