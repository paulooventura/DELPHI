"use client";

/**
 * Vivid cast gestures — bag (runes), coins (I Ching), deck glide (tarot).
 * Draw resolves at the commit of the gesture; film afterward is theater.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { castBuzz, stopCastBuzz } from "../../lib/cast/castHaptics";
import {
  motionSupported,
  requestMotionPermission,
  watchMotion,
} from "../../lib/deviceSensors";
import {
  drawIndex,
  RUNE_SPREADS,
  TAROT_SPREADS,
  type RuneSpreadId,
  type TarotSpreadId,
} from "../../lib/lore/cast";

type Pt = { x: number; y: number; t: number };

function energyClamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function useDeviceShake(onShake: (intensity: number) => void, active: boolean) {
  const cb = useRef(onShake);
  cb.current = onShake;
  useEffect(() => {
    if (!active || !motionSupported()) return;
    let stop: (() => void) | null = null;
    let last = 0;
    let cancelled = false;
    void requestMotionPermission().then(ok => {
      if (!ok || cancelled) return;
      stop = watchMotion(r => {
        const x = r.accel?.x ?? r.accelG?.x;
        const y = r.accel?.y ?? r.accelG?.y;
        const z = r.accel?.z ?? r.accelG?.z;
        if (x == null || y == null || z == null) return;
        const mag = Math.sqrt(x * x + y * y + z * z);
        const spike = r.accel?.x != null ? mag : Math.abs(mag - 9.8);
        const now = performance.now();
        if (spike > 2.8 && now - last > 90) {
          last = now;
          cb.current(Math.min(1, spike / 12));
        }
      });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [active]);
}

/* ─── Runes: bag ─────────────────────────────────────────────────────────── */

