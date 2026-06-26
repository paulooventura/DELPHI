'use client';

// ───────────────────────────────────────────────────────────────
// COSMOS · MomentReading
// Ingests live cycles + weather + profile → one essence reading.
// ───────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useCosmosStore } from '@/store/useCosmosStore';
import { resolveCycles } from '@/services/astronomyEngine';
import { synthesize } from '@/services/synthesisEngine';

export default function MomentReading() {
  const now = useCosmosStore((s) => s.now);
  const weather = useCosmosStore((s) => s.weather);
  const profile = useCosmosStore((s) => s.profile);
  const coords = useCosmosStore((s) => s.coords);
  const requestGeo = useCosmosStore((s) => s.requestGeo);

  // The reading recomputes per minute (synthesize seeds on minute).
  const minuteKey = Math.floor(now.getTime() / 60000);
  const reading = useMemo(() => {
    const cycles = resolveCycles(now);
    return synthesize(cycles, weather ?? undefined, now, profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minuteKey, weather, profile]);

  return (
    <div className="relative flex h-[100dvh] w-full flex-col justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_120%,#1a1230_0%,#0a0a12_60%)] px-7 pb-28 pt-10">
      <motion.div
        key={minuteKey}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="mx-auto w-full max-w-md"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber-500/70">
          The Moment ·{' '}
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>

        <h1
          className="mt-4 text-4xl leading-tight text-amber-100"
          style={{ fontFamily: 'var(--font-display, serif)' }}
        >
          {reading.headline}
        </h1>

        <p className="mt-6 text-[17px] leading-relaxed text-zinc-300">
          {reading.body}
        </p>

        <div className="mt-8 space-y-4 border-l border-amber-500/25 pl-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-rose-300/70">
              Shadow
            </p>
            <p className="text-zinc-300">{reading.shadow}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/70">
              Focus
            </p>
            <p className="text-zinc-300">{reading.focus}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {reading.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-amber-500/20 px-3 py-1 text-xs text-amber-200/80"
            >
              {t}
            </span>
          ))}
        </div>

        {!coords && (
          <button
            onClick={requestGeo}
            className="mt-8 rounded-full border border-amber-300/40 px-4 py-2 text-sm text-amber-100"
          >
            add local weather to the reading
          </button>
        )}
      </motion.div>
    </div>
  );
}
