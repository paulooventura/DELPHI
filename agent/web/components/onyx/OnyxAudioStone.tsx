"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pulseHaptic } from "../../lib/haptics";

const REST = 3;
const QUIET = 37;
const TAP_SLOP = 8;

/** Top-right hex stone: tap or slide to mute cycle sonics + pulse. */
export function OnyxAudioStone({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange?: (on: boolean) => void;
}) {
  const [stoneX, setStoneX] = useState(enabled ? REST : QUIET);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);
  const originX = useRef(0);
  const stoneXRef = useRef(enabled ? REST : QUIET);
  const enabledRef = useRef(enabled);
  const onChangeRef = useRef(onEnabledChange);
  onChangeRef.current = onEnabledChange;

  useEffect(() => {
    if (dragging.current) return;
    enabledRef.current = enabled;
    const x = enabled ? REST : QUIET;
    stoneXRef.current = x;
    setStoneX(x);
  }, [enabled]);

  const commit = useCallback((on: boolean, announce: boolean) => {
    enabledRef.current = on;
    const x = on ? REST : QUIET;
    stoneXRef.current = x;
    setStoneX(x);
    onChangeRef.current?.(on);
    if (announce && on) void pulseHaptic("tick");
  }, []);

  const applyStone = useCallback((x: number) => {
    const clamped = Math.max(REST, Math.min(QUIET, x));
    stoneXRef.current = clamped;
    setStoneX(clamped);
    const on = !(clamped > (REST + QUIET) / 2);
    if (on !== enabledRef.current) {
      enabledRef.current = on;
      onChangeRef.current?.(on);
      if (on) void pulseHaptic("tick");
    }
  }, []);

  const endStone = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (!moved.current) commit(!enabledRef.current, true);
    else commit(enabledRef.current, false);
  }, [commit]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      if (Math.abs(e.clientX - originX.current) < TAP_SLOP) return;
      moved.current = true;
      applyStone(e.clientX - startX.current);
    };
    const up = () => endStone();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [applyStone, endStone]);

  const quiet = stoneX > (REST + QUIET) / 2;

  return (
    <div
      className={`onyx-stone-track${quiet ? " quiet" : ""}`}
      role="switch"
      aria-checked={!quiet}
      aria-label="Slide the stone to quiet sound and pulse"
      tabIndex={0}
      onPointerDown={e => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        moved.current = false;
        originX.current = e.clientX;
        startX.current = e.clientX - stoneXRef.current;
      }}
      onPointerMove={e => {
        if (!dragging.current) return;
        if (Math.abs(e.clientX - originX.current) < TAP_SLOP) return;
        moved.current = true;
        applyStone(e.clientX - startX.current);
      }}
      onPointerUp={e => {
        e.stopPropagation();
        endStone();
      }}
      onPointerCancel={endStone}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          commit(!enabledRef.current, true);
        }
      }}
    >
      <span className="onyx-groove-on" />
      <span className="onyx-groove-off" />
      <span
        className="onyx-stone"
        style={{ left: stoneX, transition: dragging.current ? "none" : undefined }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <polygon
            points="9,1 15,4.5 15,13.5 9,17 3,13.5 3,4.5"
            fill="#0b0a12"
            stroke="var(--onyx-edge-bright)"
            strokeWidth="0.6"
          />
          <polygon
            points="9,4 12.5,6 12.5,12 9,14 5.5,12 5.5,6"
            fill="none"
            stroke="rgba(140,124,255,0.3)"
            strokeWidth="0.4"
          />
          <circle cx="9" cy="9" r="1.6" fill="var(--onyx-core)" fillOpacity={0.75} />
        </svg>
      </span>
    </div>
  );
}
