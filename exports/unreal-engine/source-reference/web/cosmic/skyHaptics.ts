export type SkyHapticKind = "cardinal" | "horizon" | "zenith" | "targetLock";

const CARDINALS = [0, 90, 180, 270] as const;
const ENTER_DEG = 2.5;
const EXIT_DEG = 4.5;
const HORIZON_ENTER_DEG = 4;
const HORIZON_EXIT_DEG = 10;
const HAPTIC_COOLDOWN_MS = 420;
const TARGET_HAPTIC_COOLDOWN_MS = 280;
const TARGET_ENTER = 2;
const TARGET_EXIT = 3.5;
/** Gentle double-pulse when crosshairs settle on an object. */
const TARGET_LOCK_PATTERN = [6, 48, 10, 38, 8] as const;

type GateState = {
  cardinal: Set<number>;
  horizon: boolean;
  zenith: boolean;
  target: string | null;
};

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export function createSkyHapticController() {
  const state: GateState = {
    cardinal: new Set(),
    horizon: false,
    zenith: false,
    target: null,
  };
  let lastPulseMs = 0;
  let lastTargetPulseMs = 0;

  function pulse(pattern: number | number[], cooldownMs = HAPTIC_COOLDOWN_MS) {
    const now = performance.now();
    if (now - lastPulseMs < cooldownMs) return;
    lastPulseMs = now;
    vibrate(pattern);
  }

  return {
    /** Call each frame with current view center (heading = az, pitch = alt). */
    update(
      headingDeg: number,
      pitchDeg: number,
      lockedBodyId: string | null,
      opts?: { cardinalsEnabled?: boolean },
    ) {
      const cardinalsEnabled = opts?.cardinalsEnabled ?? true;
      const h = ((headingDeg % 360) + 360) % 360;
      const p = pitchDeg;

      if (cardinalsEnabled) {
        for (const c of CARDINALS) {
          const d = Math.abs(((h - c + 540) % 360) - 180);
          const inside = d <= ENTER_DEG;
          const was = state.cardinal.has(c);
          if (inside && !was) {
            pulse(10);
            state.cardinal.add(c);
          } else if (!inside && was && d > EXIT_DEG) {
            state.cardinal.delete(c);
          }
        }

        const nearHorizon = Math.abs(p) <= HORIZON_ENTER_DEG;
        if (nearHorizon && !state.horizon) {
          pulse(14);
          state.horizon = true;
        } else if (!nearHorizon && state.horizon && Math.abs(p) > HORIZON_EXIT_DEG) {
          state.horizon = false;
        }

        const nearZenith = Math.abs(p - 90) <= ENTER_DEG;
        if (nearZenith && !state.zenith) {
          pulse([14, 28, 14]);
          state.zenith = true;
        } else if (!nearZenith && state.zenith && Math.abs(p - 90) > EXIT_DEG) {
          state.zenith = false;
        }
      }

      if (lockedBodyId) {
        if (state.target !== lockedBodyId) {
          const now = performance.now();
          if (now - lastTargetPulseMs >= TARGET_HAPTIC_COOLDOWN_MS) {
            lastTargetPulseMs = now;
            lastPulseMs = now;
            vibrate([...TARGET_LOCK_PATTERN]);
          }
          state.target = lockedBodyId;
        }
      } else if (state.target != null) {
        state.target = null;
      }
    },

    findTargetLock(
      headingDeg: number,
      pitchDeg: number,
      bodies: Array<{ id: string; az: number; alt: number }>,
    ): string | null {
      let best: { id: string; sep: number } | null = null;
      for (const b of bodies) {
        const sep = angularSeparationFromCenter(headingDeg, pitchDeg, b.az, b.alt);
        if (sep <= TARGET_ENTER && (!best || sep < best.sep)) {
          best = { id: b.id, sep };
        }
      }
      if (best) return best.id;
      if (state.target) {
        const prev = bodies.find(b => b.id === state.target);
        if (prev) {
          const sep = angularSeparationFromCenter(headingDeg, pitchDeg, prev.az, prev.alt);
          if (sep <= TARGET_EXIT) return state.target;
        }
      }
      return null;
    },
  };
}

function angularSeparationFromCenter(
  headingDeg: number,
  pitchDeg: number,
  az: number,
  alt: number,
): number {
  const RAD = Math.PI / 180;
  const a1 = pitchDeg * RAD;
  const a2 = alt * RAD;
  const dAz = (az - headingDeg) * RAD;
  const cosD = Math.sin(a1) * Math.sin(a2) + Math.cos(a1) * Math.cos(a2) * Math.cos(dAz);
  return Math.acos(Math.max(-1, Math.min(1, cosD))) * (180 / Math.PI);
}
