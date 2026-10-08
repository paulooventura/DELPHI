/**
 * Clock voices — woody second knock + minute / hour bells.
 *
 * Every pitch is an integer multiple of the Schumann fundamental (7.83 Hz),
 * chosen from tones that also sit in the NOW-Chord scale (root = 16×, so 24×
 * is its fifth, 18× its second, 27× its sixth, 32× the octave …). Bell
 * partials are kept on that same series, so strikes ring in tune with the
 * chord instead of beating against it.
 *
 * Pure Web Audio builders: callers pass the context, the output node, and a
 * noise buffer. `public/pm-clock-bed.js` (Agon / Mouseion pages) carries the
 * same TUNING table — clockVoices.test.ts keeps the two in step.
 */

export const SCHUMANN_HZ = 7.83;

export const harmonic = (n: number) => SCHUMANN_HZ * n;

export const CLOCK_TUNING = {
  /** Even seconds: body glides 24× → 12× (the fifth, an octave apart). */
  tick: { body: [24, 12], tip: 96, knock: 64 },
  /** Odd seconds: a fourth below the tick (18× → 9×). */
  tock: { body: [18, 9], tip: 72, knock: 48 },
  /** Minute bell on the chord's fifth (12× ≈ 94 Hz). */
  minute: { fundamental: 12 },
  /** Hour bell on the chord root two octaves down (8× ≈ 62.6 Hz), struck 1–12 times. */
  hour: { fundamental: 8 },
  /** Bell partials as multiples of the fundamental — all stay on the 7.83 series. */
  bellPartials: [1, 1.5, 2, 3, 4, 4.5],
  bellLevels: [1, 0.55, 0.38, 0.22, 0.14, 0.08],
  hourGapS: 1.55,
} as const;

export type WoodOpts = { gain?: number; decay?: number };

/** Woody knock — filtered noise "thock" + gliding triangle body + bright tip. */
export function woodKnock(
  ctx: BaseAudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  high: boolean,
  t: number,
  { gain = 1, decay = 1 }: WoodOpts = {},
) {
  const v = high ? CLOCK_TUNING.tick : CLOCK_TUNING.tock;

  const knock = ctx.createBufferSource();
  knock.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(harmonic(v.knock), t);
  bp.Q.setValueAtTime(1.8, t);
  const kg = ctx.createGain();
  kg.gain.setValueAtTime((high ? 0.1 : 0.085) * gain, t);
  kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 * decay);
  knock.connect(bp);
  bp.connect(kg);
  kg.connect(out);
  knock.start(t);
  knock.stop(t + 0.07 * decay);

  const body = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const bg = ctx.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(harmonic(v.body[0]), t);
  body.frequency.exponentialRampToValueAtTime(harmonic(v.body[1]), t + 0.18 * decay);
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, t);
  bg.gain.setValueAtTime((high ? 0.085 : 0.07) * gain, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22 * decay);
  body.connect(lp);
  lp.connect(bg);
  bg.connect(out);
  body.start(t);
  body.stop(t + 0.24 * decay);

  const tip = ctx.createOscillator();
  const tg = ctx.createGain();
  tip.type = "sine";
  tip.frequency.setValueAtTime(harmonic(v.tip), t);
  tg.gain.setValueAtTime(0.03 * gain, t);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 * decay);
  tip.connect(tg);
  tg.connect(out);
  tip.start(t);
  tip.stop(t + 0.05 * decay);
}

/** Feedback delay — the bells' plate / room tail. */
export function echo(ctx: BaseAudioContext, out: AudioNode, delayS: number, feedback: number, wet: number): AudioNode {
  const input = ctx.createGain();
  const delay = ctx.createDelay(2);
  const fb = ctx.createGain();
  const wg = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  delay.delayTime.value = delayS;
  fb.gain.value = feedback;
  wg.gain.value = wet;
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  input.connect(delay);
  delay.connect(lp);
  lp.connect(fb);
  fb.connect(delay);
  lp.connect(wg);
  wg.connect(out);
  return input;
}

/** One bell / gong strike with a long harmonic tail and a soft mallet attack. */
export function bellStrike(
  ctx: BaseAudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  fundamentalHz: number,
  peak: number,
  durationS: number,
  t: number,
) {
  const tail = echo(ctx, out, 0.42, 0.38, 0.32);
  const room = echo(ctx, out, 0.88, 0.25, 0.2);
  CLOCK_TUNING.bellPartials.forEach((mult, i) => {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const f = fundamentalHz * mult;
    osc.type = i === 2 || i === 5 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(f, t);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(3500, f * 6), t);
    lp.frequency.exponentialRampToValueAtTime(400, t + durationS);
    const p = peak * CLOCK_TUNING.bellLevels[i]!;
    // Higher partials die first, like a struck bowl.
    const end = t + durationS * (1 - i * 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(p, t + 0.02);
    g.gain.exponentialRampToValueAtTime(p * 0.35, t + (end - t) * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(lp);
    lp.connect(g);
    g.connect(out);
    g.connect(tail);
    g.connect(room);
    osc.start(t);
    osc.stop(end + 0.05);
  });

  const mallet = ctx.createBufferSource();
  mallet.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(fundamentalHz * 3, t);
  bp.Q.setValueAtTime(1.2, t);
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(peak * 0.3, t);
  mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  mallet.connect(bp);
  bp.connect(mg);
  mg.connect(out);
  mg.connect(tail);
  mallet.start(t);
  mallet.stop(t + 0.14);
}

export function minuteBell(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, t: number) {
  bellStrike(ctx, out, noise, harmonic(CLOCK_TUNING.minute.fundamental), 0.3, 3.2, t);
}

/** Hour bell — one strike per hour on the 12-hour face. */
export function hourBell(ctx: BaseAudioContext, out: AudioNode, noise: AudioBuffer, hour24: number, t: number) {
  const strikes = hour24 % 12 || 12;
  for (let i = 0; i < strikes; i++) {
    bellStrike(ctx, out, noise, harmonic(CLOCK_TUNING.hour.fundamental), 0.34, 3.8, t + i * CLOCK_TUNING.hourGapS);
  }
}
