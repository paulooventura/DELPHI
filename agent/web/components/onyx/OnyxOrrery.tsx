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
  playScrubTick,
  setClockTimeFrozen,
} from "../../lib/clockSfx";
import {
  startHeliodromeChord,
  stopHeliodromeChord,
  tickHeliodromeChord,
} from "../../lib/heliodromeChord";
import { OnyxStarfield } from "./OnyxStarfield";
import {
  CENTER_ONLY_LANE_IDS,
  ORRERY_LANE_GROUPS,
  computeOrreryState,
  laneColor,
  laneMotion,
  laneScrollStartX,
  stepOrreryDate,
  visibleOrreryLaneIds,
  type OrreryLaneId,
  type OrreryLaneState,
} from "../../lib/lore/orreryLanes";

const CENTER_ONLY = new Set<OrreryLaneId>(CENTER_ONLY_LANE_IDS);

const LANE_LABEL: Record<OrreryLaneId, string> = {
  precession: "Great Year",
  age: "Astrological age",
  century: "Century",
  year: "Year",
  season: "Solar season",
  tzolkin: "Tzolk'in",
  "dreamspell-kin": "Dreamspell kin",
  "dreamspell-tone": "Dreamspell tone",
  "dreamspell-wavespell": "Wavespell",
  month: "Month",
  date: "Day of month",
  moon: "Moon phase",
  nakshatra: "Nakshatra",
  decan: "Decan",
  wuku: "Wuku",
  "wuku-tzolkin": "Wuku · Tzolk'in",
  "planetary-day": "Planetary day",
  pancawara: "Pancawara",
  manzil: "Manzil",
  numerology: "Number",
  day: "Hours",
  shi: "Chinese shí",
  "planetary-hour": "Planetary hour",
  muhurta: "Muhūrta",
  ghati: "Ghati",
  ke: "Kè",
  min: "Minutes",
  beat: ".beat",
  pala: "Pala",
  prana: "Prāṇa",
  helek: "Helek",
  sec: "Seconds",
  rega: "Rega",
  ms: "Milliseconds",
};

