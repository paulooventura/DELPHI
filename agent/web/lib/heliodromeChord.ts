/**
 * Heliodrome NOW-Chord — one continuously-ringing chord driven by live cycle lanes.
 * Native Web Audio (no Tone.js). Shares getClockAudio(); respects stone mute / park / freeze.
 */

import {
  getClockAudio,
  isClockAudioSilenced,
  isClockTimeFrozen,
  isSchumannAtmosphereRunning,
  onClockAudioMute,
  onClockAudioUnmute,
  resumeClockAudio,
  startSchumannAtmosphere,
  stopSchumannAtmosphere,
} from "./clockSfx";
import { pulseHaptic, hapticsMuted } from "./haptics";
import {
  GHATI_MS,
  HELEK_MS,
  PALA_MS,
  PRANA_MS,
  REGA_PER_HELEK,
  type OrreryLaneId,
  type OrreryLaneState,
} from "./lore/orreryLanes";
import { NOW_CHORD, lerp, pitchHz, voiceFromSpeed } from "./heliodromeChordConfig";

const DAY = 86_400;
const KE_S = 14.4 * 60;
const BEAT_S = 86.4;

/** Nominal seconds for one pass through NOW (one cell). */
export const LANE_TICK_PERIOD_S: Record<OrreryLaneId, number> = {
  precession: 72 * DAY * 365.25,
  age: 2150 * DAY * 365.25,
  century: 100 * DAY * 365.25,
  year: DAY * 365.25,
  season: (DAY * 365.25) / 12,
  tzolkin: DAY,
  "dreamspell-kin": DAY,
  "dreamspell-tone": DAY,
  "dreamspell-wavespell": 13 * DAY,
  month: (DAY * 365.25) / 12,
  date: DAY,
  moon: (29.53059 * DAY) / 8,
  nakshatra: (27.32166 * DAY) / 27,
  decan: (DAY * 365.25) / 36,
  wuku: DAY,
  "wuku-tzolkin": DAY,
  "planetary-day": DAY,
  pancawara: DAY,
  manzil: DAY,
  numerology: DAY,
  day: 3600,
  shi: 2 * 3600,
  "planetary-hour": 3600,
  muhurta: 48 * 60,
  ghati: GHATI_MS / 1000,
  ke: KE_S,
  min: 60,
  beat: BEAT_S / 10, // lane cells are tens of .beats
  pala: PALA_MS / 1000,
  prana: PRANA_MS / 1000,
  helek: HELEK_MS / 1000,
  sec: 1,
  rega: HELEK_MS / 1000 / REGA_PER_HELEK,
  ms: 0.001,
};

type StruckVoice = {
  busyUntil: number;
  gain: GainNode;
  filter: BiquadFilterNode;
  pan: StereoPannerNode;
};

type WhirVoice = {
  id: OrreryLaneId;
  gain: GainNode;
  filter: BiquadFilterNode;
  pan: StereoPannerNode;
  tremolo: GainNode;
  noise: AudioBufferSourceNode;
  osc: OscillatorNode;
};

type ChordRuntime = {
  ctx: AudioContext;
  master: GainNode;
  compressor: DynamicsCompressorNode;
  whirBus: GainNode;
  bedGain: GainNode;
  strings: Map<OrreryLaneId, { pitch: number; s: number; period: number; model: "whir" | "pluck" }>;
  whir: Map<OrreryLaneId, WhirVoice>;
  pool: StruckVoice[];
  lastIndex: Map<OrreryLaneId, number>;
  secFlip: boolean;
  schumannPhase: number;
  hapticCount: number;
  duckUntil: number;
  bedSources: Array<OscillatorNode | AudioBufferSourceNode>;
  noiseBuf: AudioBuffer;
};

let runtime: ChordRuntime | null = null;
let heliodromeChordWanted = false;

export function isHeliodromeChordWanted(): boolean {
  return heliodromeChordWanted;
}

export function isHeliodromeChordActive(): boolean {
  return heliodromeChordWanted && runtime !== null && !isClockAudioSilenced();
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buf;
}

