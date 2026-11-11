"use client";

/**
 * "When" — the temple's one time control, the same in the Heliodrome, the Orrery and the
 * Earth view. Shows Live or the held moment; tap it to pick a date and hour (time holds
 * there everywhere); Now runs live again.
 */

import { useEffect, useRef, useState } from "react";
import { usePneumaClock } from "../../hooks/usePneumaClock";
import {
  clockLabel,
  clockMs,
  fromLocalInputValue,
  fromYearInput,
  goLive,
  holdAt,
  toLocalInputValue,
} from "../../lib/cosmic/pneumaClock";

export function PneumaWhen({
  by,
  chipClass = "onyx-orr-chip",
  onPicked,
  onLive,
  showNow = true,
}: {
  /** False where the chamber already has its own Now button. */
  showNow?: boolean;
  /** Which chamber is speaking, e.g. "heliodrome". */
  by: string;
  /** The chamber's own chip class, so the control matches its row. */
  chipClass?: string;
  /** Called after a date is picked (ms since 1970), for views that keep their own copy. */
  onPicked?: (ms: number) => void;
  /** Called after Now, for views that keep their own copy. */
  onLive?: () => void;
}) {
  const clock = usePneumaClock();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  // The date picker stops at year 1; the Year box reaches thousands of years back ("12000 BCE").
  const [yearDraft, setYearDraft] = useState("");
  const [yearBad, setYearBad] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  /** Returns false when the Year box cannot be read (the box then says so). */
  const apply = (v: string): boolean => {
    const typed = yearDraft.trim();
    const ms = typed ? fromYearInput(typed, fromLocalInputValue(v)) : fromLocalInputValue(v);
    if (!Number.isFinite(ms)) {
      if (typed) setYearBad(true);
      return false;
    }
    holdAt(ms, by);
    onPicked?.(ms);
    return true;
  };

  const live = clock.mode === "live";
  return (
    <span className="onyx-when" data-testid="pneuma-when" data-mode={clock.mode}>
      <button
        type="button"
        className={`${chipClass}${live ? "" : " on"}`}
        aria-expanded={open}
        aria-label={live ? "Time is live. Choose a date" : `Time held at ${clockLabel(clock)}. Choose a date`}
        title="Choose a date and hour. Time holds there in every chamber."
        onClick={() => {
          if (!open) {
            setDraft(toLocalInputValue(clockMs()));
            setYearDraft("");
            setYearBad(false);
          }
          setOpen(!open);
        }}
      >
        {live ? "Live" : clockLabel(clock)}
      </button>
      {!live && showNow ? (
        <button
          type="button"
          className={`${chipClass} ghost`}
          onClick={() => {
            goLive(by);
            setOpen(false);
            onLive?.();
          }}
        >
          Now
        </button>
      ) : null}
      {open ? (
        <span className="onyx-when-pick">
          <input
            ref={inputRef}
            type="datetime-local"
            className="onyx-when-input"
            aria-label="Date and hour to hold time at"
            min="0001-01-01T00:00"
            max="9999-12-31T23:59"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (apply(draft)) setOpen(false);
              } else if (e.key === "Escape") setOpen(false);
            }}
          />
          <input
            type="text"
            inputMode="text"
            className="onyx-when-input onyx-when-year"
            aria-label="Or a year, for example 12000 BCE"
            aria-invalid={yearBad || undefined}
            placeholder="or year: 12000 BCE"
            value={yearDraft}
            onChange={e => {
              setYearDraft(e.target.value);
              setYearBad(false);
            }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                if (apply(draft)) setOpen(false);
              } else if (e.key === "Escape") setOpen(false);
            }}
          />
          <button
            type="button"
            className={chipClass}
            onClick={() => {
              if (apply(draft)) setOpen(false);
            }}
          >
            Hold here
          </button>
        </span>
      ) : null}
    </span>
  );
}
