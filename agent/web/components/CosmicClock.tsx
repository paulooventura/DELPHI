'use client';

// ───────────────────────────────────────────────────────────────
// COSMOS · CosmicClock
// Concentric SVG rings. Each ring rotates so its active segment
// sits under the fixed 12-o'clock plumb line. Tap a ring → flyout.
// ───────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCosmosStore } from '@/store/useCosmosStore';
import {
  resolveCycles,
  moonInfoPublic,
  planetaryDay,
  toJD,
} from '@/services/astronomyEngine';
import type { CycleState } from '@/types/cosmos';

const C = 380;
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg - 90) * (Math.PI / 180);
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

const RING_GEOM = [
  { id: 'precession', rOuter: 372, rInner: 332, font: 13, color: '#4a6da8' },
  { id: 'tropical', rOuter: 330, rInner: 286, font: 16, color: '#c9a84a' },
  { id: 'nakshatra', rOuter: 284, rInner: 246, font: 9, color: '#5b8c7a' },
  { id: 'chinese', rOuter: 244, rInner: 206, font: 13, color: '#b06a3c' },
  { id: 'tzolkin', rOuter: 204, rInner: 166, font: 9, color: '#a8576b' },
  { id: 'decan', rOuter: 164, rInner: 128, font: 8, color: '#e0c878' },
] as const;

function Ring({
  geom,
  cycle,
  onTap,
}: {
  geom: (typeof RING_GEOM)[number];
  cycle: CycleState;
  onTap: () => void;
}) {
  const seg = 360 / cycle.count;
  const segs = [];
  for (let i = 0; i < cycle.count; i++) {
    const a0 = i * seg;
    const a1 = (i + 1) * seg;
    const [x0, y0] = polar(geom.rOuter, a0);
    const [x1, y1] = polar(geom.rOuter, a1);
    const [x2, y2] = polar(geom.rInner, a1);
    const [x3, y3] = polar(geom.rInner, a0);
    const large = seg > 180 ? 1 : 0;
    const active = i === cycle.activeIndex;
    const mid = a0 + seg / 2;
    const [tx, ty] = polar((geom.rOuter + geom.rInner) / 2, mid);
    segs.push(
      <g key={i}>
        <path
          d={`M${x0},${y0} A${geom.rOuter},${geom.rOuter} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${geom.rInner},${geom.rInner} 0 ${large} 0 ${x3},${y3} Z`}
          fill={active ? geom.color : 'rgba(255,255,255,0.012)'}
          stroke={active ? geom.color : 'rgba(201,168,74,0.10)'}
          strokeWidth={active ? 1.2 : 0.5}
        />
        <text
          x={tx}
          y={ty}
          fontSize={geom.font}
          textAnchor="middle"
          dominantBaseline="central"
          fill={active ? '#0a0a12' : '#8a8499'}
          fillOpacity={active ? 1 : 0.5}
          transform={`rotate(${mid},${tx},${ty})`}
          style={{ fontFamily: 'var(--font-display, serif)' }}
        >
          {segLabel(cycle, i)}
        </text>
      </g>,
    );
  }
  return (
    <g
      transform={`rotate(${cycle.rotation},${C},${C})`}
      onClick={onTap}
      style={{ cursor: 'pointer', transition: 'transform 700ms cubic-bezier(.4,0,.2,1)' }}
    >
      {segs}
    </g>
  );
}

const CTL =
  'font-mono text-xs bg-white/5 border border-amber-500/20 text-zinc-100 px-3 py-2 rounded-sm tracking-wide transition hover:bg-amber-400/10 hover:border-amber-400';

const GLYPHS: Record<string, string[]> = {
  precession: ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'],
  tropical: ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'],
  chinese: ['🐀','🐂','🐅','🐇','🐉','🐍','🐎','🐐','🐒','🐓','🐕','🐖'],
};
function segLabel(cycle: CycleState, i: number): string {
  const g = GLYPHS[cycle.id];
  if (g) return g[i];
  return String(i + 1);
}

