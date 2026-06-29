"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { CycleSnapshot } from "../lib/cycleSystems";
import { synthesizeFromSnapshot } from "../lib/synthesisFromSnapshot";

export function MomentReading({
  snapshot,
  now,
  hasLocation,
  onRequestLocation,
}: {
  snapshot: CycleSnapshot;
  now: Date;
  hasLocation: boolean;
  onRequestLocation?: () => void;
}) {
  const minuteKey = Math.floor(now.getTime() / 60000);
  const reading = useMemo(
    () => synthesizeFromSnapshot(snapshot, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, snapshot],
  );

  return (
    <section className="cp-moment cp-card-secondary flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-8 pb-28">
      <motion.div
        key={minuteKey}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="mx-auto w-full max-w-md"
      >
        <p className="cp-muted text-xs uppercase tracking-[0.35em]">
          The Moment · {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>

        <h1 className="mt-4 font-[family-name:var(--font-cinzel)] text-3xl leading-tight text-[var(--cp-accent)]">
          {reading.headline}
        </h1>

        <p className="cp-muted mt-6 text-[17px] leading-relaxed">
          {reading.body}
        </p>

        <div className="mt-8 space-y-4 border-l border-[var(--cp-border)] pl-4">
          <div>
            <p className="cp-muted text-xs uppercase tracking-[0.3em] text-rose-300/80">Shadow</p>
            <p className="cp-muted">{reading.shadow}</p>
          </div>
          <div>
            <p className="cp-muted text-xs uppercase tracking-[0.3em] text-emerald-300/80">Focus</p>
            <p className="cp-muted">{reading.focus}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {reading.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-[var(--cp-border)] px-3 py-1 text-xs text-[var(--cp-accent)]"
            >
              {t}
            </span>
          ))}
        </div>

        {!hasLocation && onRequestLocation && (
          <button type="button" onClick={onRequestLocation} className="cp-btn cp-btn-sm mt-8">
            add local weather to the reading
          </button>
        )}
      </motion.div>
    </section>
  );
}
