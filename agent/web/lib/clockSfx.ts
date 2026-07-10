let sharedCtx: AudioContext | null = null;
let sharedNoise: AudioBuffer | null = null;
let sharedMaster: GainNode | null = null;

export function getClockAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    sharedCtx = new AudioContext();
  }
  return sharedCtx;
}

function masterBus(ctx: AudioContext): GainNode {
  if (!sharedMaster || sharedMaster.context !== ctx) {
    sharedMaster = ctx.createGain();
    sharedMaster.gain.value = 1;
    sharedMaster.connect(ctx.destination);
  }
  return sharedMaster;
}

export async function resumeClockAudio(): Promise<AudioContext | null> {
  const ctx = getClockAudio();
  if (!ctx) return null;
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  if (sharedNoise && sharedNoise.sampleRate === ctx.sampleRate) return sharedNoise;
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // Soft pink-ish noise (better for wood / earth beds)
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  sharedNoise = buf;
  return buf;
}

/** Simple feedback delay used as a cheap plate/reverb tail. */
function createEcho(
  ctx: AudioContext,
  destination: AudioNode,
  delaySec: number,
  feedback: number,
  wet: number,
): AudioNode {
  const input = ctx.createGain();
  const delay = ctx.createDelay(2);
  const fb = ctx.createGain();
  const wetGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  delay.delayTime.value = delaySec;
  fb.gain.value = feedback;
  wetGain.gain.value = wet;
  filter.type = "lowpass";
  filter.frequency.value = 2200;
  input.connect(delay);
  delay.connect(filter);
  filter.connect(fb);
  fb.connect(delay);
  filter.connect(wetGain);
  wetGain.connect(destination);
  return input;
}

