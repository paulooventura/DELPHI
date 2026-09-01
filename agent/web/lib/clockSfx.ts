let sharedCtx: AudioContext | null = null;
let sharedNoise: AudioBuffer | null = null;
let sharedMaster: GainNode | null = null;
/** Bumps on each mute so delayed teardowns/suspends don't race a later unmute. */
let muteEpoch = 0;
let audioSilenced = false;

type AudioContextCtor = typeof AudioContext;

export function getClockAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return null;
    sharedCtx = new Ctor();
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

export function isClockAudioSilenced(): boolean {
  return audioSilenced;
}

/** Clear woody knock — tick / tock on each second. */
export function playSecondTick(ctx: AudioContext, second: number) {
  if (audioSilenced) return;
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
  if (audioSilenced) return;
  if (ctx.state !== "running") void ctx.resume();
  playGongStrike(ctx, ctx.currentTime, 72, 0.38, 3.2);
}

/** Hour gong — deeper bowl, one strike per hour count. */
export function playHourBell(ctx: AudioContext, hour24: number) {
  if (audioSilenced) return;
  if (ctx.state !== "running") void ctx.resume();
  const strikes = (hour24 % 12) || 12;
  const gap = 1.55;
  for (let i = 0; i < strikes; i++) {
    playGongStrike(ctx, ctx.currentTime + i * gap, 55, 0.42, 3.8);
  }
}

const PLANET_HZ: Record<string, number> = {
  saturn: 49,
  jupiter: 62,
  mars: 74,
  sun: 82,
  venus: 98,
  mercury: 110,
  moon: 92,
};

const SHI_HZ = [98, 110, 123, 131, 147, 165, 175, 196, 220, 247, 262, 294];