export default function CosmicClock() {
  const now = useCosmosStore((s) => s.now);
  const live = useCosmosStore((s) => s.live);
  const setNow = useCosmosStore((s) => s.setNow);
  const goLive = useCosmosStore((s) => s.goLive);
  const [flyout, setFlyout] = useState<CycleState | null>(null);

  const cycles = useMemo(() => resolveCycles(now), [now]);
  const moon = useMemo(() => moonInfoPublic(now), [now]);
  const pday = planetaryDay(now);
  const JD = toJD(now);
  const byId = (id: string) => cycles.find((c) => c.id === id)!;

  const shiftDays = (d: number) =>
    setNow(new Date(now.getTime() + d * 86400000));

  return (
    <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,#15152a_0%,#0a0a12_55%)] px-4 pb-28 pt-6">
      <div className="mb-2 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.42em] text-amber-500/80">
          As Above · So Below
        </p>
        <h1 className="text-3xl text-amber-200/90" style={{ fontFamily: 'var(--font-display, serif)' }}>
          The Cosmic Clock
        </h1>
      </div>

      <div className="relative aspect-square w-full max-w-[560px]">
        <svg viewBox="0 0 760 760" className="h-full w-full">
          <defs>
            <radialGradient id="hub" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a1a30" />
              <stop offset="100%" stopColor="#0a0a12" />
            </radialGradient>
          </defs>

          {RING_GEOM.map((g) => (
            <Ring key={g.id} geom={g} cycle={byId(g.id)} onTap={() => setFlyout(byId(g.id))} />
          ))}

          {/* fixed plumb-line indicator */}
          <polygon points={`${C},10 ${C - 9},30 ${C + 9},30`} fill="#c9a84a" />
          <line x1={C} y1={30} x2={C} y2={128} stroke="#c9a84a" strokeOpacity="0.25" />

          {/* hub: moon + planetary day */}
          <circle cx={C} cy={C} r={118} fill="url(#hub)" stroke="rgba(201,168,74,0.18)" />
          <circle cx={C} cy={C - 44} r={26} fill="#1d1d33" stroke="#e0c878" strokeWidth="0.6" />
          <clipPath id="mc">
            <circle cx={C} cy={C - 44} r={26} />
          </clipPath>
          <rect
            x={C - 26}
            y={C - 70}
            width={52 * moon.illum}
            height={52}
            fill="#e0c878"
            fillOpacity="0.85"
            clipPath="url(#mc)"
          />
          <text x={C} y={C + 2} textAnchor="middle" fontSize="15" fill="#e0c878" style={{ fontFamily: 'var(--font-display, serif)' }}>
            {moon.name}
          </text>
          <text x={C} y={C + 24} textAnchor="middle" fontSize="11" fill="#8a8499" fontFamily="monospace">
            {pday}'s Day
          </text>
          <text x={C} y={C + 50} textAnchor="middle" fontSize="9" fill="#8a8499" fontFamily="monospace" letterSpacing="2">
            JD {JD.toFixed(2)}
          </text>
        </svg>
      </div>

      {/* time controls */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button onClick={() => shiftDays(-365)} className={CTL}>« yr</button>
        <button onClick={() => shiftDays(-1)} className={CTL}>« day</button>
        <button onClick={goLive} className={`${CTL} ${live ? 'border-emerald-500/70 text-emerald-400' : ''}`}>
          {live ? '● live' : 'now'}
        </button>
        <button onClick={() => shiftDays(1)} className={CTL}>day »</button>
        <button onClick={() => shiftDays(365)} className={CTL}>yr »</button>
      </div>

      {/* flyout */}
      <AnimatePresence>
        {flyout && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed right-0 top-0 z-40 h-[100dvh] w-[min(86vw,400px)] border-l border-amber-500/20 bg-black/80 p-6 backdrop-blur-xl"
          >
            <button onClick={() => setFlyout(null)} className="mb-6 text-zinc-400 hover:text-amber-200">
              ✕ close
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-500/80">
              {flyout.culture}
            </p>
            <h2 className="mb-1 mt-1 text-2xl text-amber-100" style={{ fontFamily: 'var(--font-display, serif)' }}>
              {flyout.ring}
            </h2>
            <p className="mb-4 text-lg text-zinc-200">
              now: <span className="text-amber-200">{flyout.label}</span>
              {flyout.detail && <span className="text-zinc-400"> · {flyout.detail}</span>}
            </p>
            <p className="text-[15px] leading-relaxed text-zinc-400">{flyout.blurb}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