/** Clear woody knock — tick / tock on each second. */
export function playSecondTick(ctx: AudioContext, second: number) {
  if (ctx.state !== "running") void ctx.resume();
  const t = ctx.currentTime;
  const tock = second % 2 === 1;
  const out = masterBus(ctx);

  const knock = ctx.createBufferSource();
  knock.buffer = noiseBuffer(ctx, 1.5);
  const knockBp = ctx.createBiquadFilter();
  knockBp.type = "bandpass";
  knockBp.frequency.setValueAtTime(tock ? 380 : 520, t);
  knockBp.Q.setValueAtTime(1.8, t);
  const knockGain = ctx.createGain();
  knockGain.gain.setValueAtTime(tock ? 0.28 : 0.34, t);
  knockGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  knock.connect(knockBp);
  knockBp.connect(knockGain);
  knockGain.connect(out);
  knock.start(t);
  knock.stop(t + 0.07);

  const body = ctx.createOscillator();
  const bodyLp = ctx.createBiquadFilter();
  const bodyGain = ctx.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(tock ? 160 : 205, t);
  body.frequency.exponentialRampToValueAtTime(tock ? 78 : 98, t + 0.2);
  bodyLp.type = "lowpass";
  bodyLp.frequency.setValueAtTime(900, t);
  bodyGain.gain.setValueAtTime(tock ? 0.22 : 0.28, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  body.connect(bodyLp);
  bodyLp.connect(bodyGain);
  bodyGain.connect(out);
  body.start(t);
  body.stop(t + 0.24);

  const tip = ctx.createOscillator();
  const tipGain = ctx.createGain();
  tip.type = "sine";
  tip.frequency.setValueAtTime(tock ? 540 : 680, t);
  tipGain.gain.setValueAtTime(0.08, t);
  tipGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  tip.connect(tipGain);
  tipGain.connect(out);
  tip.start(t);
  tip.stop(t + 0.05);
}

/** Deep harmonious gong strike with long resonant tail. */
function playGongStrike(
  ctx: AudioContext,
  t0: number,
  fundamental: number,
  gainPeak: number,
  duration: number,
) {
  const out = masterBus(ctx);
  const echo = createEcho(ctx, out, 0.42, 0.42, 0.45);
  const room = createEcho(ctx, out, 0.88, 0.28, 0.28);

  // Inharmonic gong partials (not strict harmonics — more bowl-like)
  const partials = [
    { mult: 1, level: 1, type: "sine" as OscillatorType },
    { mult: 1.5, level: 0.55, type: "sine" as OscillatorType },
    { mult: 2.05, level: 0.35, type: "triangle" as OscillatorType },
    { mult: 2.7, level: 0.22, type: "sine" as OscillatorType },
    { mult: 3.4, level: 0.14, type: "sine" as OscillatorType },
    { mult: 4.2, level: 0.08, type: "triangle" as OscillatorType },
  ];

  for (const p of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = p.type;
    const f = fundamental * p.mult;
    osc.frequency.setValueAtTime(f, t0);
    osc.frequency.exponentialRampToValueAtTime(f * 0.97, t0 + duration);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(3500, f * 6), t0);
    lp.frequency.exponentialRampToValueAtTime(400, t0 + duration);
    const peak = gainPeak * p.level;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(peak * 0.35, t0 + duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(out);
    gain.connect(echo);
    gain.connect(room);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  // Soft mallet noise attack
  const attack = ctx.createBufferSource();
  attack.buffer = noiseBuffer(ctx, 1.5);
  const atkBp = ctx.createBiquadFilter();
  atkBp.type = "bandpass";
  atkBp.frequency.setValueAtTime(fundamental * 3.2, t0);
  atkBp.Q.setValueAtTime(1.2, t0);
  const atkGain = ctx.createGain();
  atkGain.gain.setValueAtTime(gainPeak * 0.35, t0);
  atkGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  attack.connect(atkBp);
  atkBp.connect(atkGain);
  atkGain.connect(out);
  atkGain.connect(echo);
  attack.start(t0);
  attack.stop(t0 + 0.14);
}

/** Minute gong — deep, single strike. */
export function playMinuteBell(ctx: AudioContext) {
  if (ctx.state !== "running") void ctx.resume();
  playGongStrike(ctx, ctx.currentTime, 72, 0.38, 3.2);
}

/** Hour gong — deeper bowl, one strike per hour count. */
export function playHourBell(ctx: AudioContext, hour24: number) {
  if (ctx.state !== "running") void ctx.resume();
  const strikes = (hour24 % 12) || 12;
  const gap = 1.55;
  for (let i = 0; i < strikes; i++) {
    playGongStrike(ctx, ctx.currentTime + i * gap, 55, 0.42, 3.8);
  }
}

// ─── Schumann atmosphere (32.5 Hz “song of the planet”) ─────────────────────

export const SCHUMANN_HZ = 32.5;

type SchumannBed = {
  master: GainNode;
  sources: Array<OscillatorNode | AudioBufferSourceNode>;
  nodes: AudioNode[];
};

let schumannBed: SchumannBed | null = null;

/**
 * Calm deep-breath bed: 32.5 Hz core + audible harmonics, delay/reverb, slow inhale/exhale.
 */
export function startSchumannAtmosphere(ctx: AudioContext): void {
  if (schumannBed) return;
  if (ctx.state !== "running") void ctx.resume();

  const out = masterBus(ctx);
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 3.5);

  const echo = createEcho(ctx, out, 0.55, 0.48, 0.55);
  const hall = createEcho(ctx, out, 1.15, 0.35, 0.4);
  master.connect(out);
  master.connect(echo);
  master.connect(hall);

  const sources: Array<OscillatorNode | AudioBufferSourceNode> = [];
  const nodes: AudioNode[] = [master, echo, hall];

  // Breath envelope — ~8s inhale / exhale cycle into a VCA
  const vca = ctx.createGain();
  vca.gain.setValueAtTime(0.55, ctx.currentTime);
  vca.connect(master);
  nodes.push(vca);

  const breathLfo = ctx.createOscillator();
  breathLfo.type = "sine";
  breathLfo.frequency.setValueAtTime(0.085, ctx.currentTime); // ~11.7s full breath
  const breathDepth = ctx.createGain();
  breathDepth.gain.setValueAtTime(0.35, ctx.currentTime);
  breathLfo.connect(breathDepth);
  breathDepth.connect(vca.gain);
  breathLfo.start();
  sources.push(breathLfo);
  nodes.push(breathDepth);

  const partials: Array<{ hz: number; level: number; type: OscillatorType }> = [
    { hz: SCHUMANN_HZ, level: 0.7, type: "sine" },
    { hz: 7.83, level: 0.28, type: "sine" },
    { hz: 14.3, level: 0.2, type: "sine" },
    { hz: 20.8, level: 0.16, type: "sine" },
    { hz: 65, level: 0.32, type: "sine" }, // audible warmth
    { hz: 97.5, level: 0.18, type: "triangle" },
    { hz: 130, level: 0.1, type: "sine" },
    { hz: 195, level: 0.06, type: "sine" },
  ];

  for (const p of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.hz, ctx.currentTime);
    // Slow living drift
    osc.frequency.linearRampToValueAtTime(p.hz * 1.004, ctx.currentTime + 12);
    osc.frequency.linearRampToValueAtTime(p.hz * 0.997, ctx.currentTime + 24);
    osc.frequency.linearRampToValueAtTime(p.hz, ctx.currentTime + 36);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.max(120, p.hz * 5), ctx.currentTime);
    gain.gain.setValueAtTime(p.level, ctx.currentTime);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(vca);
    osc.start();
    sources.push(osc);
    nodes.push(gain, lp);
  }

  // Soft air / earth hiss through the breath VCA
  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuffer(ctx, 2);
  hiss.loop = true;
  const hissLp = ctx.createBiquadFilter();
  hissLp.type = "lowpass";
  hissLp.frequency.setValueAtTime(240, ctx.currentTime);
  const hissGain = ctx.createGain();
  hissGain.gain.setValueAtTime(0.045, ctx.currentTime);
  hiss.connect(hissLp);
  hissLp.connect(hissGain);
  hissGain.connect(vca);
  hiss.start();
  sources.push(hiss);
  nodes.push(hissLp, hissGain);

  schumannBed = { master, sources, nodes };
}

export function stopSchumannAtmosphere(): void {
  if (!schumannBed) return;
  const { master, sources } = schumannBed;
  const ctx = master.context;
  const t = ctx.currentTime;
  try {
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      try {
        s.disconnect();
      } catch {
        /* ignore */
      }
    }
    try {
      master.disconnect();
    } catch {
      /* ignore */
    }
    schumannBed = null;
  }, 1500);
}

export function isSchumannAtmosphereRunning(): boolean {
  return schumannBed != null;
}