function buildBed(rt: ChordRuntime): void {
  const { ctx, bedGain, noiseBuf } = rt;
  const t = ctx.currentTime;
  const carrier = ctx.createOscillator();
  const carrierGain = ctx.createGain();
  carrier.type = "sine";
  carrier.frequency.value = NOW_CHORD.ROOT_HZ / 2;
  carrierGain.gain.value = 0.22;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = "sine";
  lfo.frequency.value = NOW_CHORD.SCHUMANN_HZ;
  lfoGain.gain.value = 0.14;
  lfo.connect(lfoGain);
  lfoGain.connect(carrierGain.gain);
  carrier.connect(carrierGain);
  carrierGain.connect(bedGain);
  carrier.start();
  lfo.start();
  rt.bedSources.push(carrier, lfo);

  for (const hz of NOW_CHORD.SCHUMANN_HARMONICS) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    o.type = "sine";
    o.frequency.value = hz;
    lp.type = "lowpass";
    lp.frequency.value = Math.max(80, hz * 6);
    g.gain.value = hz === NOW_CHORD.SCHUMANN_HZ ? 0.12 : 0.045;
    o.connect(lp);
    lp.connect(g);
    g.connect(bedGain);
    o.start();
    rt.bedSources.push(o);
  }

  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuf;
  hiss.loop = true;
  const hissLp = ctx.createBiquadFilter();
  hissLp.type = "lowpass";
  hissLp.frequency.value = 180;
  const hissG = ctx.createGain();
  hissG.gain.value = 0.03;
  hiss.connect(hissLp);
  hissLp.connect(hissG);
  hissG.connect(bedGain);
  hiss.start();
  rt.bedSources.push(hiss);

  bedGain.gain.setValueAtTime(0.0001, t);
  bedGain.gain.exponentialRampToValueAtTime(0.35, t + 2.2);
}

function acquireStruck(rt: ChordRuntime): StruckVoice | null {
  const now = rt.ctx.currentTime;
  let best: StruckVoice | null = null;
  for (const v of rt.pool) {
    if (v.busyUntil <= now) return v;
    if (!best || v.busyUntil < best.busyUntil) best = v;
  }
  return best;
}

function excitePluck(
  rt: ChordRuntime,
  pitch: number,
  params: ReturnType<typeof voiceFromSpeed>,
  yinYang: number,
  ticTacPitch?: number,
): void {
  const voice = acquireStruck(rt);
  if (!voice) return;
  const ctx = rt.ctx;
  const t = ctx.currentTime;
  const hz = ticTacPitch ?? pitch;
  const atk = Math.max(0.001, params.attackMs / 1000);
  const dec = Math.max(0.05, params.decayS);
  const pan = Math.max(-1, Math.min(1, yinYang * params.stereoWidth));
  const bright = params.lowpassHz * (1 + 0.35 * yinYang);

  voice.pan.pan.setValueAtTime(pan, t);
  voice.filter.frequency.setValueAtTime(Math.max(200, bright), t);
  voice.filter.Q.setValueAtTime(8 + (1 - params.gain) * 4, t);

  voice.gain.gain.cancelScheduledValues(t);
  voice.gain.gain.setValueAtTime(0.0001, t);
  voice.gain.gain.exponentialRampToValueAtTime(Math.max(0.001, params.gain * 0.45), t + atk);
  voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
  voice.busyUntil = t + atk + dec + 0.05;

  // Impulse into resonant filter (Karplus-ish ping)
  const burst = ctx.createBufferSource();
  const n = Math.max(32, Math.floor(ctx.sampleRate * 0.012));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  burst.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = hz;
  bp.Q.value = 18;
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = hz;
  og.gain.setValueAtTime(0.35, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.4, dec * 0.35));

  burst.connect(bp);
  bp.connect(voice.filter);
  osc.connect(og);
  og.connect(voice.filter);
  burst.start(t);
  burst.stop(t + 0.02);
  osc.start(t);
  osc.stop(t + Math.min(0.45, dec * 0.4));
}

function ensureWhir(rt: ChordRuntime, id: OrreryLaneId, pitch: number): WhirVoice {
  const existing = rt.whir.get(id);
  if (existing) {
    existing.osc.frequency.setTargetAtTime(pitch, rt.ctx.currentTime, 0.2);
    return existing;
  }
  const ctx = rt.ctx;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1200;
  const pan = ctx.createStereoPanner();
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  const tremolo = ctx.createGain();
  tremolo.gain.value = 0.7;

  const noise = ctx.createBufferSource();
  noise.buffer = rt.noiseBuf;
  noise.loop = true;
  const nLp = ctx.createBiquadFilter();
  nLp.type = "bandpass";
  nLp.frequency.value = pitch;
  nLp.Q.value = 2.5;
  const nG = ctx.createGain();
  nG.gain.value = 0.55;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = pitch;
  const oG = ctx.createGain();
  oG.gain.value = 0.22;

  const lfo = ctx.createOscillator();
  const lfoG = ctx.createGain();
  lfo.type = "sine";
  lfo.frequency.value = Math.min(18, Math.max(4, pitch / 40));
  lfoG.gain.value = 0.25;
  lfo.connect(lfoG);
  lfoG.connect(tremolo.gain);

  noise.connect(nLp);
  nLp.connect(nG);
  nG.connect(tremolo);
  osc.connect(oG);
  oG.connect(tremolo);
  tremolo.connect(filter);
  filter.connect(pan);
  pan.connect(gain);
  gain.connect(rt.whirBus);

  noise.start();
  osc.start();
  lfo.start();

  const voice: WhirVoice = { id, gain, filter, pan, tremolo, noise, osc };
  rt.whir.set(id, voice);
  rt.bedSources.push(noise, osc, lfo);
  return voice;
}

