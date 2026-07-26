"use client";

/**
 * Ambient pulse — visual beat + best-effort haptic.
 *
 * Product defaults: per-second tick OFF, minute bloom ON.
 * Slide the onyx stone to quiet both. navigator.vibrate is Android-browser
 * only; iOS Safari no-ops the buzz (visual + stone still work).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { pulseHaptic } from "../lib/haptics";
import "./ambientPulse.css";

const REST = 3;
const QUIET = 37;
const STORAGE_KEY = "cp-ambient-pulse-v1";

type PulsePrefs = {
  /** Master: stone at lit end = on. */
  enabled: boolean;
  /** Soft second tick — off by default. */
  secondTick: boolean;
};

function loadPrefs(): PulsePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: true, secondTick: false };
    const parsed = JSON.parse(raw) as Partial<PulsePrefs>;
    return {
      enabled: parsed.enabled !== false,
      secondTick: parsed.secondTick === true,
    };
  } catch {
    return { enabled: true, secondTick: false };
  }
}

export function AmbientPulse() {
  const [prefs, setPrefs] = useState<PulsePrefs>({ enabled: true, secondTick: false });
  const [anim, setAnim] = useState<"none" | "beat" | "chime">("none");
  const [stoneX, setStoneX] = useState(REST);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);
  const stoneXRef = useRef(REST);
  const lastSec = useRef(-1);
  const prefsRef = useRef(prefs);
  const pulseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = loadPrefs();
    setPrefs(p);
    prefsRef.current = p;
    const x = p.enabled ? REST : QUIET;
    setStoneX(x);
    stoneXRef.current = x;
  }, []);

  const persist = useCallback((next: PulsePrefs) => {
    prefsRef.current = next;
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* no-op */
    }
  }, []);

  const setStone = useCallback(
    (x: number, animate: boolean) => {
      const clamped = Math.max(REST, Math.min(QUIET, x));
      stoneXRef.current = clamped;
      setStoneX(clamped);
      const nowQuiet = clamped > (REST + QUIET) / 2;
      const enabled = !nowQuiet;
      if (enabled !== prefsRef.current.enabled) {
        const next = { ...prefsRef.current, enabled };
        persist(next);
        if (enabled) void pulseHaptic("tick");
      }
      if (!animate && pulseRef.current) {
        /* drag path — transition handled via style */
      }
    },
    [persist],
  );

  const settle = useCallback(() => {
    setStone(prefsRef.current.enabled ? REST : QUIET, true);
  }, [setStone]);

  const fire = useCallback((kind: "second" | "minute" | "tick") => {
    if (!prefsRef.current.enabled) return;
    if (kind === "second" && !prefsRef.current.secondTick) {
      /* visual second also gated — product default is off */
      return;
    }
    const el = pulseRef.current;
    if (el && (kind === "second" || kind === "minute")) {
      setAnim("none");
      requestAnimationFrame(() => {
        setAnim(kind === "minute" ? "chime" : "beat");
      });
    }
    if (kind === "second") void pulseHaptic("second");
    else if (kind === "minute") void pulseHaptic("minute");
    else void pulseHaptic("tick");
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = new Date();
      const s = now.getSeconds();
      if (s !== lastSec.current) {
        lastSec.current = s;
        if (s === 0) fire("minute");
        else fire("second");
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fire]);

  useEffect(() => {
    if (anim === "none") return;
    const t = window.setTimeout(() => setAnim("none"), anim === "chime" ? 2400 : 1000);
    return () => clearTimeout(t);
  }, [anim]);

  const onDown = (clientX: number) => {
    dragging.current = true;
    moved.current = false;
    startX.current = clientX - stoneXRef.current;
  };
  const onMove = (clientX: number) => {
    if (!dragging.current) return;
    moved.current = true;
    setStone(clientX - startX.current, false);
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (!moved.current) {
      setStone(prefs.enabled ? QUIET : REST, true);
    } else {
      settle();
    }
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      moved.current = true;
      const clamped = Math.max(REST, Math.min(QUIET, e.clientX - startX.current));
      stoneXRef.current = clamped;
      setStoneX(clamped);
      const nowQuiet = clamped > (REST + QUIET) / 2;
      const enabled = !nowQuiet;
      if (enabled !== prefsRef.current.enabled) {
        const next = { ...prefsRef.current, enabled };
        prefsRef.current = next;
        setPrefs(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* no-op */
        }
        if (enabled) void pulseHaptic("tick");
      }
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (!moved.current) {
        const flipTo = prefsRef.current.enabled ? QUIET : REST;
        stoneXRef.current = flipTo;
        setStoneX(flipTo);
        const next = { ...prefsRef.current, enabled: flipTo === REST };
        prefsRef.current = next;
        setPrefs(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* no-op */
        }
        if (next.enabled) void pulseHaptic("tick");
      } else {
        const settleX = prefsRef.current.enabled ? REST : QUIET;
        stoneXRef.current = settleX;
        setStoneX(settleX);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  const quiet = !prefs.enabled;

  return (
    <div className="cp-ambient-pulse" aria-hidden={false}>
      <div
        ref={pulseRef}
        className={`cp-pulse-ring${anim === "beat" ? " beat" : ""}${anim === "chime" ? " chime" : ""}`}
      />
      <div
        className={`cp-stone-track${quiet ? " quiet" : ""}`}
        role="switch"
        aria-checked={prefs.enabled}
        aria-label="Slide the stone to quiet the pulse"
        tabIndex={0}
        onMouseDown={e => onDown(e.clientX)}
        onTouchStart={e => onDown(e.touches[0].clientX)}
        onTouchMove={e => {
          onMove(e.touches[0].clientX);
          if (e.cancelable) e.preventDefault();
        }}
        onTouchEnd={onUp}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setStone(prefs.enabled ? QUIET : REST, true);
          }
        }}
      >
        <span className="cp-groove-on" />
        <span className="cp-groove-off" />
        <span
          className="cp-stone"
          style={{
            left: stoneX,
            transition: dragging.current ? "none" : "left var(--settle)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <defs>
              <radialGradient id="cp-stone-fill" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#2a2740" />
                <stop offset="55%" stopColor="#12111a" />
                <stop offset="100%" stopColor="#050508" />
              </radialGradient>
            </defs>
            <circle cx="9" cy="9" r="8" fill="url(#cp-stone-fill)" stroke="var(--edge)" strokeWidth="0.5" />
            <ellipse cx="7" cy="6.5" rx="3.2" ry="2" fill="rgba(169,156,255,0.22)" />
          </svg>
        </span>
      </div>
    </div>
  );
}
