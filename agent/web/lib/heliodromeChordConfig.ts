/**
 * Heliodrome NOW-Chord — Paulo-tunable constants (single source of truth).
 * Speed determines everything except pitch; pitch is locked to this chord.
 */

export const NOW_CHORD = {
  /** Starting root ~C2; Schumann-rooted harmony. */
  ROOT_HZ: 65.41,
  /** Scale degrees in semitones — Dorian-ish; edit live. */
  SCALE: [0, 2, 3, 5, 7, 9, 10] as readonly number[],
  SCHUMANN_HZ: 7.83,
  SCHUMANN_HARMONICS: [7.83, 14.3, 20.8, 27.3, 33.8] as readonly number[],
  MASTER_GAIN: 0.7,
  /** Hard cap on fastest band — floor texture only. */
  WHIR_CEILING_GAIN: 0.12,
  /** s above this → continuous whir, not discrete plucks. */
  WHIR_SPEED: 0.85,
  /** Soft duck of whir when a slow string (s < this) blooms. */
  SLOW_BLOOM_S: 0.25,
  DUCK_DB: 4,
  DUCK_SEC: 1,
  /** Cap concurrent struck voices. */
  STRUCK_POOL: 12,
  /**
   * Pitch map: fastest → high by default (amber/fast visual).
   * Set true if the ear wants fastest → low instead.
   */
  REVERSE_PITCH: false,
  /** Seconds string tic/tac alternate scale degrees (indices into SCALE). */
  TIC_DEGREE: 4,
  TAC_DEGREE: 5,
} as const;

export type NowChordConfig = typeof NOW_CHORD;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** pitch_hz(i) — i = 0 fastest … n-1 slowest (caller applies REVERSE_PITCH by flipping i). */
export function pitchHz(
  i: number,
  cfg: Pick<NowChordConfig, "ROOT_HZ" | "SCALE"> = NOW_CHORD,
): number {
  const n = cfg.SCALE.length;
  const degree = cfg.SCALE[i % n]!;
  const oct = Math.floor(i / n);
  return cfg.ROOT_HZ * 2 ** (degree / 12) * 2 ** oct;
}

/** Mix-law params from normalized speed s ∈ [0..1] (1 = fastest). */
export function voiceFromSpeed(
  s: number,
  tickPeriodSec: number,
  cfg: Pick<NowChordConfig, "WHIR_CEILING_GAIN" | "WHIR_SPEED"> = NOW_CHORD,
) {
  const gain = lerp(0.9, cfg.WHIR_CEILING_GAIN, s);
  const attackMs = lerp(40, 0, s);
  const decayS = lerp(Math.min(tickPeriodSec * 0.9, 30), 0.05, s);
  const lowpassHz = lerp(9000, 1200, s);
  const stereoWidth = lerp(0.2, 1.0, s);
  const model: "whir" | "pluck" = s > cfg.WHIR_SPEED ? "whir" : "pluck";
  return { gain, attackMs, decayS, lowpassHz, stereoWidth, model };
}
