"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { OnyxAudioStone } from "./OnyxAudioStone";

export type ChamberDoor = "home" | "sky" | "rings" | "you" | "tonal" | "studies" | "tools";

/** Which arm of the mini compass is lit. Matches the home gem: up Aether, right Heliodrome, down Agon, left Mouseion, centre Psyche. */
export type CompassLit = "up" | "right" | "down" | "left" | "centre" | null;

export type ChamberNav = {
  backLabel: string;
  onBack: () => void;
  onHome: () => void;
  onJump: (door: ChamberDoor) => void;
  lit: CompassLit;
  pulseEnabled: boolean;
  onPulseEnabledChange?: (on: boolean) => void;
};

export const ChamberNavContext = createContext<ChamberNav | null>(null);

const HOLD_HOME_MS = 550;

const DOORS: { door: ChamberDoor; name: string; note: string; arm: CompassLit }[] = [
  { door: "sky", name: "Aether", note: "The sky above you, live", arm: "up" },
  { door: "rings", name: "Heliodrome", note: "Every cycle, running now", arm: "right" },
  { door: "tonal", name: "Agon", note: "Show Thyself · events and crews", arm: "down" },
  { door: "studies", name: "Mouseion", note: "Studies and scales", arm: "left" },
  { door: "you", name: "Psyche", note: "Your chord and casts", arm: "centre" },
  { door: "tools", name: "Treasury ✦", note: "Atlas, Senses, About and more", arm: null },
];

function MiniCompass({ lit }: { lit: CompassLit }) {
  const arm = (which: CompassLit) => (lit === which ? "var(--onyx-ink-bright)" : "var(--onyx-ink-faint)");
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <path d="M15 2.5 L15 7.5" stroke={arm("up")} strokeWidth={lit === "up" ? 1.6 : 0.8} strokeLinecap="round" />
      <path d="M27.5 15 L22.5 15" stroke={arm("right")} strokeWidth={lit === "right" ? 1.6 : 0.8} strokeLinecap="round" />
      <path d="M15 27.5 L15 22.5" stroke={arm("down")} strokeWidth={lit === "down" ? 1.6 : 0.8} strokeLinecap="round" />
      <path d="M2.5 15 L7.5 15" stroke={arm("left")} strokeWidth={lit === "left" ? 1.6 : 0.8} strokeLinecap="round" />
      <circle cx="15" cy="15" r="6.2" fill="#f2eefc" stroke="var(--onyx-edge-bright)" strokeWidth="0.5" />
      <path d="M15 8.8 A6.2 6.2 0 0 1 15 21.2 A3.1 3.1 0 0 1 15 15 A3.1 3.1 0 0 0 15 8.8 Z" fill="#0b0a12" />
      <circle cx="15" cy="11.9" r="0.9" fill="#0b0a12" />
      <circle cx="15" cy="18.1" r="0.9" fill="#f2eefc" />
      {lit === "centre" && <circle cx="15" cy="15" r="8.4" stroke="var(--onyx-ink-bright)" strokeWidth="0.9" />}
    </svg>
  );
}

/** Shared top bar for every screen except home: back (named for where it goes) · name · mini compass · stone switch. */
export function ChamberHeader({
  title,
  sub,
  onBack,
}: {
  title: string;
  sub?: string;
  /** Screens with an exit animation run it first, then call the real back. */
  onBack?: () => void;
}) {
  const nav = useContext(ChamberNavContext);
  const [sheetOpen, setSheetOpen] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const heldHome = useRef(false);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [sheetOpen]);

  useEffect(() => () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
  }, []);

  if (!nav) return null;

  const clearHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  return (
    <>
      <header className="onyx-chamber">
        <button type="button" className="onyx-chamber-back" onClick={onBack ?? nav.onBack}>
          ‹ {nav.backLabel}
        </button>
        <p className="onyx-chamber-name">
          {title}
          {sub && <span className="onyx-chamber-sub"> · {sub}</span>}
        </p>
        <div className="onyx-chamber-right">
          <button
            type="button"
            className="onyx-chamber-compass"
            aria-label="Compass — tap to jump to any chamber, hold for the Omphalos"
            onPointerDown={() => {
              heldHome.current = false;
              clearHold();
              holdTimer.current = window.setTimeout(() => {
                heldHome.current = true;
                nav.onHome();
              }, HOLD_HOME_MS);
            }}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onPointerCancel={clearHold}
            onContextMenu={e => e.preventDefault()}
            onClick={() => {
              if (heldHome.current) {
                heldHome.current = false;
                return;
              }
              setSheetOpen(true);
            }}
          >
            <MiniCompass lit={nav.lit} />
          </button>
          <OnyxAudioStone enabled={nav.pulseEnabled} onEnabledChange={nav.onPulseEnabledChange} />
        </div>
      </header>
      {sheetOpen && (
        <div className="onyx-compass-sheet-wrap" onClick={() => setSheetOpen(false)}>
          <div
            className="onyx-compass-sheet"
            role="dialog"
            aria-label="Jump to a chamber"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="onyx-compass-row is-home"
              onClick={() => {
                setSheetOpen(false);
                nav.onHome();
              }}
            >
              Omphalos
              <span>Home · the centre</span>
            </button>
            {DOORS.map(d => (
              <button
                key={d.door}
                type="button"
                className={`onyx-compass-row${d.arm && d.arm === nav.lit ? " is-here" : ""}`}
                onClick={() => {
                  setSheetOpen(false);
                  nav.onJump(d.door);
                }}
              >
                {d.name}
                <span>{d.note}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
