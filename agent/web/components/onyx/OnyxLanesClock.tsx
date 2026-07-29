"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { muhurtaPhase } from "../../lib/cosmic/math";
import { byId, bySystem } from "../../lib/lore/qualia";

export type OnyxLanesClockProps = {
  now: Date;
  lat: number;
  lon: number;
  onBack: () => void;
  onSelectLane?: (laneId: string) => void;
};

type Tier = "measured" | "celebrated";
type LaneKind = "pulse" | "cells";

type LaneDef = {
  id: string;
  name: string;
  cycleLabel: string;
  tier: Tier;
  kind: LaneKind;
  color: string;
  /** Cycle length in ms (for pulse / continuous phase). */
  cycleMs: number;
  /** Number of discrete cells; pulse lanes use mark count. */
  cellCount: number;
  cellLabels?: string[];
};

const MS_DAY = 86_400_000;
const SYNODIC_MS = 29.530588 * MS_DAY;
/** Approximate new moon near J2000 for phase fraction. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0);
const WUKU_EPOCH = Date.UTC(1900, 0, 1);

const CHALDEAN = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"] as const;
/** JS getDay(): Sun…Sat → Chaldean index of day-ruler. */
const DAY_RULER_IDX = [3, 6, 2, 5, 1, 4, 0] as const;

const SHI_IDS = [
  "shi-zi",
  "shi-chou",
  "shi-yin",
  "shi-mao",
  "shi-chen",
  "shi-si",
  "shi-wu",
  "shi-wei",
  "shi-shen",
  "shi-you",
  "shi-xu",
  "shi-hai",
] as const;

const ZODIAC_IDS = [
  "wz-aries",
  "wz-taurus",
  "wz-gemini",
  "wz-cancer",
  "wz-leo",
  "wz-virgo",
  "wz-libra",
  "wz-scorpio",
  "wz-sagittarius",
  "wz-capricorn",
  "wz-aquarius",
  "wz-pisces",
] as const;

const MOON_IDS = [
  "mp-new",
  "mp-wax-cres",
  "mp-first-q",
  "mp-wax-gib",
  "mp-full",
  "mp-wan-gib",
  "mp-last-q",
  "mp-wan-cres",
] as const;

const PLANET_IDS = CHALDEAN.map((p) => `ph-${p}`);

function shortName(full: string): string {
  return full.replace(/\s+hour$/i, "").replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

function dayIndexUTC(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_DAY);
}

function moonPhaseFraction(t: number): number {
  const f = (t - NEW_MOON_EPOCH) / SYNODIC_MS;
  return ((f % 1) + 1) % 1;
}

function tropicalZodiacIndex(d: Date): { index: number; frac: number } {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const doy =
    (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / MS_DAY;
  // ~March 21 ≈ day 80 — Aries 0°
  const solarLon = (((doy - 80) / 365.2422) * 360 + 360) % 360;
  const index = Math.floor(solarLon / 30) % 12;
  const frac = (solarLon % 30) / 30;
  return { index, frac };
}

function chineseShiPhase(d: Date): { index: number; frac: number; totalFrac: number } {
  const mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000;
  // Zi starts 23:00 — shift so 23:00 → 0
  const shifted = (mins + 60 + 24 * 60) % (24 * 60);
  const total = shifted / 120; // 12 double-hours
  const index = Math.floor(total) % 12;
  const frac = total - Math.floor(total);
  return { index, frac, totalFrac: (total % 12) / 12 };
}

/** Equal-hour Chaldean cycle when sunrise is unavailable. */
function planetaryHourPhase(d: Date): { index: number; frac: number; totalFrac: number } {
  const mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000;
  const hourOfDay = Math.floor(mins / 60);
  const within = (mins % 60) / 60;
  const start = DAY_RULER_IDX[d.getDay()] ?? 0;
  const index = (start + hourOfDay) % 7;
  const totalFrac = ((start + mins / 60) % 7) / 7;
  return { index, frac: within, totalFrac };
}

function muhurtaLanePhase(d: Date): { index: number; frac: number; totalFrac: number } {
  const { index, angleDeg } = muhurtaPhase(d);
  const totalFrac = (angleDeg / 360 + 1) % 1;
  const cellFrac = (totalFrac * 30) % 1;
  return { index: ((index % 30) + 30) % 30, frac: cellFrac, totalFrac };
}

function pancawaraPhase(d: Date): { index: number; frac: number; totalFrac: number } {
  const days = dayIndexUTC(d);
  const index = ((days % 5) + 5) % 5;
  const local = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
  const frac = local / 86400;
  return { index, frac, totalFrac: ((days + frac) % 5) / 5 };
}

function wukuPhase(d: Date): { index: number; frac: number; totalFrac: number } {
  const days = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - WUKU_EPOCH) / MS_DAY);
  const index = ((days % 30) + 30) % 30;
  const local = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
  const frac = local / 86400;
  return { index, frac, totalFrac: ((days + frac) % 30) / 30 };
}

