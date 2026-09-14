"use client";

/**
 * Post-save natal declaration — what Psyche is holding after birth is saved.
 * Simple visual window: the coherent phrase, then With now / Yours alone /
 * Moment alone, then the Heliodrome + calendar voices that feed those qualities.
 */

import {
  decompose,
  poleWord,
  type Composition,
} from "../../lib/lore/compose";
import type { NatalCycleRow } from "../../lib/lore/resolvePerson";
import type { QualiaEntry } from "../../lib/lore/qualia";

function systemTitle(id: string): string {
  return id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export type BirthDeclareCompare = {
  shared: string[];
  onlyYou: string[];
  onlyNow: string[];
};

export function OnyxBirthDeclareSheet({
  phrase,
  colorLine,
  placeLabel,
  timeIsApproximate,
  cycles,
  calendars,
  chord,
  compare,
  onClose,
}: {
  phrase: string;
  colorLine?: string | null;
  placeLabel?: string | null;
  timeIsApproximate?: boolean;
  cycles: NatalCycleRow[];
  calendars: [string, QualiaEntry[]][];
  chord: Composition;
  compare: BirthDeclareCompare | null;
  onClose: () => void;
}) {
  const voices = decompose(chord).slice(0, 8);
  const rootAxes = chord.axes
    .filter(a => Math.abs(a.mean) > 0.28)
    .sort((a, b) => Math.abs(b.mean) * b.coherence - Math.abs(a.mean) * a.coherence)
    .slice(0, 4);
  const clockRows = cycles.slice(0, 6);
  const calendarRows = calendars.slice(0, 6);

  return (
    <div
      className="onyx-share-scrim onyx-declare-scrim"
      role="presentation"
      onPointerDown={e => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="onyx-share-sheet onyx-declare-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="What your birth declares"
        onPointerDown={e => e.stopPropagation()}
      >
        <p className="onyx-share-kicker">Declared on this device</p>
        <p className="onyx-declare-lead">
          Heliodrome, calendars, and zodiacs at your birth — read as qualities, then spoken as one
          coherent picture of that natal moment. Compared with the sky clock <em>now</em>.
        </p>

        <p className="onyx-declare-phrase">{phrase}</p>
        {colorLine && <p className="onyx-declare-meta">{colorLine}</p>}
        {placeLabel && <p className="onyx-declare-meta">Born under · {placeLabel}</p>}
        {timeIsApproximate && (
          <p className="onyx-declare-meta">Hour unknown — noon used for rising-sensitive math.</p>
        )}

        {rootAxes.length > 0 && (
          <div className="onyx-declare-poles">
            <p className="onyx-share-kicker onyx-distill-kicker-2">The picture leans</p>
            <div className="onyx-declare-pole-row">
              {rootAxes.map(a => {
                const word = poleWord(a.axis, a.mean) || a.axis;
                return (
                  <span key={a.axis} className="onyx-declare-pole">
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {compare && (
          <div className="onyx-declare-bands">
            <p className="onyx-share-kicker onyx-distill-kicker-2">With now</p>
            <p className="onyx-declare-band-why">
              Qualities that sound in both your natal chord and this living moment.
            </p>
            <DeclareBand
              label="Resonates"
              feel="shared weather"
              items={compare.shared}
              tone="shared"
            />
            <DeclareBand
              label="Yours alone"
              feel="natal only"
              items={compare.onlyYou}
              tone="you"
            />
            <DeclareBand
              label="Moment alone"
              feel="sky clock only"
              items={compare.onlyNow}
              tone="now"
            />
          </div>
        )}

        {voices.length > 0 && (
          <div className="onyx-declare-voices">
            <p className="onyx-share-kicker onyx-distill-kicker-2">Why these qualities</p>
            <p className="onyx-declare-band-why">
              Each voice is a calendar, zodiac, or birth cycle — its qualities feed the chord.
            </p>
            <ul className="onyx-phrase-why-voices onyx-declare-voice-list">
              {voices.map(({ entry, contributes }) => (
                <li key={entry.id}>
                  <b>{entry.name}</b>
                  <span>
                    {systemTitle(entry.system)}
                    {contributes.length ? ` · ${contributes.slice(0, 4).join(" · ")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {clockRows.length > 0 && (
          <div className="onyx-declare-clock">
            <p className="onyx-share-kicker onyx-distill-kicker-2">Birth clock · Heliodrome</p>
            <p className="onyx-declare-band-why">
              The stacked lanes frozen at your birthday — the same instrument as Heliodrome, held at
              then.
            </p>
            <ul className="onyx-phrase-why-voices onyx-declare-voice-list">
              {clockRows.map(row => (
                <li key={row.id}>
                  <b>{row.label}</b>
                  <span>{row.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {calendarRows.length > 0 && (
          <div className="onyx-declare-cals">
            <p className="onyx-share-kicker onyx-distill-kicker-2">Calendars · zodiacs</p>
            <ul className="onyx-phrase-why-voices onyx-declare-voice-list">
              {calendarRows.map(([system, entries]) => (
                <li key={system}>
                  <b>{entries.map(e => e.name).join(" · ")}</b>
                  <span>{systemTitle(system)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className="onyx-share-cancel" onClick={onClose}>
          Keep looking
        </button>
      </div>
    </div>
  );
}

function DeclareBand({
  label,
  feel,
  items,
  tone,
}: {
  label: string;
  feel: string;
  items: string[];
  tone: "shared" | "you" | "now";
}) {
  if (items.length === 0) {
    return (
      <div className={`onyx-declare-band tone-${tone} empty`}>
        <div className="onyx-declare-band-head">
          <span className="onyx-declare-band-label">{label}</span>
          <span className="onyx-declare-band-feel">{feel}</span>
        </div>
        <p className="onyx-declare-empty">None right now</p>
      </div>
    );
  }
  return (
    <div className={`onyx-declare-band tone-${tone}`}>
      <div className="onyx-declare-band-head">
        <span className="onyx-declare-band-label">{label}</span>
        <span className="onyx-declare-band-feel">{feel}</span>
      </div>
      <div className="onyx-declare-chips">
        {items.slice(0, 10).map(q => (
          <span key={`${tone}-${q}`} className="onyx-you-chip">
            {q}
          </span>
        ))}
      </div>
    </div>
  );
}
