/**
 * Master AudioBus — every playback source routes here so starts/stops fade,
 * never hard-cut. Shares the AudioContext from getClockAudio() (caller passes it).
 *
 *   [ticks] [chord] [splash] [bed] [media]
 *        └─► channelGain ─► masterGain ─► limiter ─► destination
 */

import {
  AUDIO_BUS,
  type AudioBusChannel,
} from "./audioBusConfig";

export type { AudioBusChannel } from "./audioBusConfig";
export { AUDIO_BUS } from "./audioBusConfig";

type ChannelState = {
  gain: GainNode;
  /** Linear gain target when not ducked (1 = full channel). */
  nominal: number;
  duckMul: number;
};

type BusRuntime = {
  ctx: AudioContext;
  master: GainNode;
  limiter: DynamicsCompressorNode;
  channels: Record<AudioBusChannel, ChannelState>;
};

let bus: BusRuntime | null = null;

function dbToMul(db: number): number {
  return Math.pow(10, db / 20);
}

function rampGain(g: AudioParam, to: number, ms: number, ctx: AudioContext): void {
  const t = ctx.currentTime;
  const target = Math.max(AUDIO_BUS.SILENCE, to);
  const sec = Math.max(0.02, ms / 1000);
  try {
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(AUDIO_BUS.SILENCE, g.value), t);
    g.exponentialRampToValueAtTime(target, t + sec);
  } catch {
    try {
      g.value = target;
    } catch {
      /* ignore */
    }
  }
}

function applyChannelLevel(ch: ChannelState, ctx: AudioContext, ms: number): void {
  const level = Math.max(AUDIO_BUS.SILENCE, ch.nominal * ch.duckMul);
  rampGain(ch.gain.gain, level, ms, ctx);
}

function buildBus(ctx: AudioContext): BusRuntime {
  const master = ctx.createGain();
  master.gain.value = AUDIO_BUS.MASTER_CEILING;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = AUDIO_BUS.LIMITER_THRESHOLD_DB;
  limiter.knee.value = AUDIO_BUS.LIMITER_KNEE;
  limiter.ratio.value = AUDIO_BUS.LIMITER_RATIO;
  limiter.attack.value = AUDIO_BUS.LIMITER_ATTACK;
  limiter.release.value = AUDIO_BUS.LIMITER_RELEASE;

  master.connect(limiter);
  limiter.connect(ctx.destination);

  const ids: AudioBusChannel[] = ["ticks", "chord", "splash", "bed", "media"];
  const channels = {} as Record<AudioBusChannel, ChannelState>;
  for (const id of ids) {
    const gain = ctx.createGain();
    // ticks/bed stay hot for clock marks; chord/splash/media arm via fadeIn.
    gain.gain.value = id === "ticks" || id === "bed" ? 1 : AUDIO_BUS.SILENCE;
    gain.connect(master);
    channels[id] = {
      gain,
      nominal: id === "ticks" || id === "bed" ? 1 : 0,
      duckMul: 1,
    };
  }

  return { ctx, master, limiter, channels };
}

/** Ensure the shared bus exists for this context. */
export function ensureAudioBus(ctx: AudioContext): BusRuntime {
  if (!bus || bus.ctx !== ctx) {
    bus = buildBus(ctx);
  }
  return bus;
}

export function getAudioBus(): BusRuntime | null {
  return bus;
}

/** Channel insert point — connect sources here, never to destination. */
export function audioBusInput(channel: AudioBusChannel, ctx: AudioContext): GainNode {
  return ensureAudioBus(ctx).channels[channel].gain;
}

export function fadeIn(
  channel: AudioBusChannel,
  ms: number = AUDIO_BUS.FADE_IN_MS,
  to = 1,
): void {
  if (!bus) return;
  const ch = bus.channels[channel];
  ch.nominal = Math.max(0, Math.min(1, to));
  applyChannelLevel(ch, bus.ctx, ms);
}

export function fadeOut(
  channel: AudioBusChannel,
  ms: number = AUDIO_BUS.FADE_OUT_MS,
): void {
  if (!bus) return;
  const ch = bus.channels[channel];
  ch.nominal = 0;
  applyChannelLevel(ch, bus.ctx, ms);
}

