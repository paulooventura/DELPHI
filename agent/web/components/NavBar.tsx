'use client';

// ───────────────────────────────────────────────────────────────
// COSMOS · NavBar  (floating bottom nav)
// ───────────────────────────────────────────────────────────────

import { motion } from 'framer-motion';
import { useCosmosStore } from '@/store/useCosmosStore';
import type { TabId } from '@/types/cosmos';

const TABS: { id: TabId; label: string; glyph: string }[] = [
  { id: 'sky', label: 'Sky', glyph: '✶' },
  { id: 'clock', label: 'Clock', glyph: '◴' },
  { id: 'moment', label: 'Moment', glyph: '◉' },
];

export default function NavBar() {
  const active = useCosmosStore((s) => s.activeTab);
  const setTab = useCosmosStore((s) => s.setTab);

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex gap-1 rounded-full border border-amber-500/20 bg-black/60 p-1.5 backdrop-blur-xl">
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={on ? 'page' : undefined}
              className="relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm tracking-wide transition-colors"
            >
              {on && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-amber-400/15 ring-1 ring-amber-300/40"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className={`relative ${on ? 'text-amber-200' : 'text-zinc-400'}`}>
                {t.glyph}
              </span>
              <span className={`relative ${on ? 'text-amber-100' : 'text-zinc-500'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
