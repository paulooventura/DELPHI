let sharedCtx: AudioContext | null = null;

export function getClockAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    sharedCtx = new AudioContext();
  }
  return sharedCtx;
}

export async function resumeClockAudio(): Promise<AudioContext | null> {
  const ctx = getClockAudio();
  if (!ctx) return null;
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** Soft wooden block knock — tick / tock on each second. */
export function playSecondTick(ctx: AudioContext, second: number) {
  const t = ctx.currentTime;
  const tock = second % 2 === 1;

  // Percussive wood grain (filtered noise)
  const knock = ctx.createBufferSource();
  knock.buffer = noiseBuffer(ctx, 0.05);
  const knockBp = ctx.createBiquadFilter();
  knockBp.type = "bandpass";
  knockBp.frequency.setValueAtTime(tock ? 420 : 560, t);
  knockBp.Q.setValueAtTime(2.4, t);
  const knockLp = ctx.createBiquadFilter();
  knockLp.type = "lowpass";
  knockLp.frequency.setValueAtTime(tock ? 1400 : 1800, t);
  const knockGain = ctx.createGain();
  knockGain.gain.setValueAtTime(tock ? 0.085 : 0.11, t);
  knockGain.gain.exponentialRampToValueAtTime(0.00008, t + 0.045);
  knock.connect(knockBp);
  knockBp.connect(knockLp);
  knockLp.connect(knockGain);
  knockGain.connect(ctx.destination);
  knock.start(t);
  knock.stop(t + 0.05);

  // Resonant wooden body
  const body = ctx.createOscillator();
  const bodyLp = ctx.createBiquadFilter();
  const bodyGain = ctx.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(tock ? 148 : 188, t);
  body.frequency.exponentialRampToValueAtTime(tock ? 72 : 92, t + 0.18);
  bodyLp.type = "lowpass";
  bodyLp.frequency.setValueAtTime(620, t);
  bodyLp.frequency.exponentialRampToValueAtTime(180, t + 0.16);
  bodyGain.gain.setValueAtTime(tock ? 0.055 : 0.07, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.00008, t + 0.2);
  body.connect(bodyLp);
  bodyLp.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  body.start(t);
  body.stop(t + 0.22);

  // Soft secondary wood partial
  const partial = ctx.createOscillator();
  const partialGain = ctx.createGain();
  partial.type = "sine";
  partial.frequency.setValueAtTime(tock ? 310 : 390, t);
  partialGain.gain.setValueAtTime(0.012, t);
  partialGain.gain.exponentialRampToValueAtTime(0.00008, t + 0.07);
  partial.connect(partialGain);
  partialGain.connect(ctx.destination);
  partial.start(t);
  partial.stop(t + 0.08);
}

function playBellStrike(
  ctx: AudioContext,
  t0: number,
  fundamental: number,
  gainPeak: number,
  duration: number,
  harmonics: number[] = [1, 2.4, 3.8],
) {
  harmonics.forEach((harm, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(fundamental * harm, t0);
    osc.frequency.exponentialRampToValueAtTime(fundamental * harm * 0.985, t0 + duration);
    gain.gain.setValueAtTime(gainPeak / (i + 1), t0);
    gain.gain.exponentialRampToValueAtTime(0.00008, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  });
}

/** Single bell at each minute (not on the hour — hour chime takes over). */
export function playMinuteBell(ctx: AudioContext) {
  playBellStrike(ctx, ctx.currentTime, 220, 0.09, 0.85);
}

/** Hour strike — deeper bell, once per hour on a 12-hour dial (3 → 3, 9 → 9, 12 → 12). */
export function playHourBell(ctx: AudioContext, hour24: number) {
  const strikes = (hour24 % 12) || 12;
  const gap = 1.15;
  for (let i = 0; i < strikes; i++) {
    playBellStrike(ctx, ctx.currentTime + i * gap, 98, 0.14, 1.35, [1, 2.1, 3.2, 4.6]);
  }
}

// ─── Schumann atmosphere (32.5 Hz fourth overtone “song of the planet”) ─────

/** Fourth Schumann overtone — user-specified planetary resonance. */
export const SCHUMANN_HZ = 32.5;

type SchumannBed = {
  master: GainNode;
  nodes: AudioNode[];
  sources: Array<OscillatorNode | AudioBufferSourceNode>;
};

let schumannBed: SchumannBed | null = null;

/**
 * Soft continuous bed tuned to 32.5 Hz with gentle harmonics and breath.
 * Felt more than heard on small speakers; pleasing on headphones.
 */
export function startSchumannAtmosphere(ctx: AudioContext): void {
  if (schumannBed) return;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 2.5);
  master.connect(ctx.destination);

  const nodes: AudioNode[] = [master];
  const sources: Array<OscillatorNode | AudioBufferSourceNode> = [];

  // Breath LFO — slow planetary inhale/exhale
  const breath = ctx.createOscillator();
  breath.type = "sine";
  breath.frequency.setValueAtTime(0.068, ctx.currentTime);
  const breathGain = ctx.createGain();
  breathGain.gain.setValueAtTime(0.012, ctx.currentTime);
  breath.connect(breathGain);
  breathGain.connect(master.gain);
  breath.start();
  sources.push(breath);
  nodes.push(breathGain);

  const partials: Array<{ hz: number; level: number; type: OscillatorType }> = [
    { hz: SCHUMANN_HZ, level: 0.55, type: "sine" }, // 32.5 — fourth overtone
    { hz: 7.83, level: 0.18, type: "sine" }, // fundamental Schumann
    { hz: 14.3, level: 0.12, type: "sine" },
    { hz: 20.8, level: 0.1, type: "sine" },
    { hz: SCHUMANN_HZ * 2, level: 0.14, type: "sine" }, // 65 Hz audible warmth
    { hz: SCHUMANN_HZ * 3, level: 0.06, type: "triangle" }, // soft color
  ];

  for (const p of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.hz, ctx.currentTime);
    // Tiny slow drift so it feels alive, not a lab tone
    osc.frequency.setValueAtTime(p.hz * 0.998, ctx.currentTime + 8);
    osc.frequency.setValueAtTime(p.hz * 1.002, ctx.currentTime + 17);
    osc.frequency.setValueAtTime(p.hz, ctx.currentTime + 26);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.max(80, p.hz * 4), ctx.currentTime);
    gain.gain.setValueAtTime(p.level, ctx.currentTime);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(master);
    osc.start();
    sources.push(osc);
    nodes.push(gain, lp);
  }

  // Soft earth-hiss bed (very quiet filtered noise)
  const hiss = ctx.createBufferSource();
  hiss.buffer = noiseBuffer(ctx, 2);
  hiss.loop = true;
  const hissLp = ctx.createBiquadFilter();
  hissLp.type = "lowpass";
  hissLp.frequency.setValueAtTime(180, ctx.currentTime);
  const hissGain = ctx.createGain();
  hissGain.gain.setValueAtTime(0.012, ctx.currentTime);
  hiss.connect(hissLp);
  hissLp.connect(hissGain);
  hissGain.connect(master);
  hiss.start();
  sources.push(hiss);
  nodes.push(hissLp, hissGain);

  schumannBed = { master, nodes, sources };
}

export function stopSchumannAtmosphere(): void {
  if (!schumannBed) return;
  const { master, sources } = schumannBed;
  const ctx = master.context;
  const t = ctx.currentTime;
  try {
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
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
  }, 1300);
}

export function isSchumannAtmosphereRunning(): boolean {
  return schumannBed != null;
}
