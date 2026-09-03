"use client";

/**
 * Live stacked-lanes orrery — fixed now-line, true cycle-phase offsets.
 *
 * Every lane scrolls by (now − cellStart) / (cellEnd − cellStart). The offset
 * of a cell vs the line is the reading. Escapement haptic fires when a
 * discrete-tick lane's index advances — it does not pin position to cell-start.
 */

import { useEffect, useRef, useState } from "react";
import { hapticsMuted, pulseHaptic } from "../../lib/haptics";
import { OnyxStarfield } from "./OnyxStarfield";
import {
  computeOrreryState,
  laneColor,
  laneMotion,
  laneScrollStartX,
  type OrreryLaneId,
  type OrreryLaneState,
} from "../../lib/lore/orreryLanes";

type LaneFilter = "full" | "clock" | "calendar";

const CLOCK_LANE_IDS: OrreryLaneId[] = ["sec", "helek", "prana", "pala", "min", "ghati", "planetary-hour", "muhurta", "shi", "day"];
const CALENDAR_LANE_IDS: OrreryLaneId[] = ["year", "month", "season", "wuku-tzolkin", "moon", "pancawara", "day"];

function filterLabel(f: LaneFilter): string {
  return f === "full" ? "All cycles" : f === "clock" ? "Clock only" : "Calendar only";
}
function nextFilter(f: LaneFilter): LaneFilter {
  return f === "full" ? "clock" : f === "clock" ? "calendar" : "full";
}