function moonLanePhase(t: number): { index: number; frac: number; totalFrac: number } {
  const totalFrac = moonPhaseFraction(t);
  const scaled = totalFrac * 8;
  return { index: Math.floor(scaled) % 8, frac: scaled % 1, totalFrac };
}

function seasonPhase(d: Date): { index: number; frac: number; totalFrac: number } {
  const { index, frac } = tropicalZodiacIndex(d);
  return { index, frac, totalFrac: (index + frac) / 12 };
}

function pulseFrac(t: number, cycleMs: number): number {
  return ((t % cycleMs) + cycleMs) % cycleMs / cycleMs;
}

function digitalRoot(d: Date): number {
  let n = d.getFullYear() + (d.getMonth() + 1) + d.getDate();
  while (n > 9) {
    n = String(n)
      .split("")
      .reduce((a, c) => a + Number(c), 0);
  }
  return n;
}

function buildLanes(): LaneDef[] {
  const muhurta = bySystem("muhurta");
  const pancawara = bySystem("pancawara");
  const wuku = bySystem("pawukon-wuku");
  const shi = SHI_IDS.map((id) => shortName(byId(id)?.name ?? id));
  const planets = PLANET_IDS.map((id) => shortName(byId(id)?.name ?? id));
  const moons = MOON_IDS.map((id) => byId(id)?.name ?? id);
  const zodiac = ZODIAC_IDS.map((id) => byId(id)?.name ?? id);

  // Visual top→bottom = north/slow → south/fast (spec #12 → #1)
  return [
    {
      id: "season",
      name: "Solar season",
      cycleLabel: "~1 year",
      tier: "celebrated",
      kind: "cells",
      color: "#1a3a8a",
      cycleMs: 365.2422 * MS_DAY,
      cellCount: 12,
      cellLabels: zodiac,
    },
    {
      id: "wuku",
      name: "Wuku / Tzolk'in",
      cycleLabel: "30 / 260 days",
      tier: "celebrated",
      kind: "cells",
      color: "#1e4a9c",
      cycleMs: 30 * MS_DAY,
      cellCount: 30,
      cellLabels: wuku.length ? wuku.map((q) => q.name) : Array.from({ length: 30 }, (_, i) => `Wuku ${i + 1}`),
    },
    {
      id: "moon",
      name: "Moon phase",
      cycleLabel: "~29.5 days",
      tier: "measured",
      kind: "cells",
      color: "#1a6a8a",
      cycleMs: SYNODIC_MS,
      cellCount: 8,
      cellLabels: moons,
    },
    {
      id: "pancawara",
      name: "Pancawara",
      cycleLabel: "5 days",
      tier: "celebrated",
      kind: "cells",
      color: "#1a7a6a",
      cycleMs: 5 * MS_DAY,
      cellCount: 5,
      cellLabels: pancawara.map((q) => q.name),
    },
    {
      id: "day",
      name: "The day",
      cycleLabel: "24 h",
      tier: "measured",
      kind: "pulse",
      color: "#2a8a4a",
      cycleMs: MS_DAY,
      cellCount: 24,
    },
    {
      id: "chinese-shi",
      name: "Chinese shí",
      cycleLabel: "2 h",
      tier: "celebrated",
      kind: "cells",
      color: "#6a9a2a",
      cycleMs: 2 * 3_600_000,
      cellCount: 12,
      cellLabels: shi,
    },
    {
      id: "planetary-hour",
      name: "Planetary hour",
      cycleLabel: "~60 min",
      tier: "celebrated",
      kind: "cells",
      color: "#b8a020",
      cycleMs: 3_600_000,
      cellCount: 7,
      cellLabels: planets,
    },
    {
      id: "muhurta",
      name: "Muhūrta",
      cycleLabel: "~48 min",
      tier: "celebrated",
      kind: "cells",
      color: "#c99020",
      cycleMs: 48 * 60_000,
      cellCount: 30,
      cellLabels: muhurta.map((q) => q.name),
    },
    {
      id: "ghati",
      name: "Ghati",
      cycleLabel: "~24 min",
      tier: "measured",
      kind: "pulse",
      color: "#d87828",
      cycleMs: 24 * 60_000,
      cellCount: 60,
    },
    {
      id: "minutes",
      name: "Minutes",
      cycleLabel: "60 min",
      tier: "measured",
      kind: "pulse",
      color: "#e06030",
      cycleMs: 3_600_000,
      cellCount: 60,
    },
    {
      id: "seconds",
      name: "Seconds",
      cycleLabel: "60 s",
      tier: "measured",
      kind: "pulse",
      color: "#e84838",
      cycleMs: 60_000,
      cellCount: 60,
    },
    {
      id: "milliseconds",
      name: "Milliseconds",
      cycleLabel: "1000 ms",
      tier: "measured",
      kind: "pulse",
      color: "#f02828",
      cycleMs: 1000,
      cellCount: 10,
    },
  ];
}

