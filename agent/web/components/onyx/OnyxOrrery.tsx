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
import {
  getClockAudio,
  playHelekMark,
  playPalaMark,
  playPranaMark,
} from "../../lib/clockSfx";
import { OnyxStarfield } from "./OnyxStarfield";
import {
  computeOrreryState,
  laneColor,
  laneMotion,
  laneScrollStartX,
  type OrreryLaneId,
  type OrreryLaneState,
} from "../../lib/lore/orreryLanes";

const SONIC_LANES = new Set<OrreryLaneId>(["helek", "prana", "pala"]);

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
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

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

      const padX = 8;
      const padTop = 6;
      const laneGap = 3;
      // Single shared centerline for every lane — fixed, unmoving.
      const nowX = w * 0.5;
      const avail = h - padTop - 8;
      const laneH = Math.max(22, (avail - laneGap * (lanes.length - 1)) / lanes.length);
      const hits: { y0: number; y1: number; id: string }[] = [];
      void slowSky;

      let y = padTop;
      for (const lane of lanes) {
        const y0 = y;
        const y1 = y + laneH;
        hits.push({ y0, y1, id: lane.id });

        const isMs = lane.id === "ms";
        const isFast = lane.speedT < 0.25;
        const discrete = laneMotion(lane.id) === "discrete-tick";
        const cellW = isFast ? 32 : Math.max(56, Math.min(92, (w - padX * 2) / 5.2));
        const n = lane.cells.length || 1;

        // True phase offset — never hold at cell-start.
        const startX = laneScrollStartX(nowX, lane.index, lane.progress, cellW);

        const prevIdx = lastIndex.get(lane.id);
        if (prevIdx !== undefined && prevIdx !== lane.index) {
          if (hapticsRef.current && !hapticsMuted()) void pulseHaptic("tick");
          nowPulseRef.current = Math.max(nowPulseRef.current, 0.7);
          if (SONIC_LANES.has(lane.id)) {
            const audio = getClockAudio();
            if (audio?.state === "running") {
              if (lane.id === "helek") playHelekMark(audio);
              else if (lane.id === "prana") playPranaMark(audio);
              else playPalaMark(audio);
            }
          }
        } else if (discrete && lane.progress > 0.92) {
          nowPulseRef.current = Math.max(
            nowPulseRef.current,
            0.35 + (lane.progress - 0.92) * 4,
          );
        }
        lastIndex.set(lane.id, lane.index);

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
            drawGemCell(ctx, x + 2, y0 + 3, cellW - 4, laneH - 6, lane.speedT, true, true);
            continue;
          }

          drawGemCell(ctx, x + 2, y0 + 3, cellW - 4, laneH - 6, lane.speedT, atNow, false);

          if (atNow) {
            ctx.fillStyle = "rgba(255,255,255,0.94)";
            ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const label = short(cell.label || cell.glyph || lane.name, cellW > 70 ? 12 : 8);
            ctx.fillText(label, x + cellW / 2, y0 + laneH / 2 + 1);
          }
        }

        y = y1 + laneGap;
      }
      hitRef.current = hits;

      const fade = ctx.createLinearGradient(0, 0, w, 0);
      fade.addColorStop(0, "rgba(0,0,0,0.94)");
      fade.addColorStop(0.16, "rgba(0,0,0,0.55)");
      fade.addColorStop(0.34, "rgba(0,0,0,0)");
      fade.addColorStop(0.66, "rgba(0,0,0,0)");
      fade.addColorStop(0.84, "rgba(0,0,0,0.55)");
      fade.addColorStop(1, "rgba(0,0,0,0.94)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, w, h);

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
        <div className="onyx-orrery-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="onyx-orrery-canvas"
            onClick={onCanvasClick}
            aria-label="Live orrery clock — stacked cultural cycles"
          />
        </div>
        {expanded && (
          <div
            className="onyx-orrery-teach-scrim"
            onClick={() => setExpanded(null)}
          >
            <section
              className="onyx-orrery-teach"
              role="dialog"
              aria-modal="true"
              aria-label={expanded.name}
              onClick={event => event.stopPropagation()}
            >
              <div className="onyx-orrery-teach-center">
                <p className="onyx-eyebrow">{expanded.name}</p>
                {expanded.cells[expanded.index]?.glyph && (
                  <p className="onyx-orrery-teach-glyph">
                    {expanded.cells[expanded.index]!.glyph}
                  </p>
                )}
                <p className="onyx-layer-lead">{expanded.activeLabel}</p>
                <p className="onyx-layer-meta">
                  Cycle · {expanded.cycle}
                  {" · "}
                  {expanded.tier === "display"
                    ? "display pulse"
                    : expanded.tier}
                </p>
                {expanded.lore && (
                  <div className="onyx-orrery-lore-block">
                    <p className="onyx-orrery-lore-label">What it keeps</p>
                    <p className="onyx-decomp-source">{expanded.lore}</p>
                  </div>
                )}
                {expanded.origin && (
                  <div className="onyx-orrery-lore-block">
                    <p className="onyx-orrery-lore-label">Origin</p>
                    <p className="onyx-decomp-source">{expanded.origin}</p>
                  </div>
                )}
                {expanded.usedSince && (
                  <div className="onyx-orrery-lore-block">
                    <p className="onyx-orrery-lore-label">Used since</p>
                    <p className="onyx-decomp-source">{expanded.usedSince}</p>
                  </div>
                )}
                {expanded.curious && (
                  <div className="onyx-orrery-lore-block">
                    <p className="onyx-orrery-lore-label">Curious fact</p>
                    <p className="onyx-decomp-source">{expanded.curious}</p>
                  </div>
                )}
                {expanded.source && (
                  <p className="onyx-layer-meta onyx-orrery-teach-source">
                    {expanded.source}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="onyx-tool-btn onyx-orrery-teach-close"
                autoFocus
                onClick={() => setExpanded(null)}
              >
                Close lane
                <span>Back to the stack</span>
              </button>
            </section>
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

function gemCutPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

function drawGemCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  speedT: number,
  atNow: boolean,
  streak: boolean,
) {
  if (w < 4 || h < 4) return;
  const cut = Math.min(7, w * 0.2, h * 0.32);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (streak) {
    g.addColorStop(0, laneColor(0, 0.04));
    g.addColorStop(0.5, laneColor(0, 0.5));
    g.addColorStop(1, laneColor(0, 0.04));
  } else if (atNow) {
    g.addColorStop(0, "rgba(255,255,255,0.42)");
    g.addColorStop(0.18, laneColor(speedT, 0.72));
    g.addColorStop(0.55, laneColor(speedT, 0.38));
    g.addColorStop(1, "rgba(8,6,16,0.92)");
  } else {
    g.addColorStop(0, "rgba(255,255,255,0.1)");
    g.addColorStop(0.22, laneColor(speedT, 0.16));
    g.addColorStop(1, "rgba(6,4,12,0.7)");
  }
  ctx.save();
  gemCutPath(ctx, x, y, w, h, cut);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  const inset = Math.max(2, cut * 0.45);
  gemCutPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, cut * 0.7);
  ctx.strokeStyle = atNow ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (atNow) {
    const table = ctx.createLinearGradient(x, y, x + w * 0.55, y + h * 0.45);
    table.addColorStop(0, "rgba(255,255,255,0.34)");
    table.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = table;
    ctx.fillRect(x, y, w, h * 0.55);
  }
  ctx.restore();
}