export function RuneBagStage({
  spreadId,
  question,
  committing,
  onQuestion,
  onCommit,
  onBack,
}: {
  spreadId: RuneSpreadId;
  question: string;
  committing: boolean;
  onQuestion: (q: string) => void;
  onCommit: () => void;
  onBack: () => void;
}) {
  const spread = RUNE_SPREADS.find(s => s.id === spreadId);
  const [energy, setEnergy] = useState(0);
  const [mode, setMode] = useState<"idle" | "rub" | "shake" | "pull">("idle");
  const [offset, setOffset] = useState({ x: 0, y: 0, rot: 0 });
  const ptr = useRef<Pt | null>(null);
  const last = useRef<Pt | null>(null);
  const committed = useRef(false);
  const energyRef = useRef(0);

  const bump = (n: number) => {
    energyRef.current = energyClamp(energyRef.current + n);
    setEnergy(energyRef.current);
  };

  const commit = () => {
    if (committed.current || committing) return;
    committed.current = true;
    setMode("pull");
    castBuzz("draw");
    onCommit();
  };

  useDeviceShake(intensity => {
    if (committing || committed.current) return;
    setMode("shake");
    castBuzz("shake");
    bump(10 + intensity * 18);
    setOffset({
      x: (Math.random() - 0.5) * 14 * intensity,
      y: (Math.random() - 0.5) * 10 * intensity,
      rot: (Math.random() - 0.5) * 10 * intensity,
    });
    if (energyRef.current >= 88) commit();
  }, !committing);

  useEffect(() => () => stopCastBuzz(), []);

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (committing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = { x: e.clientX, y: e.clientY, t: performance.now() };
    ptr.current = p;
    last.current = p;
    castBuzz("tap");
    bump(6);
    setMode("rub");
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!ptr.current || committing) return;
    const now = { x: e.clientX, y: e.clientY, t: performance.now() };
    const prev = last.current ?? ptr.current;
    const dx = now.x - prev.x;
    const dy = now.y - prev.y;
    const dist = Math.hypot(dx, dy);
    const dt = Math.max(1, now.t - prev.t);
    const speed = dist / dt;
    last.current = now;

    const fromStartY = now.y - ptr.current.y;
    setOffset({
      x: Math.max(-18, Math.min(18, now.x - ptr.current.x) * 0.35),
      y: Math.max(-14, Math.min(22, fromStartY * 0.25)),
      rot: Math.max(-12, Math.min(12, (now.x - ptr.current.x) * 0.08)),
    });

    if (dist > 2) {
      // Lateral churn = shake; circular/slow = rub
      if (speed > 0.55 && Math.abs(dx) > Math.abs(dy) * 0.7) {
        setMode("shake");
        castBuzz("shake");
        bump(2.2 + speed * 4);
      } else {
        setMode("rub");
        castBuzz("rub");
        bump(1.2 + Math.min(3, dist * 0.08));
      }
    }

    // Pull up out of the bag once stirred
    if (fromStartY < -72 && energyRef.current >= 28) {
      commit();
    } else if (energyRef.current >= 100) {
      commit();
    }
  }

  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!ptr.current || committing) return;
    const dy = e.clientY - ptr.current.y;
    const elapsed = performance.now() - ptr.current.t;
    ptr.current = null;
    last.current = null;
    setOffset({ x: 0, y: 0, rot: 0 });
    setMode("idle");
    // Quick tap after some stir → draw; long rub already may have committed
    if (elapsed < 220 && energyRef.current >= 18) {
      bump(12);
      castBuzz("tap");
      if (energyRef.current >= 40) commit();
    } else if (dy < -48 && energyRef.current >= 22) {
      commit();
    }
  }

  const pullLabel =
    spreadId === "norns" ? "Pull three from the bag" : "Pull a stave from the bag";

  return (
    <div className="onyx-cast-spreads onyx-rune-bag">
      <p className="onyx-eyebrow">THE BAG</p>
      <p className="onyx-layer-meta">
        {spread?.label ?? "From the bag"} — hold a question, then shake, tap, or rub the pouch.
      </p>

      <label className="onyx-rune-question-label" htmlFor="onyx-rune-question">
        Your question
      </label>
      <textarea
        id="onyx-rune-question"
        className="onyx-rune-question"
        rows={3}
        maxLength={280}
        placeholder="What do you want the staves to speak to?"
        value={question}
        disabled={committing}
        onChange={e => onQuestion(e.target.value)}
      />

      <div
        className={`onyx-gesture-surface onyx-bag-surface${committing ? " committing" : ""} mode-${mode}`}
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${offset.rot}deg)`,
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="button"
        tabIndex={0}
        aria-label={pullLabel}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            bump(40);
            commit();
          }
        }}
      >
        <span className="onyx-bag-glyph" aria-hidden>
          <svg viewBox="0 0 120 140" width="120" height="140">
            <defs>
              <linearGradient id="bagFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3a2a1a" />
                <stop offset="55%" stopColor="#1a120c" />
                <stop offset="100%" stopColor="#0c0806" />
              </linearGradient>
            </defs>
            <path
              d="M28 48c0-18 14-32 32-32s32 14 32 32v8c12 6 18 18 18 32v14c0 16-14 28-50 28S10 118 10 102V88c0-14 6-26 18-32v-8z"
              fill="url(#bagFill)"
              stroke="rgba(196,174,128,0.45)"
              strokeWidth="1.5"
            />
            <path
              d="M42 40h36c3 0 5 2 5 5v6H37v-6c0-3 2-5 5-5z"
              fill="none"
              stroke="rgba(210,190,150,0.55)"
              strokeWidth="2"
            />
            <ellipse cx="60" cy="86" rx="22" ry="10" fill="rgba(196,174,128,0.06)" />
            <path
              d="M48 72l6 10 8-14 7 12"
              fill="none"
              stroke="rgba(196,174,128,0.22)"
              strokeWidth="1.2"
            />
          </svg>
        </span>
        <span className="onyx-gesture-cta">
          {committing
            ? "Drawing…"
            : mode === "shake"
              ? "Shaking the staves…"
              : mode === "rub"
                ? "Feeling for a stave…"
                : "Shake · tap · rub"}
        </span>
        <span className="onyx-gesture-sub">
          {spreadId === "norns"
            ? "Stir, then pull three upward"
            : "Stir, then pull one upward"}
        </span>
        <div className="onyx-energy" aria-hidden>
          <div className="onyx-energy-fill" style={{ width: `${energy}%` }} />
        </div>
      </div>

      <button
        type="button"
        className="onyx-ghost-btn"
        style={{ marginTop: 12 }}
        disabled={committing || energy < 25}
        onClick={() => {
          bump(40);
          commit();
        }}
      >
        {energy < 25 ? "Stir the bag first" : pullLabel}
      </button>

      <button
        type="button"
        className="onyx-ghost-btn"
        style={{ marginTop: 8 }}
        onClick={onBack}
        disabled={committing}
      >
        Back
      </button>
    </div>
  );
}

/* ─── I Ching: coins ─────────────────────────────────────────────────────── */

export function CoinTossStage({
  committing,
  onCommit,
  onBack,
}: {
  committing: boolean;
  onCommit: () => void;
  onBack: () => void;
}) {
  const [energy, setEnergy] = useState(0);
  const [phase, setPhase] = useState<"cup" | "shake" | "flight" | "settle">("cup");
  const [faces, setFaces] = useState<[boolean, boolean, boolean]>([true, false, true]);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const ptr = useRef<Pt | null>(null);
  const last = useRef<Pt | null>(null);
  const energyRef = useRef(0);
  const committed = useRef(false);

  const bump = (n: number) => {
    energyRef.current = energyClamp(energyRef.current + n);
    setEnergy(energyRef.current);
  };

  const toss = () => {
    if (committed.current || committing) return;
    if (energyRef.current < 20) {
      castBuzz("tap");
      return;
    }
    committed.current = true;
    setPhase("flight");
    castBuzz("toss");
    // Theater faces — real lines resolve in cast engine at onCommit
    window.setTimeout(() => {
      setFaces([drawIndex(2) === 1, drawIndex(2) === 1, drawIndex(2) === 1]);
      setPhase("settle");
      castBuzz("settle");
      onCommit();
    }, 780);
  };

  useDeviceShake(intensity => {
    if (committing || committed.current) return;
    setPhase("shake");
    castBuzz("shake");
    bump(12 + intensity * 20);
    setTilt({
      x: (Math.random() - 0.5) * 16,
      y: (Math.random() - 0.5) * 12,
    });
    if (energyRef.current >= 85) toss();
  }, !committing);

  useEffect(() => () => stopCastBuzz(), []);

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (committing || committed.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = { x: e.clientX, y: e.clientY, t: performance.now() };
    ptr.current = p;
    last.current = p;
    setPhase("shake");
    castBuzz("tap");
    bump(5);
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!ptr.current || committing || committed.current) return;
    const now = { x: e.clientX, y: e.clientY, t: performance.now() };
    const prev = last.current ?? ptr.current;
    const dx = now.x - prev.x;
    const dy = now.y - prev.y;
    const dist = Math.hypot(dx, dy);
    last.current = now;
    setTilt({
      x: Math.max(-22, Math.min(22, (now.x - ptr.current.x) * 0.4)),
      y: Math.max(-18, Math.min(18, (now.y - ptr.current.y) * 0.3)),
    });
    if (dist > 3) {
      castBuzz("shake");
      bump(1.8 + dist * 0.06);
      setFaces(f => [!f[0], f[1], !f[2]]);
    }
    // Toss: fling upward
    if (now.y - ptr.current.y < -80 && energyRef.current >= 25) {
      toss();
    } else if (energyRef.current >= 100) {
      toss();
    }
  }

  function onUp() {
    if (!ptr.current || committing || committed.current) return;
    const dy = (last.current?.y ?? ptr.current.y) - ptr.current.y;
    ptr.current = null;
    last.current = null;
    setTilt({ x: 0, y: 0 });
    if (dy < -40 && energyRef.current >= 22) toss();
    else if (energyRef.current >= 55) toss();
    else setPhase("cup");
  }

  return (
    <div className="onyx-cast-spreads onyx-coin-stage">
      <p className="onyx-eyebrow">THREE COINS</p>
      <p className="onyx-layer-meta">
        Shake the coins in your hand, then toss — six lines build from the ground up.
      </p>

      <div
        className={`onyx-gesture-surface onyx-coin-surface phase-${phase}${committing ? " committing" : ""}`}
        style={{
          transform: `translate3d(${tilt.x}px, ${tilt.y}px, 0) rotate(${tilt.x * 0.4}deg)`,
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="button"
        tabIndex={0}
        aria-label="Shake and toss the three coins"
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            bump(50);
            toss();
          }
        }}
      >
        <div className="onyx-coins" aria-hidden>
          {faces.map((heads, i) => (
            <span
              key={i}
              className={`onyx-coin${heads ? " heads" : " tails"}${phase === "flight" ? " flying" : ""}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="onyx-coin-face">{heads ? "陽" : "陰"}</span>
            </span>
          ))}
        </div>
        <span className="onyx-gesture-cta">
          {phase === "flight"
            ? "In the air…"
            : phase === "settle" || committing
              ? "Reading the lines…"
              : phase === "shake"
                ? "Rattling…"
                : "Hold · shake · toss up"}
        </span>
        <span className="onyx-gesture-sub">Three coins · six throws resolved at the toss</span>
        <div className="onyx-energy" aria-hidden>
          <div className="onyx-energy-fill" style={{ width: `${energy}%` }} />
        </div>
      </div>

      <button
        type="button"
        className="onyx-ghost-btn"
        style={{ marginTop: 12 }}
        disabled={committing || energy < 20}
        onClick={() => {
          bump(40);
          toss();
        }}
      >
        {energy < 20 ? "Shake the coins first" : "Toss the coins"}
      </button>

      <button
        type="button"
        className="onyx-ghost-btn"
        style={{ marginTop: 8 }}
        onClick={onBack}
        disabled={committing}
      >
        Back
      </button>
    </div>
  );
}