function woodMark(ctx: AudioContext, hz: number, peak: number, dur: number) {
  if (audioSilenced) return;
  if (ctx.state !== "running") void ctx.resume();
  const t = ctx.currentTime;
  const out = masterBus(ctx);
  const knock = ctx.createBufferSource();
  knock.buffer = noiseBuffer(ctx, 1.5);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(hz * 2.4, t);
  bp.Q.setValueAtTime(1.6, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  knock.connect(bp);
  bp.connect(g);
  g.connect(out);
  knock.start(t);
  knock.stop(t + dur + 0.02);
  const body = ctx.createOscillator();
  const bodyG = ctx.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(hz, t);
  body.frequency.exponentialRampToValueAtTime(hz * 0.72, t + dur);
  bodyG.gain.setValueAtTime(peak * 0.7, t);
  bodyG.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  body.connect(bodyG);
  bodyG.connect(out);
  body.start(t);
  body.stop(t + dur + 0.02);
}

/** Ghaṭi — ~24 min from sunrise. Clay / wood, quieter than the minute gong. */
export function playGhatiMark(ctx: AudioContext) {
  woodMark(ctx, 108, 0.2, 0.42);
}

/** Muhūrta — ~48 min. Warmer bowl than the minute strike. */
export function playMuhurtaMark(ctx: AudioContext) {
  if (audioSilenced) return;
  if (ctx.state !== "running") void ctx.resume();
  playGongStrike(ctx, ctx.currentTime, 88, 0.24, 2.6);
}

/** Planetary hour — pitch follows the Chaldean ruler. */
export function playPlanetaryHourMark(ctx: AudioContext, planet: string) {
  if (audioSilenced) return;
  if (ctx.state !== "running") void ctx.resume();
  playGongStrike(ctx, ctx.currentTime, PLANET_HZ[planet] ?? 82, 0.26, 2.9);
}

/** Chinese shí — 2 h double-hour. Pentatonic ding + wood. */
export function playShiMark(ctx: AudioContext, index: number) {
  woodMark(ctx, SHI_HZ[((index % 12) + 12) % 12] ?? 131, 0.16, 0.55);
}

/** Kè — 14.4 min water-clock mark. */
export function playKeMark(ctx: AudioContext) {
  if (audioSilenced) return;
  if (ctx.state !== "running") void ctx.resume();
  const t = ctx.currentTime;
  const out = masterBus(ctx);
  const drip = ctx.createOscillator();
  const g = ctx.createGain();
  drip.type = "sine";
  drip.frequency.setValueAtTime(420, t);
  drip.frequency.exponentialRampToValueAtTime(210, t + 0.28);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
  drip.connect(g);
  g.connect(out);
  drip.start(t);
  drip.stop(t + 0.4);
}

/** .beat — 86.4 s. A whisper above the wood tick, not a gong. */
export function playBeatMark(ctx: AudioContext) {
  if (audioSilenced) return;
  if (ctx.state !== "running") void ctx.resume();
  const t = ctx.currentTime;
  const out = masterBus(ctx);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(784, t);
  g.gain.setValueAtTime(0.055, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + 0.16);
}

/** Sunrise / sunset — the day lane's real gates. */
export function playDayGate(ctx: AudioContext, gate: "sunrise" | "sunset") {
  if (audioSilenced) return;
  if (ctx.state !== "running") void ctx.resume();
  const t0 = ctx.currentTime;
  const rise = gate === "sunrise";
  playGongStrike(ctx, t0, rise ? 96 : 64, 0.3, 4.4);
  playGongStrike(ctx, t0 + 0.35, rise ? 144 : 48, 0.16, 3.6);
}

/** Slow sky — moon sector, wuku, pancawara, season. Rare on purpose. */
export function playSlowSkyMark(ctx: AudioContext, kind: "moon" | "wuku" | "pancawara" | "season") {
  if (audioSilenced) return;
  if (ctx.state !== "running") void ctx.resume();
  const hz = { moon: 58, wuku: 52, pancawara: 46, season: 41 }[kind];
  playGongStrike(ctx, ctx.currentTime, hz, 0.2, 5.2);
}

// ─── Schumann atmosphere (32.5 Hz “song of the planet”) ─────────────────────

export const SCHUMANN_HZ = 32.5;

type SchumannBed = {
  master: GainNode;
  sources: Array<OscillatorNode | AudioBufferSourceNode>;
  nodes: AudioNode[];
  timers: number[];
};

let schumannBed: SchumannBed | null = null;

const SCHUMANN_FUND = 7.83;

/**
 * Calm deep-breath bed: 32.5 Hz core + audible harmonics, delay/reverb, slow inhale/exhale.
 * Occasional harmonic blooms from the Schumann series add texture without crowding the pad.
 */
export function startSchumannAtmosphere(ctx: AudioContext): void {
  if (audioSilenced) return;
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
  const timers: number[] = [];

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
    { hz: SCHUMANN_FUND, level: 0.28, type: "sine" },
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

  // Intermittent harmonic blooms — Schumann multiples that swell in and out
  const bloomVoices: Array<{ gain: GainNode; peak: number }> = [
    { hz: SCHUMANN_FUND * 5, peak: 0.09 }, // ~39.15
    { hz: SCHUMANN_FUND * 7, peak: 0.07 }, // ~54.8
    { hz: SCHUMANN_HZ * 1.5, peak: 0.08 }, // ~48.75 (fifth above core)
    { hz: SCHUMANN_FUND * 10, peak: 0.06 }, // ~78.3
    { hz: SCHUMANN_HZ * 5, peak: 0.05 }, // 162.5
    { hz: SCHUMANN_FUND * 13, peak: 0.045 }, // ~101.8
  ].map(({ hz, peak }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(hz, ctx.currentTime);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.max(180, hz * 4), ctx.currentTime);
    lp.Q.setValueAtTime(0.7, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(vca);
    osc.start();
    sources.push(osc);
    nodes.push(gain, lp);
    return { gain, peak };
  });

  const scheduleBloom = () => {
    if (!schumannBed) return;
    const voice = bloomVoices[Math.floor(Math.random() * bloomVoices.length)];
    if (!voice) return;
    const now = ctx.currentTime;
    const rise = 1.2 + Math.random() * 2.2;
    const hold = 0.4 + Math.random() * 1.6;
    const fall = 2.0 + Math.random() * 3.5;
    const level = voice.peak * (0.55 + Math.random() * 0.45);
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
      voice.gain.gain.exponentialRampToValueAtTime(level, now + rise);
      voice.gain.gain.exponentialRampToValueAtTime(level * 0.85, now + rise + hold);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + rise + hold + fall);
    } catch {
      /* ignore scheduling races on teardown */
    }
    const nextMs = 2800 + Math.random() * 7200;
    const id = window.setTimeout(scheduleBloom, nextMs);
    timers.push(id);
  };
  // First bloom after the bed has faded in
  timers.push(window.setTimeout(scheduleBloom, 4200 + Math.random() * 2400));

  schumannBed = { master, sources, nodes, timers };
}