/** Equal-power-ish hand-off: out fades while in rises over the same window. */
export function crossfade(
  from: AudioBusChannel,
  to: AudioBusChannel,
  ms: number = AUDIO_BUS.CROSSFADE_MS,
): void {
  fadeOut(from, ms);
  fadeIn(to, ms, 1);
}

export function duck(
  channel: AudioBusChannel,
  db: number = AUDIO_BUS.DUCK_DB,
  ms: number = AUDIO_BUS.DUCK_ATTACK_MS,
): void {
  if (!bus) return;
  const ch = bus.channels[channel];
  ch.duckMul = Math.max(AUDIO_BUS.SILENCE, dbToMul(-Math.abs(db)));
  applyChannelLevel(ch, bus.ctx, ms);
}

export function unduck(
  channel: AudioBusChannel,
  ms: number = AUDIO_BUS.DUCK_RELEASE_MS,
): void {
  if (!bus) return;
  const ch = bus.channels[channel];
  ch.duckMul = 1;
  applyChannelLevel(ch, bus.ctx, ms);
}

/** Master fader (outer ceiling). */
export function fadeMaster(to: number, ms: number): void {
  if (!bus) return;
  rampGain(
    bus.master.gain,
    Math.max(AUDIO_BUS.SILENCE, to * AUDIO_BUS.MASTER_CEILING),
    ms,
    bus.ctx,
  );
}

/**
 * Allow-access wake — raise the Heliodrome chord channel ceremonially.
 * Call after startHeliodromeChord() builds the graph into the chord input.
 */
export function armHeliodrome(): void {
  fadeIn("chord", AUDIO_BUS.HELIODROME_ARM_MS, 1);
}

export function disarmHeliodrome(ms: number = AUDIO_BUS.HELIODROME_DISARM_MS): void {
  fadeOut("chord", ms);
}

/**
 * Route a buffer source through dry + delay tail into the splash channel.
 * Returns dry gain (for fade) and a stop() that dissolves instead of cutting.
 */
export function connectClipWithTail(
  ctx: AudioContext,
  source: AudioNode,
): {
  dry: GainNode;
  stopDissolve: (onDone?: () => void) => void;
} {
  ensureAudioBus(ctx);
  const dest = audioBusInput("splash", ctx);
  const dry = ctx.createGain();
  dry.gain.value = AUDIO_BUS.SILENCE;

  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = AUDIO_BUS.CLIP_TAIL_DELAY_S;
  const fb = ctx.createGain();
  fb.gain.value = AUDIO_BUS.CLIP_TAIL_FEEDBACK;
  const wet = ctx.createGain();
  wet.gain.value = AUDIO_BUS.CLIP_TAIL_WET;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;

  source.connect(dry);
  dry.connect(dest);

  source.connect(delay);
  delay.connect(lp);
  lp.connect(fb);
  fb.connect(delay);
  lp.connect(wet);
  wet.connect(dest);

  const stopDissolve = (onDone?: () => void) => {
    const t = ctx.currentTime;
    const outMs = AUDIO_BUS.CLIP_FADE_OUT_MS;
    try {
      dry.gain.cancelScheduledValues(t);
      dry.gain.setValueAtTime(Math.max(AUDIO_BUS.SILENCE, dry.gain.value), t);
      dry.gain.exponentialRampToValueAtTime(AUDIO_BUS.SILENCE, t + outMs / 1000);
      wet.gain.cancelScheduledValues(t);
      wet.gain.setValueAtTime(Math.max(AUDIO_BUS.SILENCE, wet.gain.value), t);
      wet.gain.exponentialRampToValueAtTime(
        AUDIO_BUS.SILENCE,
        t + (outMs + AUDIO_BUS.CLIP_TAIL_MS) / 1000,
      );
    } catch {
      /* ignore */
    }
    fadeOut("splash", outMs + AUDIO_BUS.CLIP_TAIL_MS * 0.5);
    window.setTimeout(() => onDone?.(), outMs + AUDIO_BUS.CLIP_TAIL_MS + 40);
  };

  return { dry, stopDissolve };
}