/* ─── Tarot: finger on the deck ──────────────────────────────────────────── */

export function TarotDeckStage({
  spreadId,
  committing,
  onCommit,
  onBack,
}: {
  spreadId: TarotSpreadId;
  committing: boolean;
  onCommit: () => void;
  onBack: () => void;
}) {
  const spread = TAROT_SPREADS.find(s => s.id === spreadId);
  const [energy, setEnergy] = useState(0);
  const [glide, setGlide] = useState(0); // 0..1 along deck edge
  const [fan, setFan] = useState(0);
  const ptr = useRef<Pt | null>(null);
  const energyRef = useRef(0);
  const distanceRef = useRef(0);
  const committed = useRef(false);

  const bump = (n: number) => {
    energyRef.current = energyClamp(energyRef.current + n);
    setEnergy(energyRef.current);
  };

  const draw = () => {
    if (committed.current || committing) return;
    committed.current = true;
    castBuzz("draw");
    setFan(1);
    onCommit();
  };

  useEffect(() => () => stopCastBuzz(), []);

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (committing || committed.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    ptr.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    castBuzz("tap");
    bump(4);
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!ptr.current || committing || committed.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setGlide(rel);
    setFan(0.15 + rel * 0.35);

    const prev = ptr.current;
    const dist = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    if (dist > 2) {
      distanceRef.current += dist;
      // Finger along the cut — light, rapid ticks
      castBuzz("card");
      bump(0.9 + Math.min(2.5, dist * 0.05));
      ptr.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    }

    // Pull a card: swipe down off the deck after enough glide
    const dy = e.clientY - (rect.top + rect.height * 0.35);
    if (dy > 70 && energyRef.current >= 30 && distanceRef.current > 120) {
      draw();
    } else if (energyRef.current >= 100) {
      draw();
    }
  }

  function onUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!ptr.current || committing || committed.current) return;
    const dy = e.clientY - ptr.current.y;
    ptr.current = null;
    if (dy > 55 && energyRef.current >= 28) draw();
    else if (energyRef.current >= 70 && distanceRef.current > 180) draw();
  }

  return (
    <div className="onyx-cast-spreads onyx-deck-stage">
      <p className="onyx-eyebrow">THE DECK</p>
      <p className="onyx-layer-meta">
        {spread?.label ?? "Spread"} — run your finger along the edge until a card wants to leave.
      </p>

      <div
        className={`onyx-gesture-surface onyx-deck-surface${committing ? " committing" : ""}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="button"
        tabIndex={0}
        aria-label="Run your finger along the deck, then draw"
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            bump(50);
            draw();
          }
        }}
      >
        <div className="onyx-deck" aria-hidden style={{ ["--fan" as string]: fan, ["--glide" as string]: glide }}>
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              className="onyx-deck-card"
              style={{
                transform: `translate(${(i - 3) * (4 + fan * 10)}px, ${Math.abs(i - 3) * 1.2}px) rotate(${(i - 3) * (1.2 + fan * 4)}deg)`,
                zIndex: i === Math.round(glide * 6) ? 8 : i,
              }}
            />
          ))}
          <span
            className="onyx-deck-finger"
            style={{ left: `${8 + glide * 84}%` }}
          />
        </div>
        <span className="onyx-gesture-cta">
          {committing ? "Drawing…" : "Slide along the deck"}
        </span>
        <span className="onyx-gesture-sub">Feel the cut · pull downward to take a card</span>
        <div className="onyx-energy" aria-hidden>
          <div className="onyx-energy-fill" style={{ width: `${energy}%` }} />
        </div>
      </div>

      <button
        type="button"
        className="onyx-ghost-btn"
        style={{ marginTop: 12 }}
        disabled={committing || energy < 25}
        onClick={() => {
          bump(40);
          draw();
        }}
      >
        {energy < 25 ? "Feel the deck first" : `Draw · ${spread?.label ?? "cards"}`}
      </button>

      <button
        type="button"
        className="onyx-ghost-btn"
        style={{ marginTop: 8 }}
        onClick={onBack}
        disabled={committing}
      >
        Back
      </button>
    </div>
  );
}