function updateWhir(
  rt: ChordRuntime,
  id: OrreryLaneId,
  pitch: number,
  params: ReturnType<typeof voiceFromSpeed>,
  yinYang: number,
  duck: number,
): void {
  const v = ensureWhir(rt, id, pitch);
  const t = rt.ctx.currentTime;
  const pan = Math.max(-1, Math.min(1, yinYang * params.stereoWidth));
  const level = Math.min(NOW_CHORD.WHIR_CEILING_GAIN, params.gain) * duck;
  v.pan.pan.setTargetAtTime(pan, t, 0.08);
  v.filter.frequency.setTargetAtTime(Math.max(400, params.lowpassHz * (1 + 0.2 * yinYang)), t, 0.1);
  v.gain.gain.setTargetAtTime(Math.max(0.0001, level * 0.55), t, 0.15);
}

function pruneWhir(rt: ChordRuntime, keep: Set<OrreryLaneId>): void {
  for (const [id, v] of rt.whir) {
    if (keep.has(id)) continue;
    try {
      v.gain.gain.setTargetAtTime(0.0001, rt.ctx.currentTime, 0.05);
      v.noise.stop();
      v.osc.stop();
    } catch {
      /* ignore */
    }
    rt.whir.delete(id);
  }
}

function orderStrings(lanes: OrreryLaneState[]) {
  const rows = lanes.map(lane => ({
    lane,
    period: LANE_TICK_PERIOD_S[lane.id] ?? 86400,
  }));
  rows.sort((a, b) => a.period - b.period);
  const n = Math.max(1, rows.length - 1);
  return rows.map((row, i) => {
    const s = n === 0 ? 1 : 1 - i / n; // 1 = fastest
    // Default: fastest → high (amber), slowest → low (violet). REVERSE_PITCH flips.
    const pitchIndex = NOW_CHORD.REVERSE_PITCH ? i : rows.length - 1 - i;
    const pitch = pitchHz(pitchIndex);
    const params = voiceFromSpeed(s, row.period);
    return { ...row, s, pitch, params };
  });
}

/**
 * Start the NOW-Chord (Heliodrome open). Safe to call repeatedly.
 * AudioContext must already be unlocked by a user gesture (stone / home).
 */
export async function startHeliodromeChord(): Promise<void> {
  heliodromeChordWanted = true;
  if (isClockAudioSilenced()) return;
  const ctx = (await resumeClockAudio()) ?? getClockAudio();
  if (!ctx || ctx.state !== "running") return;
  if (runtime?.ctx === ctx) return;

  stopHeliodromeChordGraph();
  // Chord owns the Schumann bed while Heliodrome is open.
  if (isSchumannAtmosphereRunning()) stopSchumannAtmosphere({ fadeSec: 0.4 });

  const master = ctx.createGain();
  master.gain.value = NOW_CHORD.MASTER_GAIN * 0.22;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 3.2;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.35;
  const whirBus = ctx.createGain();
  whirBus.gain.value = 1;
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.0001;

  master.connect(compressor);
  compressor.connect(ctx.destination);
  whirBus.connect(master);
  bedGain.connect(master);

  const pool: StruckVoice[] = [];
  for (let i = 0; i < NOW_CHORD.STRUCK_POOL; i++) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const pan = ctx.createStereoPanner();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    filter.connect(pan);
    pan.connect(gain);
    gain.connect(master);
    pool.push({ busyUntil: 0, gain, filter, pan });
  }

  runtime = {
    ctx,
    master,
    compressor,
    whirBus,
    bedGain,
    strings: new Map(),
    whir: new Map(),
    pool,
    lastIndex: new Map(),
    secFlip: false,
    schumannPhase: 0,
    hapticCount: 0,
    duckUntil: 0,
    bedSources: [],
    noiseBuf: makeNoise(ctx),
  };
  buildBed(runtime);
}

