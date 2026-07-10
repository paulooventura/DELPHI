"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { CycleSnapshot } from "../lib/cycleSystems";
import { synthesizeZeitgeist } from "../lib/synthesisFromSnapshot";

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
  const zeitgeist = useMemo(
    () => synthesizeZeitgeist(snapshot, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, snapshot],
  );

  return (
    <section className="cp-moment cp-moment-zeitgeist flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-10 pb-28">
      <motion.div
        key={minuteKey}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-lg text-center"
      >
        <p className="cp-moment-eyebrow">Zeitgeist</p>
        <p className="cp-moment-time">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {" · "}
          {snapshot.westernZodiac.symbol} {snapshot.westernZodiac.sign}
          {" · "}
          {snapshot.tzolkin.sign} Kin {snapshot.tzolkin.kin}
        </p>

        <blockquote className="cp-moment-phrase">
          {zeitgeist}
        </blockquote>

        <div className="cp-moment-glyphs" aria-hidden>
          <span>{snapshot.lunar.emoji}</span>
          <span>{snapshot.chineseZodiac.symbol}</span>
          <span>{snapshot.season.emoji}</span>
          <span>🧭</span>
        </div>

        {!hasLocation && onRequestLocation && (
          <button type="button" onClick={onRequestLocation} className="cp-btn cp-btn-sm mt-10">
            Add local weather to the reading
          </button>
        )}
      </motion.div>
    </section>
  );
}
