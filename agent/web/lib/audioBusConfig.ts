/**
 * Master AudioBus fade / duck tunables (Paulo-ear).
 * See docs/AUDIO-BUS.md.
 */

export const AUDIO_BUS = {
  /** Overall ceiling into the limiter. */
  MASTER_CEILING: 0.85,
  /** Soft limiter (stacked layers). */
  LIMITER_THRESHOLD_DB: -8,
  LIMITER_KNEE: 18,
  LIMITER_RATIO: 2.5,
  LIMITER_ATTACK: 0.015,
  LIMITER_RELEASE: 0.4,

  /** Leave / hide / mute — long enough that suspend never hard-cuts. */
  LEAVE_MS: 560,
  /** Generic fade in / out (ms). */
  FADE_IN_MS: 280,
  FADE_OUT_MS: 450,
  /** Splash / clip dry fade. */
  CLIP_FADE_IN_MS: 250,
  CLIP_FADE_OUT_MS: 500,
  /** Delay/reverb dissolve after clip dry fades. */
  CLIP_TAIL_MS: 900,
  CLIP_TAIL_DELAY_S: 0.22,
  CLIP_TAIL_FEEDBACK: 0.28,
  CLIP_TAIL_WET: 0.35,
  /** Ceremonial Heliodrome wake after Allow-access. */
  HELIODROME_ARM_MS: 1600,
  HELIODROME_DISARM_MS: 520,
  /** Crossfade between screen beds. */
  CROSSFADE_MS: 400,
  /** Duck chord under Aulos / loud clip (dB attenuation). */
  DUCK_DB: 8,
  DUCK_ATTACK_MS: 180,
  DUCK_RELEASE_MS: 420,
  /** Epsilon — never exponential-ramp to exact 0. */
  SILENCE: 0.0001,
} as const;

export type AudioBusChannel = "ticks" | "chord" | "splash" | "bed" | "media";

export type AudioBusConfig = typeof AUDIO_BUS;