export function stopSchumannAtmosphere(opts?: { fadeSec?: number }): void {
  if (!schumannBed) return;
  const bed = schumannBed;
  const { master, sources, timers } = bed;
  for (const id of timers) window.clearTimeout(id);
  timers.length = 0;
  const ctx = master.context;
  const t = ctx.currentTime;
  const fadeSec = Math.max(0.05, opts?.fadeSec ?? 0.16);
  try {
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec);
  } catch {
    try {
      master.gain.value = 0.0001;
    } catch {
      /* ignore */
    }
  }
  // Schedule stops in the audio graph (survives pagehide better than setTimeout alone).
  const stopAt = t + fadeSec + 0.02;
  for (const s of sources) {
    try {
      s.stop(stopAt);
    } catch {
      /* already stopped / not started */
    }
  }
  const tearDown = () => {
    if (schumannBed !== bed) return;
    for (const s of sources) {
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
  };
  window.setTimeout(tearDown, Math.ceil(fadeSec * 1000) + 60);
}

/** Pause any HTML media so cast ritual films don't click on close. */
function silenceHtmlMedia(): void {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll("video, audio")) {
    const media = el as HTMLMediaElement;
    try {
      media.pause();
      media.muted = true;
      media.volume = 0;
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fade the clock bus out, then stop oscillators / suspend context.
 * Hard-cutting gain or stopping sources mid-wave was the close-app buzz.
 */
export function muteClockAudio(opts?: { fadeMs?: number }): void {
  const fadeMs = opts?.fadeMs ?? 160;
  const fadeSec = fadeMs / 1000;
  const epoch = ++muteEpoch;
  audioSilenced = true;

  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  }
  silenceHtmlMedia();

  const ctx = sharedCtx;
  const t = ctx?.currentTime ?? 0;
  if (sharedMaster && ctx) {
    try {
      sharedMaster.gain.cancelScheduledValues(t);
      sharedMaster.gain.setValueAtTime(Math.max(0.0001, sharedMaster.gain.value), t);
      sharedMaster.gain.exponentialRampToValueAtTime(0.0001, t + fadeSec);
    } catch {
      try {
        sharedMaster.gain.value = 0.0001;
      } catch {
        /* ignore */
      }
    }
  }

  stopSchumannAtmosphere({ fadeSec });

  if (ctx) {
    window.setTimeout(() => {
      if (epoch !== muteEpoch || !audioSilenced) return;
      try {
        void ctx.suspend();
      } catch {
        /* ignore */
      }
    }, fadeMs + 40);
  }
}

/** Restore master bus level after an intentional mute (stone back on / foreground). */
export function unmuteClockAudio(): void {
  muteEpoch += 1;
  audioSilenced = false;
  const ctx = sharedCtx;
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
  if (!sharedMaster) return;
  try {
    const t = sharedMaster.context.currentTime;
    sharedMaster.gain.cancelScheduledValues(t);
    sharedMaster.gain.setValueAtTime(0.0001, t);
    sharedMaster.gain.exponentialRampToValueAtTime(1, t + 0.25);
  } catch {
    try {
      sharedMaster.gain.value = 1;
    } catch {
      /* ignore */
    }
  }
}

export function isSchumannAtmosphereRunning(): boolean {
  return schumannBed != null;
}
