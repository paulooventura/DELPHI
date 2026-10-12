/**
 * Omphalos bed — the home film's sound (public/pneuma-home-omphalos-loop.wav,
 * 4.625 s, sample-exact loop) as an app-wide voice on the AudioBus "bed"
 * channel. Armed with the Heliodrome NOW-Chord after Allow access and kept
 * running across every chamber; the home video follows this clock (see
 * OnyxHomeFilm), never the other way round, so navigation never restarts it.
 */

import { DELPHI_BUILD } from "./buildStamp";
import { AUDIO_BUS, audioBusInput, ensureAudioBus } from "./audioBus";
import { loadSeamlessLoop } from "./seamlessLoop";
import { isSymphonyDucked, subscribeSymphonyDuck } from "./symphonyDuck";

const LOOP_SRC = `/pneuma-home-omphalos-loop.wav?v=${DELPHI_BUILD}`;
const LOOP_GAIN = 0.7;
const DUCKED_GAIN = 0.28;
const FADE_IN_S = 0.9;
const FADE_OUT_S = 0.6;
const DUCK_S = 0.35;

type Bed = {
  ctx: AudioContext;
  master: GainNode;
  src: AudioBufferSourceNode | null;
  startedAt: number;
  period: number;
  unsubDuck: () => void;
};

let bed: Bed | null = null;
let starting: Promise<void> | null = null;

function ramp(param: AudioParam, to: number, sec: number, ctx: BaseAudioContext) {
  const t = ctx.currentTime;
  try {
    param.cancelScheduledValues(t);
    param.setValueAtTime(Math.max(AUDIO_BUS.SILENCE, param.value), t);
    param.exponentialRampToValueAtTime(Math.max(AUDIO_BUS.SILENCE, to), t + sec);
  } catch {
    param.value = to;
  }
}

const level = () => (isSymphonyDucked() ? DUCKED_GAIN : LOOP_GAIN);

/** Start (or keep) the bed on this context. Safe to call repeatedly. */
export function startOmphalosBed(ctx: AudioContext): Promise<void> {
  if (bed?.ctx === ctx && bed.src) {
    ramp(bed.master.gain, level(), FADE_IN_S, ctx);
    return Promise.resolve();
  }
  if (starting) return starting;
  if (bed) stopOmphalosBed(false);

  ensureAudioBus(ctx);
  const master = ctx.createGain();
  master.gain.value = AUDIO_BUS.SILENCE;
  master.connect(audioBusInput("bed", ctx));
  const unsubDuck = subscribeSymphonyDuck(() => ramp(master.gain, level(), DUCK_S, ctx));
  const next: Bed = { ctx, master, src: null, startedAt: 0, period: 0, unsubDuck };
  bed = next;

  starting = loadSeamlessLoop(ctx, LOOP_SRC)
    .then(buffer => {
      if (bed !== next) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(master);
      next.startedAt = ctx.currentTime;
      next.period = buffer.duration;
      src.start(next.startedAt);
      next.src = src;
      ramp(master.gain, level(), FADE_IN_S, ctx);
    })
    .catch(() => {
      /* picture still loops; sound just stays off */
    })
    .finally(() => {
      starting = null;
    });
  return starting;
}

/** Fade out and release the bed (stone off / sound disabled). */
export function stopOmphalosBed(fade = true): void {
  const b = bed;
  if (!b) return;
  bed = null;
  b.unsubDuck();
  const sec = fade ? FADE_OUT_S : 0.02;
  ramp(b.master.gain, AUDIO_BUS.SILENCE, sec, b.ctx);
  window.setTimeout(() => {
    try {
      b.src?.stop();
    } catch {
      /* already stopped */
    }
    b.src?.disconnect();
    b.master.disconnect();
  }, sec * 1000 + 80);
}

/** Where the bed is in its loop, as heard (latency-compensated). Null when silent. */
export function omphalosBedPhase(): { phase: number; period: number } | null {
  const b = bed;
  if (!b?.src || b.period <= 0 || b.ctx.state !== "running") return null;
  const heard = b.ctx.currentTime - (b.ctx.outputLatency || b.ctx.baseLatency || 0);
  const p = (heard - b.startedAt) % b.period;
  return { phase: (p + b.period) % b.period, period: b.period };
}
