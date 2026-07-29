"use client";

/**
 * Live stacked-lanes orrery — CLOCK-SPEC.
 * North = slow/blue, south = fast/red. Fixed now-line down the center.
 * Reached by swiping right from home ("clock").
 */

import { useEffect, useRef, useState } from "react";
import {
  computeOrreryState,
  laneColor,
  type OrreryLaneState,
} from "../../lib/lore/orreryLanes";

export function OnyxOrrery({
  lat,
  lon,
  onBack,
}: {
  lat: number;
  lon: number;
  onBack: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const [expanded, setExpanded] = useState<OrreryLaneState | null>(null);
  const lanesRef = useRef<OrreryLaneState[]>([]);
  const hitRef = useRef<{ y0: number; y1: number; id: string }[]>([]);

  useEffect(() => {
    visibleRef.current = true;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const draw = () => {
      if (!visibleRef.current) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const { lanes, slowSky } = computeOrreryState(new Date(), lat, lon);
      lanesRef.current = lanes;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      const padX = 12;
      const padTop = 8;
      const slowH = 52;
      const laneGap = 2;
      const nowX = w * 0.5;
      const avail = h - padTop - slowH - 8;
      const laneH = Math.max(18, (avail - laneGap * (lanes.length - 1)) / lanes.length);
      const hits: { y0: number; y1: number; id: string }[] = [];

      // Slow sky cluster (north)
      ctx.fillStyle = "rgba(40, 55, 140, 0.22)";
      ctx.fillRect(padX, padTop, w - padX * 2, slowH - 4);
      ctx.strokeStyle = "rgba(90, 120, 220, 0.35)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(padX + 0.5, padTop + 0.5, w - padX * 2 - 1, slowH - 5);
      ctx.font = "600 8px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "rgba(160, 175, 255, 0.55)";
      ctx.textAlign = "left";
      ctx.fillText("SLOW SKY", padX + 8, padTop + 12);
      ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
      slowSky.forEach((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = padX + 8 + col * ((w - padX * 2) / 2);
        const y = padTop + 26 + row * 14;
        ctx.fillStyle = s.tier === "measured"
          ? "rgba(220, 225, 255, 0.85)"
          : "rgba(180, 190, 230, 0.65)";
        ctx.fillText(`${s.label} · ${s.value}`, x, y);
      });

      let y = padTop + slowH;
      for (const lane of lanes) {
        const y0 = y;
        const y1 = y + laneH;
        hits.push({ y0, y1, id: lane.id });

        const isFast = lane.speedT < 0.25;
        const band = laneColor(lane.speedT, lane.tier === "measured" ? 0.2 : 0.14);
        ctx.fillStyle = band;
        ctx.fillRect(padX, y0, w - padX * 2, laneH);

        // Cell strip — now-line bisects the active cell by progress:
        // progress 0 → left edge on the line; 0.5 → cell centered; 1 → right edge.
        // (Previously an extra −cellW/2 shoved every lane ~half a cell left.)
        const cellW = isFast ? 28 : Math.max(52, Math.min(88, (w - padX * 2) / 5.5));
        const n = lane.cells.length || 1;
        const startX = nowX - (lane.index + lane.progress) * cellW;
        const first = Math.floor((-startX - cellW) / cellW);
        const last = Math.ceil((w - startX) / cellW) + 1;

        for (let k = first; k <= last; k++) {
          const ci = mod(k, n);
          const x = startX + k * cellW;
          if (x + cellW < 0 || x > w) continue;
          const cell = lane.cells[ci]!;
          const atNow = ci === lane.index;

          if (lane.id === "ms") {
            // Gradient sweep only — no numerals
            const g = ctx.createLinearGradient(x, y0, x + cellW, y0);
            g.addColorStop(0, laneColor(0, 0.05));
            g.addColorStop(0.5, laneColor(0, 0.55));
            g.addColorStop(1, laneColor(0, 0.05));
            ctx.fillStyle = g;
            ctx.fillRect(x + 1, y0 + 2, cellW - 2, laneH - 4);
            continue;
          }

          if (atNow) {
            ctx.fillStyle = laneColor(lane.speedT, 0.45);
            ctx.fillRect(x + 1, y0 + 2, cellW - 2, laneH - 4);
            if (lane.tier === "measured") {
              ctx.strokeStyle = "rgba(240, 245, 255, 0.55)";
              ctx.lineWidth = 1;
              ctx.strokeRect(x + 1.5, y0 + 2.5, cellW - 3, laneH - 5);
            }
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.03)";
            ctx.fillRect(x + 1, y0 + 3, cellW - 2, laneH - 6);
          }

          if (!isFast || atNow) {
            ctx.fillStyle = atNow
              ? "rgba(255,255,255,0.92)"
              : "rgba(200,205,230,0.4)";
            ctx.font = atNow
              ? "600 10px ui-sans-serif, system-ui, sans-serif"
              : "10px ui-sans-serif, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const label = cell.glyph && cellW > 60
              ? `${cell.glyph} ${short(cell.label, 10)}`
              : short(cell.label || cell.glyph || "", cellW > 70 ? 12 : 6);
            ctx.fillText(label, x + cellW / 2, y0 + laneH / 2 + 0.5);
          }
        }

        // Lane name (left gutter overlay)
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = "600 8px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = laneColor(lane.speedT, 0.75);
        const nameY = y0 + 10;
        ctx.fillText(lane.name.toUpperCase(), padX + 6, nameY);
        if (lane.tier === "measured") {
          ctx.fillStyle = "rgba(230,235,255,0.45)";
          ctx.font = "7px ui-sans-serif, system-ui, sans-serif";
          ctx.fillText("MEASURED", padX + 6 + ctx.measureText(lane.name.toUpperCase()).width + 6, nameY);
        } else if (lane.tier === "celebrated") {
          ctx.fillStyle = "rgba(200,180,140,0.4)";
          ctx.font = "7px ui-sans-serif, system-ui, sans-serif";
          ctx.fillText("CELEBRATED", padX + 6 + ctx.measureText(lane.name.toUpperCase()).width + 6, nameY);
        }

        y = y1 + laneGap;
      }
      hitRef.current = hits;

      // Now-line
      ctx.strokeStyle = "rgba(200, 190, 255, 0.85)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(nowX, padTop);
      ctx.lineTo(nowX, h - 4);
      ctx.stroke();
      ctx.fillStyle = "rgba(200, 190, 255, 0.9)";
      ctx.beginPath();
      ctx.moveTo(nowX, padTop - 2);
      ctx.lineTo(nowX - 4, padTop + 6);
      ctx.lineTo(nowX + 4, padTop + 6);
      ctx.closePath();
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    const onVis = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [lat, lon]);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hit = hitRef.current.find(h => y >= h.y0 && y < h.y1);
    if (!hit) {
      setExpanded(null);
      return;
    }
    const lane = lanesRef.current.find(l => l.id === hit.id) ?? null;
    setExpanded(prev => (prev?.id === lane?.id ? null : lane));
  };

  return (
    <div className="onyx-root">
      <div className="onyx-device onyx-orrery-device">
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          close
        </button>
        <p className="onyx-orrery-title">ORRERY</p>
        <p className="onyx-orrery-sub">Read down the now-line · tap a lane</p>
        <div className="onyx-orrery-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="onyx-orrery-canvas"
            onClick={onCanvasClick}
            aria-label="Live orrery clock — stacked cultural cycles"
          />
        </div>
        {expanded && (
          <div className="onyx-orrery-teach" role="dialog" aria-label={expanded.name}>
            <p className="onyx-eyebrow">{expanded.name}</p>
            <p className="onyx-layer-lead">{expanded.activeLabel}</p>
            <p className="onyx-layer-meta">
              Cycle · {expanded.cycle}
              {" · "}
              {expanded.tier === "display"
                ? "display pulse"
                : expanded.tier}
            </p>
            {expanded.source && (
              <p className="onyx-decomp-source">{expanded.source}</p>
            )}
            <button
              type="button"
              className="onyx-tool-btn"
              style={{ marginTop: 8 }}
              onClick={() => setExpanded(null)}
            >
              Close lane
              <span>Back to the stack</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function short(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