function phaseForLane(id: string, d: Date): { index: number; frac: number; totalFrac: number; value: string } {
  const t = d.getTime();
  switch (id) {
    case "milliseconds": {
      const f = pulseFrac(t, 1000);
      return { index: Math.floor(f * 10), frac: (f * 10) % 1, totalFrac: f, value: `${Math.floor(f * 1000)} ms` };
    }
    case "seconds": {
      const f = pulseFrac(t, 60_000);
      return { index: Math.floor(f * 60), frac: (f * 60) % 1, totalFrac: f, value: `${d.getSeconds()} s` };
    }
    case "minutes": {
      const f = pulseFrac(t, 3_600_000);
      return { index: Math.floor(f * 60), frac: (f * 60) % 1, totalFrac: f, value: `${d.getMinutes()} min` };
    }
    case "ghati": {
      const f = pulseFrac(t, 24 * 60_000);
      const n = Math.floor(((d.getHours() * 60 + d.getMinutes()) % (24 * 60)) / 24);
      return { index: n % 60, frac: (f * 60) % 1, totalFrac: f, value: `Ghati ${n + 1}` };
    }
    case "muhurta": {
      const p = muhurtaLanePhase(d);
      const q = byId(`muh-${String(p.index + 1).padStart(2, "0")}`);
      return { ...p, value: q?.name ?? `Muhūrta ${p.index + 1}` };
    }
    case "planetary-hour": {
      const p = planetaryHourPhase(d);
      const q = byId(PLANET_IDS[p.index]!);
      return { ...p, value: q?.name ?? CHALDEAN[p.index]! };
    }
    case "chinese-shi": {
      const p = chineseShiPhase(d);
      const q = byId(SHI_IDS[p.index]!);
      return { ...p, value: q?.name ?? SHI_IDS[p.index]! };
    }
    case "day": {
      const f = pulseFrac(
        d.getHours() * 3_600_000 +
          d.getMinutes() * 60_000 +
          d.getSeconds() * 1000 +
          d.getMilliseconds(),
        MS_DAY,
      );
      return {
        index: d.getHours(),
        frac: (d.getMinutes() * 60 + d.getSeconds()) / 3600,
        totalFrac: f,
        value: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      };
    }
    case "pancawara": {
      const p = pancawaraPhase(d);
      const q = byId(`pc-${p.index + 1}`);
      return { ...p, value: q?.name ?? `Day ${p.index + 1}` };
    }
    case "moon": {
      const p = moonLanePhase(t);
      const q = byId(MOON_IDS[p.index]!);
      return { ...p, value: q?.name ?? `Phase ${p.index + 1}` };
    }
    case "wuku": {
      const p = wukuPhase(d);
      const q = byId(`wk-${String(p.index + 1).padStart(2, "0")}`);
      return { ...p, value: q?.name ?? `Wuku ${p.index + 1}` };
    }
    case "season": {
      const p = seasonPhase(d);
      const q = byId(ZODIAC_IDS[p.index]!);
      return { ...p, value: q?.name ?? ZODIAC_IDS[p.index]! };
    }
    default:
      return { index: 0, frac: 0, totalFrac: 0, value: "—" };
  }
}

