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

/** Barely audible ms pulse */
export function playMsTick(ctx: AudioContext) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(3200, t);
  gain.gain.setValueAtTime(0.0035, t);
  gain.gain.exponentialRampToValueAtTime(0.00005, t + 0.006);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.007);
}

/** Grandfather-clock tick / tock on each second */
export function playSecondTick(ctx: AudioContext, second: number) {
  const t = ctx.currentTime;
  const tock = second % 2 === 1;

  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  body.type = "sine";
  body.frequency.setValueAtTime(tock ? 165 : 210, t);
  body.frequency.exponentialRampToValueAtTime(tock ? 90 : 110, t + 0.14);
  bodyGain.gain.setValueAtTime(tock ? 0.045 : 0.065, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  body.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  body.start(t);
  body.stop(t + 0.17);

  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = "triangle";
  click.frequency.setValueAtTime(tock ? 680 : 920, t);
  clickGain.gain.setValueAtTime(0.018, t);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  click.start(t);
  click.stop(t + 0.03);
}

function playBellStrike(
  ctx: AudioContext,
  t0: number,
  fundamental: number,
  gainPeak: number,
  duration: number,
) {
  [1, 2.2, 3.5, 5.1].forEach((harm, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(fundamental * harm, t0);
    gain.gain.setValueAtTime(gainPeak / (i + 1), t0);
    gain.gain.exponentialRampToValueAtTime(0.00008, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  });
}

/** Single deep bell at each minute */
export function playMinuteBell(ctx: AudioContext) {
  playBellStrike(ctx, ctx.currentTime, 196, 0.11, 0.95);
}

/** Hour strike — one deep bell per hour count (12-hour cycle) */
export function playHourBell(ctx: AudioContext, hour24: number) {
  const strikes = (hour24 % 12) || 12;
  for (let i = 0; i < strikes; i++) {
    playBellStrike(ctx, ctx.currentTime + i * 0.9, 146, 0.13, 1.15);
  }
}