export function OnyxOrrery({
  lat,
  lon,
  onBack,
  onOpenTonal,
  hapticsEnabled = true,
}: {
  lat: number;
  lon: number;
  onBack: () => void;
  onOpenTonal?: () => void;
  /** Master stone toggle — escapement ticks respect this. */
  hapticsEnabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const hapticsRef = useRef(hapticsEnabled);
  hapticsRef.current = hapticsEnabled;
  const [expanded, setExpanded] = useState<OrreryLaneState | null>(null);
  const [laneFilter, setLaneFilter] = useState<LaneFilter>("full");
  const laneFilterRef = useRef<LaneFilter>("full");
  laneFilterRef.current = laneFilter;
  const lanesRef = useRef<OrreryLaneState[]>([]);
  const hitRef = useRef<{ y0: number; y1: number; id: string }[]>([]);
  const lastIndexRef = useRef<Map<OrreryLaneId, number>>(new Map());
  const nowPulseRef = useRef(0);
  const lastTsRef = useRef(0);

  useEffect(() => {
    visibleRef.current = true;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lastIndex = lastIndexRef.current;

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

    const draw = (ts: number) => {
      if (!visibleRef.current) {
        lastTsRef.current = 0;
        raf = requestAnimationFrame(draw);
        return;
      }
      const prev = lastTsRef.current || ts;
      const dt = Math.min(0.05, (ts - prev) / 1000);
      lastTsRef.current = ts;

      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const { lanes: allLanes, slowSky } = computeOrreryState(new Date(), lat, lon);
      const activeFilter = laneFilterRef.current;
      const lanes = activeFilter === "full" ? allLanes
        : activeFilter === "clock" ? allLanes.filter(l => CLOCK_LANE_IDS.includes(l.id))
        : allLanes.filter(l => CALENDAR_LANE_IDS.includes(l.id));
      lanesRef.current = lanes;

      nowPulseRef.current = Math.max(0, nowPulseRef.current - dt * 2.8);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();

      const padX = 12;
      const padTop = 8;
      const slowH = 52;
      const laneGap = 2;
      // Single shared centerline for every lane — fixed, unmoving.
      const nowX = w * 0.5;
      const avail = h - padTop - slowH - 8;
      const laneH = Math.max(18, (avail - laneGap * (lanes.length - 1)) / lanes.length);
      const hits: { y0: number; y1: number; id: string }[] = [];

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

        const isMs = lane.id === "ms";
        const isFast = lane.speedT < 0.25;
        const discrete = laneMotion(lane.id) === "discrete-tick";
        const band = laneColor(lane.speedT, lane.tier === "measured" ? 0.2 : 0.14);
        ctx.fillStyle = band;
        ctx.fillRect(padX, y0, w - padX * 2, laneH);

        const cellW = isFast ? 28 : Math.max(52, Math.min(88, (w - padX * 2) / 5.5));
        const n = lane.cells.length || 1;

        // True phase offset — never hold at cell-start.
        const startX = laneScrollStartX(nowX, lane.index, lane.progress, cellW);

        if (discrete) {
          const prevIdx = lastIndex.get(lane.id);
          if (prevIdx !== undefined && prevIdx !== lane.index) {
            if (hapticsRef.current && !hapticsMuted()) void pulseHaptic("tick");
            nowPulseRef.current = Math.max(nowPulseRef.current, 0.7);
          } else if (lane.progress > 0.92) {
            nowPulseRef.current = Math.max(
              nowPulseRef.current,
              0.35 + (lane.progress - 0.92) * 4,
            );
          }
          lastIndex.set(lane.id, lane.index);
        }

        const first = Math.floor((-startX - cellW) / cellW);
        const last = Math.ceil((w - startX) / cellW) + 1;
        const underLine = mod(Math.floor((nowX - startX) / cellW), n);

        for (let k = first; k <= last; k++) {
          const ci = mod(k, n);
          const x = startX + k * cellW;
          if (x + cellW < 0 || x > w) continue;
          const cell = lane.cells[ci]!;
          const atNow = ci === underLine;

          if (isMs) {
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

        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = "600 8px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = laneColor(lane.speedT, 0.75);
        const nameY = y0 + 10;
        const name = lane.name.toUpperCase();
        ctx.fillText(name, padX + 6, nameY);
        if (lane.tier === "measured") {
          ctx.fillStyle = "rgba(230,235,255,0.45)";
          ctx.font = "7px ui-sans-serif, system-ui, sans-serif";
          ctx.fillText("MEASURED", padX + 6 + ctx.measureText(name).width + 6, nameY);
        } else if (lane.tier === "celebrated") {
          ctx.fillStyle = "rgba(200,180,140,0.4)";
          ctx.font = "7px ui-sans-serif, system-ui, sans-serif";
          ctx.fillText("CELEBRATED", padX + 6 + ctx.measureText(name).width + 6, nameY);
        }

        y = y1 + laneGap;
      }
      hitRef.current = hits;

      const pulse = nowPulseRef.current;
      const lineA = 0.75 + pulse * 0.25;
      ctx.strokeStyle = `rgba(200, 190, 255, ${lineA})`;
      ctx.lineWidth = 1.25 + pulse * 0.9;
      ctx.shadowColor = `rgba(160, 140, 255, ${pulse * 0.55})`;
      ctx.shadowBlur = pulse * 12;
      ctx.beginPath();
      ctx.moveTo(nowX, padTop);
      ctx.lineTo(nowX, h - 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(200, 190, 255, ${0.85 + pulse * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(nowX, padTop - 2);
      ctx.lineTo(nowX - 4, padTop + 6);
      ctx.lineTo(nowX + 4, padTop + 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    const onVis = () => {
      visibleRef.current = document.visibilityState === "visible";
      if (!visibleRef.current) lastTsRef.current = 0;
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      lastIndex.clear();
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
        <OnyxStarfield />
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          close
        </button>
        <div className="onyx-orrery-header">
          <p className="onyx-orrery-title">ORRERY</p>
          <div className="onyx-orrery-controls">
            <button
              type="button"
              className="onyx-orrery-filter-btn"
              onClick={() => setLaneFilter(f => nextFilter(f))}
              title="Toggle cycle filter"
            >
              {filterLabel(laneFilter)}
            </button>
            {onOpenTonal && (
              <button
                type="button"
                className="onyx-orrery-filter-btn"
                onClick={onOpenTonal}
                title="Open Tonal"
              >
                Tonal ↗
              </button>
            )}
          </div>
        </div>
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
            {expanded.lore && <p className="onyx-decomp-source">{expanded.lore}</p>}
            {expanded.source && (
              <p className="onyx-layer-meta">{expanded.source}</p>
            )}
            {expanded.cells[expanded.index]?.glyph && (
              <p className="onyx-layer-lead" style={{ fontSize: 22 }}>
                {expanded.cells[expanded.index]!.glyph}
              </p>
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
