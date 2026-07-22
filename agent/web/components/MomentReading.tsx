"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { CycleSnapshot } from "../lib/cycleSystems";
import { formatCodeWords } from "../lib/galacticFrequency";
import { synthesizeZeitgeist } from "../lib/synthesisFromSnapshot";
import { NowStrip } from "./NowStrip";
import type { CycleReading } from "../lib/worldCycles";

export function MomentReading({
  snapshot,
  now,
  hasLocation,
  onRequestLocation,
  multiVoice,
  nowReadings,
}: {
  snapshot: CycleSnapshot;
  now: Date;
  hasLocation: boolean;
  onRequestLocation?: () => void;
  /** Atlas-enabled multi-voice paragraph from World Cycle registry. */
  multiVoice?: string;
  nowReadings?: CycleReading[];
}) {
  const minuteKey = Math.floor(now.getTime() / 60000);
  const zeitgeist = useMemo(
    () => synthesizeZeitgeist(snapshot, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minuteKey, snapshot],
  );

  const { galactic } = snapshot;
  const tribe = galactic.tribe;
  const tone = galactic.tone;

  return (
    <section className="cp-moment cp-moment-zeitgeist flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-10 pb-28">
      <motion.div
        key={minuteKey}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-lg text-center"
      >
        <p className="cp-moment-eyebrow">Zeitgeist · World Cycles</p>
        <p className="cp-moment-time">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {" · "}
          {snapshot.westernZodiac.symbol} {snapshot.westernZodiac.sign}
          {" · "}
          Kin {galactic.kin}
        </p>

        {nowReadings && nowReadings.length > 0 && (
          <div className="cp-moment-nowstrip mt-4 text-left">
            <NowStrip readings={nowReadings} />
          </div>
        )}

        <p className="cp-moment-galactic-kin mt-3 text-sm tracking-wide text-violet-200/90">
          Tone {tone.tone} {tone.name} · {tribe.color} {tribe.name}
          <span className="mx-1 opacity-50">·</span>
          {tribe.mayaSign}
        </p>

        {multiVoice && (
          <blockquote className="cp-moment-phrase cp-moment-multivoice">
            {multiVoice}
          </blockquote>
        )}

        <blockquote className={`cp-moment-phrase${multiVoice ? " cp-moment-phrase-secondary" : ""}`}>
          {zeitgeist}
        </blockquote>

        <div className="cp-moment-codes mt-6 grid gap-3 text-left text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-violet-400/20 bg-violet-950/40 px-3 py-2.5">
            <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-violet-300/70">Tone — power · action · essence</p>
            <p className="font-medium text-violet-100">{formatCodeWords(tone.code)}</p>
          </div>
          <div className="rounded-lg border border-amber-400/20 bg-amber-950/30 px-3 py-2.5">
            <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-amber-300/70">Tribe — power · action · essence</p>
            <p className="font-medium text-amber-100">{formatCodeWords(tribe.code)}</p>
          </div>
        </div>

        <p className="cp-moment-affirm mt-5 text-sm italic text-white/70">{galactic.affirmation}</p>

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
