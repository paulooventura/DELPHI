import { audioBusInput, AUDIO_BUS } from "./audioBus";
import { getClockAudio, isClockAudioSilenced } from "./clockSfx";

/** Air moving past the camera: filtered noise whose level and pitch follow how fast the view turns or zooms. */

const SCHUMANN = 7.83;
const CEILING = 0.11;
const NOISE_SEC = 2;

export type OrreryWhoosh = {
  /** turn: radians per second of yaw/pitch; zoom: |d ln(distance)| per second. */
  update(turn: number, zoom: number): void;
  hush(): void;
  dispose(): void;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createOrreryWhoosh(): OrreryWhoosh {
  let ctx: AudioContext | null = null;
  let src: AudioBufferSourceNode | null = null;
  let band: BiquadFilterNode | null = null;
  let air: BiquadFilterNode | null = null;
  let gain: GainNode | null = null;
  let level = 0;

  const build = (): boolean => {
    if (gain) return true;
    ctx = getClockAudio();
    if (!ctx || ctx.state !== "running") return false;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SEC), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) {
      b = 0.97 * b + 0.03 * (Math.random() * 2 - 1);
      d[i] = b * 6;
    }
    src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = SCHUMANN * 40;
    band.Q.value = 0.8;
    air = ctx.createBiquadFilter();
    air.type = "lowpass";
    air.frequency.value = SCHUMANN * 256;
    gain = ctx.createGain();
    gain.gain.value = AUDIO_BUS.SILENCE;
    src.connect(band);
    band.connect(air);
    air.connect(gain);
    gain.connect(audioBusInput("ticks", ctx));
    src.start();
    return true;
  };

  const glide = (to: number, freq: number, tc: number) => {
    if (!ctx || !gain || !band) return;
    const t = ctx.currentTime;
    gain.gain.setTargetAtTime(Math.max(AUDIO_BUS.SILENCE, to), t, tc);
    band.frequency.setTargetAtTime(freq, t, tc * 1.5);
  };

  return {
    update(turn, zoom) {
      const amount = clamp01(Math.max(turn / 2.4, zoom / 1.8));
      if (isClockAudioSilenced() || (typeof document !== "undefined" && document.hidden)) {
        if (level > 0) glide(0, SCHUMANN * 40, 0.08);
        level = 0;
        return;
      }
      if (amount < 0.02 && level < 0.002) return;
      if (!build()) return;
      const target = amount * amount * CEILING;
      const rising = target > level;
      level = target;
      glide(target, SCHUMANN * (40 + 120 * amount), rising ? 0.06 : 0.18);
    },
    hush() {
      level = 0;
      glide(0, SCHUMANN * 40, 0.12);
    },
    dispose() {
      const s = src;
      const c = ctx;
      glide(0, SCHUMANN * 40, 0.08);
      if (s && c) {
        try {
          s.stop(c.currentTime + 0.5);
        } catch {
          /* already stopped */
        }
      }
      src = band = air = gain = null;
      ctx = null;
      level = 0;
    },
  };
}