export function OnyxOrrery({
  lat,
  lon,
  onBack,
  natalDate = null,
  hapticsEnabled = true,
}: {
  lat: number;
  lon: number;
  onBack: () => void;
  /** Saved You-tab birth instant — freeze and jump the lanes there. */
  natalDate?: Date | null;
  /** Master stone toggle — escapement ticks respect this. */
  hapticsEnabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const hapticsRef = useRef(hapticsEnabled);
  hapticsRef.current = hapticsEnabled;
  const [expanded, setExpanded] = useState<OrreryLaneState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [hidden, setHidden] = useState<Set<OrreryLaneId>>(new Set());
  const [selectedLane, setSelectedLane] = useState<OrreryLaneId | null>(null);
  const frozenRef = useRef(false);
  const viewDateRef = useRef(new Date());
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const selectedRef = useRef<OrreryLaneId | null>(null);
  selectedRef.current = selectedLane;
  const lanesRef = useRef<OrreryLaneState[]>([]);
  const hitRef = useRef<{ y0: number; y1: number; id: string }[]>([]);
  const lastIndexRef = useRef<Map<OrreryLaneId, number>>(new Map());
  const nowPulseRef = useRef(0);
  const lastTsRef = useRef(0);
  const scrubAccRef = useRef(0);
  const pointerRef = useRef<{
    id: number;
    x: number;
    y: number;
    laneId: OrreryLaneId | null;
    dragged: boolean;
  } | null>(null);

  useEffect(() => {
    frozenRef.current = frozen;
    setClockTimeFrozen(frozen);
    if (!frozen) {
      viewDateRef.current = new Date();
      scrubAccRef.current = 0;
    }
    return () => setClockTimeFrozen(false);
  }, [frozen]);

  useEffect(() => {
    void startHeliodromeChord();
    return () => stopHeliodromeChord();
  }, []);

  useEffect(() => {
    if (!expanded && !pickerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(null);
        setPickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, pickerOpen]);

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
      if (!frozenRef.current) viewDateRef.current = new Date();
      const { lanes: allLanes } = computeOrreryState(viewDateRef.current, lat, lon);
      const hide = hiddenRef.current;
      const lanes = allLanes.filter(l => l.id !== "wuku-tzolkin" && !hide.has(l.id));
      lanesRef.current = lanes;

      if (!frozenRef.current) {
        tickHeliodromeChord(lanes, hapticsRef.current);
      }

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
      const nowX = w * 0.5;
      const avail = h - padTop - 8;
      const laneH = Math.max(22, (avail - laneGap * Math.max(0, lanes.length - 1)) / Math.max(1, lanes.length));
      const hits: { y0: number; y1: number; id: string }[] = [];

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
        const selected = selectedRef.current === lane.id;

        const startX = laneScrollStartX(nowX, lane.index, lane.progress, cellW);

        const prevIdx = lastIndex.get(lane.id);
        if (prevIdx !== undefined && prevIdx !== lane.index) {
          // Escapement haptic only — string excitation lives in tickHeliodromeChord.
          if (hapticsRef.current && !hapticsMuted()) void pulseHaptic("tick");
          nowPulseRef.current = Math.max(nowPulseRef.current, 0.7);
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
        const centerOnly = CENTER_ONLY.has(lane.id);

        if (selected) {
          ctx.fillStyle = "rgba(180, 160, 255, 0.08)";
          ctx.fillRect(0, y0, w, laneH);
        }

        if (centerOnly) {
          const gx = nowX - cellW / 2;
          const cell = lane.cells[lane.index] ?? lane.cells[underLine] ?? lane.cells[0];
          drawGemCell(ctx, gx + 2, y0 + 3, cellW - 4, laneH - 6, lane.speedT, true, false);
          ctx.fillStyle = "rgba(255,255,255,0.94)";
          ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const label = short(cell?.label || cell?.glyph || lane.activeLabel || lane.name, cellW > 70 ? 12 : 8);
          ctx.fillText(label, nowX, y0 + laneH / 2 + 1);
        } else {
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

  const hitLane = (clientY: number, target: HTMLCanvasElement) => {
    const rect = target.getBoundingClientRect();
    const y = clientY - rect.top;
    const hit = hitRef.current.find(h => y >= h.y0 && y < h.y1);
    if (!hit) return null;
    return lanesRef.current.find(l => l.id === hit.id) ?? null;
  };

  const stepScrub = (laneId: OrreryLaneId, dir: number) => {
    viewDateRef.current = stepOrreryDate(viewDateRef.current, laneId, dir);
    const audio = getClockAudio();
    if (audio) playScrubTick(audio);
    if (hapticsRef.current && !hapticsMuted()) void pulseHaptic("tick");
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const lane = hitLane(e.clientY, e.currentTarget);
    pointerRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      laneId: lane?.id ?? null,
      dragged: false,
    };
    scrubAccRef.current = 0;
    if (frozen && lane) setSelectedLane(lane.id);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ptr = pointerRef.current;
    if (!ptr || ptr.id !== e.pointerId) return;
    const dx = e.clientX - ptr.x;
    const dy = e.clientY - ptr.y;
    if (!ptr.dragged && Math.hypot(dx, dy) > 12) ptr.dragged = true;
    if (!frozen || !ptr.dragged) return;
    const laneId = ptr.laneId ?? selectedRef.current;
    if (!laneId) return;
    ptr.x = e.clientX;
    scrubAccRef.current += dx;
    const cellW = 64;
    while (scrubAccRef.current <= -cellW) {
      stepScrub(laneId, +1);
      scrubAccRef.current += cellW;
    }
    while (scrubAccRef.current >= cellW) {
      stepScrub(laneId, -1);
      scrubAccRef.current -= cellW;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ptr = pointerRef.current;
    pointerRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!ptr || ptr.dragged) return;
    const lane = hitLane(e.clientY, e.currentTarget);
    if (!lane) {
      setExpanded(null);
      return;
    }
    setExpanded(prev => (prev?.id === lane.id ? null : lane));
  };

  const showGroup = (group: readonly OrreryLaneId[]) => {
    const keep = new Set<OrreryLaneId>(group);
    setHidden(new Set(visibleOrreryLaneIds().filter(id => !keep.has(id))));
  };

  const swipeRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const onSwipeDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest?.("button, input, label, .onyx-orrery-teach-scrim")) {
      swipeRef.current = { x: e.clientX, y: e.clientY, ignore: true };
      return;
    }
    swipeRef.current = { x: e.clientX, y: e.clientY, ignore: frozen };
  };
  const onSwipeUp = (e: React.PointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || start.ignore) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx < -72 && Math.abs(dx) > Math.abs(dy)) onBack();
  };

  const visibleCount = visibleOrreryLaneIds().filter(id => !hidden.has(id)).length;

  return (
    <div className="onyx-root">
      <div
        className="onyx-device onyx-orrery-device"
        onPointerDown={onSwipeDown}
        onPointerUp={onSwipeUp}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
      >
        <OnyxStarfield />
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          HOME
        </button>
        <div className="onyx-orrery-header">
          <div className="onyx-orrery-mast">
            <p className="onyx-orrery-title">HELIODROME</p>
            <div className="onyx-orrery-controls">
              <button
                type="button"
                className={`onyx-orrery-filter-btn${frozen ? " is-on" : ""}`}
                onClick={() => {
                  setFrozen(f => !f);
                  setExpanded(null);
                }}
                title="Freeze the running clock. Tap a box for details. Hold and drag to move time."
              >
                {frozen ? "Time frozen" : "Freeze time"}
              </button>
              {natalDate && (
                <button
                  type="button"
                  className="onyx-orrery-filter-btn"
                  onClick={() => {
                    viewDateRef.current = new Date(natalDate.getTime());
                    setFrozen(true);
                    setExpanded(null);
                  }}
                  title="Freeze at the birthday saved in Psyche — date, hour, and minute."
                >
                  Birth
                </button>
              )}
              <button
                type="button"
                className="onyx-orrery-filter-btn"
                onClick={() => setPickerOpen(true)}
                title="Choose which cycles are displayed"
              >
                Cycles · {visibleCount}
              </button>
            </div>
            <div className="onyx-orrery-axis" aria-hidden="true">
              <p className="onyx-orrery-axis-kicker">every quality is an axis</p>
              <div className="onyx-orrery-laxis">
                <span className="p">Yin</span>
                <span className="bar" />
                <span className="z">0</span>
                <span className="bar" />
                <span className="r">Yang</span>
              </div>
            </div>
          </div>
        </div>
        <div className="onyx-orrery-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className={`onyx-orrery-canvas${frozen ? " is-frozen" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Heliodrome — live stacked cultural cycles"
          />
        </div>
        {pickerOpen && (
          <div className="onyx-orrery-teach-scrim" onClick={() => setPickerOpen(false)}>
            <section
              className="onyx-orrery-teach onyx-orrery-picker"
              role="dialog"
              aria-modal="true"
              aria-label="Choose cycles"
              onClick={event => event.stopPropagation()}
            >
              <p className="onyx-eyebrow">Cycles</p>
              <p className="onyx-layer-lead">Choose which lanes stay on the stack</p>
              <div className="onyx-orrery-picker-actions">
                <div className="onyx-orrery-picker-row">
                  <button
                    type="button"
                    className="onyx-orrery-filter-btn onyx-orrery-picker-show"
                    onClick={() => setHidden(new Set())}
                  >
                    Show all
                  </button>
                  <button
                    type="button"
                    className="onyx-orrery-filter-btn onyx-orrery-picker-hide"
                    onClick={() => setHidden(new Set(visibleOrreryLaneIds()))}
                  >
                    Hide all
                  </button>
                </div>
                <div className="onyx-orrery-picker-row onyx-orrery-picker-groups">
                  <button
                    type="button"
                    className="onyx-orrery-filter-btn"
                    onClick={() => showGroup(ORRERY_LANE_GROUPS.scientific)}
                  >
                    Scientific
                  </button>
                  <button
                    type="button"
                    className="onyx-orrery-filter-btn"
                    onClick={() => showGroup(ORRERY_LANE_GROUPS.cultural)}
                  >
                    Cultural
                  </button>
                  <button
                    type="button"
                    className="onyx-orrery-filter-btn"
                    onClick={() => showGroup(ORRERY_LANE_GROUPS.mystical)}
                  >
                    Mystical
                  </button>
                </div>
              </div>
              <ul className="onyx-orrery-picker-list">
                {visibleOrreryLaneIds().map(id => (
                  <li key={id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={!hidden.has(id)}
                        onChange={() => {
                          setHidden(prev => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          });
                        }}
                      />
                      {LANE_LABEL[id]}
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="onyx-tool-btn onyx-orrery-teach-close onyx-orrery-picker-done"
                onClick={() => setPickerOpen(false)}
              >
                Done
              </button>
            </section>
          </div>
        )}
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
