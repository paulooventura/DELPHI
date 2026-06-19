export type SkyHapticKind = "cardinal" | "horizon" | "zenith" | "targetLock";

const CARDINALS = [0, 90, 180, 270] as const;
const ENTER_DEG = 2.5;
const EXIT_DEG = 4.5;
const TARGET_ENTER = 2;
const TARGET_EXIT = 3.5;

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

  return {
    /** Call each frame with current view center (heading = az, pitch = alt). */
    update(headingDeg: number, pitchDeg: number, lockedBodyId: string | null) {
      const h = ((headingDeg % 360) + 360) % 360;
      const p = pitchDeg;

      for (const c of CARDINALS) {
        const d = Math.abs(((h - c + 540) % 360) - 180);
        const inside = d <= ENTER_DEG;
        const was = state.cardinal.has(c);
        if (inside && !was) {
          vibrate(12);
          state.cardinal.add(c);
        } else if (!inside && was && d > EXIT_DEG) {
          state.cardinal.delete(c);
        }
      }

      const nearHorizon = Math.abs(p) <= ENTER_DEG;
      if (nearHorizon && !state.horizon) {
        vibrate(18);
        state.horizon = true;
      } else if (!nearHorizon && state.horizon && Math.abs(p) > EXIT_DEG) {
        state.horizon = false;
      }

      const nearZenith = Math.abs(p - 90) <= ENTER_DEG;
      if (nearZenith && !state.zenith) {
        vibrate([20, 30, 20]);
        state.zenith = true;
      } else if (!nearZenith && state.zenith && Math.abs(p - 90) > EXIT_DEG) {
        state.zenith = false;
      }

      if (lockedBodyId) {
        if (state.target !== lockedBodyId) {
          vibrate([35, 40, 35]);
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