function slowSkyLabels(d: Date): { key: string; label: string; value: string }[] {
  const moonFrac = moonPhaseFraction(d.getTime());
  const nakIdx = Math.floor(moonFrac * 27) % 27;
  const manzilIdx = Math.floor(moonFrac * 28) % 28;
  const decanIdx = Math.floor(
    (((tropicalZodiacIndex(d).index + tropicalZodiacIndex(d).frac) * 36) % 36),
  );
  const nak = bySystem("nakshatra")[nakIdx];
  const manzil = byId(`mz-${String(manzilIdx + 1).padStart(2, "0")}`);
  const decan = byId(`dc-${String(decanIdx + 1).padStart(2, "0")}`);
  const root = digitalRoot(d);
  const num = byId(`num-${root}`);
  // Precession placeholder: ~50.3"/yr from J2000
  const years = (d.getTime() - Date.UTC(2000, 0, 1)) / (365.2422 * MS_DAY);
  const precArcSec = years * 50.29;
  return [
    { key: "precession", label: "Precession", value: `+${precArcSec.toFixed(1)}″ from J2000` },
    { key: "decan", label: "Decan", value: decan?.name ?? `Decan ${decanIdx + 1}` },
    { key: "nakshatra", label: "Nakshatra", value: nak?.name ?? `Nakshatra ${nakIdx + 1}` },
    { key: "manzil", label: "Manzil", value: manzil?.name ?? `Manzil ${manzilIdx + 1}` },
    { key: "numerology", label: "Numerology", value: num?.name ?? `Root ${root}` },
  ];
}

const TILES = 3;