function stopHeliodromeChordGraph(): void {
  if (!runtime) return;
  const rt = runtime;
  runtime = null;
  const t = rt.ctx.currentTime;
  try {
    rt.master.gain.cancelScheduledValues(t);
    rt.master.gain.setTargetAtTime(0.0001, t, 0.04);
  } catch {
    /* ignore */
  }
  for (const s of rt.bedSources) {
    try {
      s.stop();
    } catch {
      /* ignore */
    }
  }
  for (const v of rt.whir.values()) {
    try {
      v.noise.stop();
      v.osc.stop();
    } catch {
      /* ignore */
    }
  }
}

/** Stone mute — tear voices but keep wanted so unmute/orrery frame can rebuild. */
export function silenceHeliodromeChord(): void {
  stopHeliodromeChordGraph();
}

/** After unmute — rebuild if Heliodrome still wants the chord. */
export function maybeRestartHeliodromeChord(): void {
  if (heliodromeChordWanted && !isClockAudioSilenced()) {
    void startHeliodromeChord();
  }
}

/** Leave Heliodrome — tear chord graph; restore home Schumann bed if still audible. */
export function stopHeliodromeChord(): void {
  heliodromeChordWanted = false;
  stopHeliodromeChordGraph();
  if (!isClockAudioSilenced()) {
    const ctx = getClockAudio();
    if (ctx?.state === "running" && !isSchumannAtmosphereRunning()) {
      startSchumannAtmosphere(ctx);
    }
  }
}

/**
 * Drive the chord from one Heliodrome frame.
 * Call with visible (non-hidden) lanes from computeOrreryState.
 */
export function tickHeliodromeChord(lanes: OrreryLaneState[], hapticsOn: boolean): void {
  if (!heliodromeChordWanted) return;
  if (isClockAudioSilenced() || isClockTimeFrozen()) {
    if (runtime) {
      const t = runtime.ctx.currentTime;
      runtime.whirBus.gain.setTargetAtTime(0.0001, t, 0.05);
      runtime.master.gain.setTargetAtTime(0.0001, t, 0.05);
    }
    return;
  }
  if (!runtime) {
    void startHeliodromeChord();
    return;
  }

  const rt = runtime;
  const t = rt.ctx.currentTime;
  rt.master.gain.setTargetAtTime(NOW_CHORD.MASTER_GAIN * 0.22, t, 0.08);
  rt.whirBus.gain.setTargetAtTime(1, t, 0.08);

  const ordered = orderStrings(lanes);
  const whirKeep = new Set<OrreryLaneId>();
  let duck = 1;
  if (t < rt.duckUntil) {
    duck = 10 ** (-NOW_CHORD.DUCK_DB / 20);
  }

  for (const row of ordered) {
    const { lane, s, pitch, params, period } = row;
    rt.strings.set(lane.id, { pitch, s, period, model: params.model });
    const yinYang = Math.cos(lane.progress * Math.PI); // +1 young → −1 at tick

    const prev = rt.lastIndex.get(lane.id);
    const crossed = prev !== undefined && prev !== lane.index;
    rt.lastIndex.set(lane.id, lane.index);

    if (params.model === "whir") {
      whirKeep.add(lane.id);
      updateWhir(rt, lane.id, pitch, params, yinYang, duck);
      continue;
    }

    if (crossed) {
      let hitPitch = pitch;
      if (lane.id === "sec") {
        rt.secFlip = !rt.secFlip;
        const deg = rt.secFlip ? NOW_CHORD.TIC_DEGREE : NOW_CHORD.TAC_DEGREE;
        const semi = NOW_CHORD.SCALE[deg % NOW_CHORD.SCALE.length]!;
        hitPitch = NOW_CHORD.ROOT_HZ * 2 ** (semi / 12) * 4; // mid register tic-tac
      }
      excitePluck(rt, pitch, params, yinYang, hitPitch);
      if (s < NOW_CHORD.SLOW_BLOOM_S) {
        rt.duckUntil = t + NOW_CHORD.DUCK_SEC;
      }
    }
  }

  pruneWhir(rt, whirKeep);

  // Schumann-locked haptic — every 4th rising edge (~2 Hz), not 7.83 spam
  rt.schumannPhase += (1 / 60) * NOW_CHORD.SCHUMANN_HZ;
  if (rt.schumannPhase >= 1) {
    rt.schumannPhase -= 1;
    rt.hapticCount += 1;
    if (hapticsOn && !hapticsMuted() && rt.hapticCount % 4 === 0) {
      void pulseHaptic("tick");
    }
  }
}

/** Pure helpers for tests. */
export function orderStringsForTest(lanes: OrreryLaneState[]) {
  return orderStrings(lanes);
}

// Wire stone mute without circular imports at call sites.
if (typeof window !== "undefined") {
  onClockAudioMute(() => silenceHeliodromeChord());
  onClockAudioUnmute(() => maybeRestartHeliodromeChord());
}
