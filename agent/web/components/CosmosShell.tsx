'use client';

// ───────────────────────────────────────────────────────────────
// COSMOS · CosmosShell
// Client root. Boots the global clock, gates the AR permission
// sequence, and routes the three tabs. SkyMap is loaded lazily
// (ssr:false) because Three.js touches `window`.
// ───────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useCosmosStore } from '@/store/useCosmosStore';
import NavBar from './NavBar';
import CosmicClock from './CosmicClock';
import MomentReading from './MomentReading';

const SkyMap = dynamic(() => import('./SkyMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100dvh] items-center justify-center bg-black text-amber-200/70">
      charting the sky…
    </div>
  ),
});

export default function CosmosShell() {
  const tab = useCosmosStore((s) => s.activeTab);
  const startClock = useCosmosStore((s) => s.startClock);
  const stopClock = useCosmosStore((s) => s.stopClock);
  const requestSensors = useCosmosStore((s) => s.requestSensors);
  const requestGeo = useCosmosStore((s) => s.requestGeo);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    startClock();
    return () => stopClock();
  }, [startClock, stopClock]);

  // Permission requests must be triggered by a user gesture (iOS).
  const beginExperience = async () => {
    setOnboarded(true);
    await requestGeo();
    // sensors requested here only if we land on the sky tab; the
    // SkyMap also exposes a retry button if the user declines.
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-zinc-100">
      <AnimatePresence mode="wait">
        {!onboarded ? (
          <motion.div
            key="onboard"
            exit={{ opacity: 0 }}
            className="flex h-[100dvh] flex-col items-center justify-center px-8 text-center"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.42em] text-amber-500/80">
              Universal Cosmic Clock
            </p>
            <h1 className="mt-3 text-4xl text-amber-100" style={{ fontFamily: 'var(--font-display, serif)' }}>
              COSMOS
            </h1>
            <p className="mt-4 max-w-xs text-zinc-400">
              One moment, read across six traditions, the live sky, and the
              weather around you. Allow location and motion to ground the
              reading in your here-and-now.
            </p>
            <button
              onClick={beginExperience}
              className="mt-8 rounded-full border border-amber-300/50 bg-amber-400/10 px-7 py-3 text-amber-100"
            >
              enter
            </button>
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[100dvh]">
            {tab === 'sky' && <SkyMap />}
            {tab === 'clock' && <CosmicClock />}
            {tab === 'moment' && <MomentReading />}
            <NavBar />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