export function OnyxLanesClock({
  now,
  lat: _lat,
  lon: _lon,
  onBack,
  onSelectLane,
}: OnyxLanesClockProps) {
  void _lat;
  void _lon;
  const lanes = useMemo(() => buildLanes(), []);
  const trackRefs = useRef<Record<string, HTMLElement | null>>({});

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [liveValues, setLiveValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const lane of lanes) init[lane.id] = phaseForLane(lane.id, now).value;
    return init;
  });
  const [sky, setSky] = useState(() => slowSkyLabels(now));

  const applyTransforms = useCallback(
    (d: Date) => {
      for (const lane of lanes) {
        const el = trackRefs.current[lane.id];
        if (!el) continue;
        const { totalFrac } = phaseForLane(lane.id, d);
        const cellW = lane.kind === "cells" ? 72 : 28;
        const cycleW = lane.cellCount * cellW;
        // Point at totalFrac * cycleW sits under the now-line (50%).
        const offset = totalFrac * cycleW;
        // Center the repeating middle tile under the viewport center.
        const base = cycleW; // start of middle tile
        el.style.transform = `translate3d(calc(50% - ${base + offset}px),0,0)`;
      }
    },
    [lanes],
  );

  useEffect(() => {
    let raf = 0;
    let alive = true;
    let lastLabel = 0;

    const tick = () => {
      if (!alive || document.hidden) return;
      const d = new Date();
      applyTransforms(d);
      const t = performance.now();
      if (t - lastLabel > 250) {
        lastLabel = t;
        const next: Record<string, string> = {};
        for (const lane of lanes) next[lane.id] = phaseForLane(lane.id, d).value;
        setLiveValues(next);
        setSky(slowSkyLabels(d));
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (!alive || document.hidden) return;
      applyTransforms(new Date());
      raf = requestAnimationFrame(tick);
    };

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        start();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [applyTransforms, lanes]);

  const expanded = expandedId ? lanes.find((l) => l.id === expandedId) : null;
  const expandedPhase = expanded ? phaseForLane(expanded.id, new Date()) : null;

  const onLaneTap = (laneId: string) => {
    setExpandedId((cur) => (cur === laneId ? null : laneId));
    onSelectLane?.(laneId);
  };

  return (
    <div className="onyx-root">
      <div className="onyx-device onyx-device-scroll onyx-lanes-device">
        <button type="button" className="onyx-overlay-close" onClick={onBack}>
          close
        </button>

        <div className="onyx-lanes">
          <p className="onyx-eyebrow onyx-lanes-eyebrow">ORRERY · stacked lanes</p>

          <div className="onyx-lanes-slowsky" aria-label="Slow sky">
            <p className="onyx-lanes-slowsky-title">Slow sky · north</p>
            <ul className="onyx-lanes-slowsky-list">
              {sky.map((row) => (
                <li key={row.key}>
                  <span>{row.label}</span>
                  <span>{row.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="onyx-lanes-stack" role="list">
            <div className="onyx-lanes-now" aria-hidden="true" />

            {lanes.map((lane) => {
              const labels =
                lane.cellLabels ??
                Array.from({ length: lane.cellCount }, (_, i) => String(i));
              const tiles = Array.from({ length: TILES }, (_, ti) => ti);
              const isOpen = expandedId === lane.id;
              return (
                <button
                  key={lane.id}
                  type="button"
                  role="listitem"
                  className={`onyx-lane onyx-lane--${lane.tier}${isOpen ? " is-open" : ""}`}
                  style={{ ["--lane-color" as string]: lane.color }}
                  onClick={() => onLaneTap(lane.id)}
                  aria-expanded={isOpen}
                  aria-label={`${lane.name}: ${liveValues[lane.id] ?? ""}`}
                >
                  <span className="onyx-lane-meta">
                    <span className="onyx-lane-name">{lane.name}</span>
                    <span className="onyx-lane-now-val">{liveValues[lane.id]}</span>
                  </span>
                  <span className="onyx-lane-viewport">
                    <span
                      className={`onyx-lane-track onyx-lane-track--${lane.kind}`}
                      ref={(el) => {
                        trackRefs.current[lane.id] = el;
                      }}
                    >
                      {tiles.map((ti) =>
                        lane.kind === "cells" ? (
                          <span className="onyx-lane-cycle" key={ti}>
                            {labels.map((lab, i) => (
                              <span className="onyx-lane-cell" key={`${ti}-${i}`}>
                                {lab}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="onyx-lane-cycle onyx-lane-cycle--pulse" key={ti}>
                            {Array.from({ length: lane.cellCount }, (_, i) => (
                              <span className="onyx-lane-tick" key={`${ti}-${i}`} />
                            ))}
                          </span>
                        ),
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {expanded && expandedPhase && (
            <div className="onyx-lane-explain" role="region" aria-live="polite">
              <p className="onyx-lane-explain-name">{expanded.name}</p>
              <p className="onyx-lane-explain-row">
                <span>Cycle</span>
                <span>{expanded.cycleLabel}</span>
              </p>
              <p className="onyx-lane-explain-row">
                <span>Tier</span>
                <span>{expanded.tier}</span>
              </p>
              <p className="onyx-lane-explain-row">
                <span>Now</span>
                <span>{expandedPhase.value}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
