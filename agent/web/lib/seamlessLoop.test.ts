import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseWavPcm16, resampleLoop } from "./seamlessLoop";

function wav(frames: number[][], rate = 48000): ArrayBuffer {
  const nch = frames[0]!.length;
  const data = frames.length * nch * 2;
  const buf = new ArrayBuffer(44 + data);
  const v = new DataView(buf);
  const s = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, "RIFF"); v.setUint32(4, 36 + data, true); s(8, "WAVE");
  s(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * nch * 2, true); v.setUint16(32, nch * 2, true); v.setUint16(34, 16, true);
  s(36, "data"); v.setUint32(40, data, true);
  let p = 44;
  for (const f of frames) for (const x of f) { v.setInt16(p, Math.round(x * 32767), true); p += 2; }
  return buf;
}

/** Largest sample-to-sample step across the wrap, relative to the largest step inside. */
function seamRatio(ch: Float32Array): number {
  let inner = 0;
  for (let i = 1; i < ch.length; i++) inner = Math.max(inner, Math.abs(ch[i]! - ch[i - 1]!));
  return Math.abs(ch[0]! - ch[ch.length - 1]!) / inner;
}

describe("parseWavPcm16", () => {
  it("reads interleaved stereo PCM16", () => {
    const pcm = parseWavPcm16(wav([[0.5, -0.5], [0.25, 0], [-1, 1]]));
    expect(pcm.sampleRate).toBe(48000);
    expect(pcm.channels).toHaveLength(2);
    expect(Array.from(pcm.channels[0]!).map(x => +x.toFixed(3))).toEqual([0.5, 0.25, -1]);
    expect(Array.from(pcm.channels[1]!).map(x => +x.toFixed(3))).toEqual([-0.5, 0, 1]);
  });

  it("rejects non-PCM16", () => {
    const b = wav([[0, 0]]);
    new DataView(b).setUint16(34, 24, true);
    expect(() => parseWavPcm16(b)).toThrow("wav-not-pcm16");
  });
});

describe("resampleLoop", () => {
  it("keeps a periodic sine continuous across the seam at 44.1k", () => {
    const n = 48000;
    const src = new Float32Array(n).map((_, i) => Math.sin((2 * Math.PI * 30 * i) / n));
    const out = resampleLoop(src, 48000, 44100);
    expect(out.length).toBe(44100);
    expect(seamRatio(out)).toBeLessThan(1.05);
  });

  it("is a copy when rates match", () => {
    const src = new Float32Array([1, 2, 3]);
    const out = resampleLoop(src, 48000, 48000);
    expect(Array.from(out)).toEqual([1, 2, 3]);
    expect(out).not.toBe(src);
  });
});

describe("shipped home loop", () => {
  const file = path.join(__dirname, "../public/pneuma-home-omphalos-loop.wav");
  const raw = readFileSync(file);
  const pcm = parseWavPcm16(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));

  it("is exactly one video period (4.625 s at 48 kHz)", () => {
    expect(pcm.sampleRate).toBe(48000);
    expect(pcm.channels[0]!.length).toBe(222000);
  });

  it("has no step at the seam bigger than inside the loop, at 48k and 44.1k", () => {
    for (const ch of pcm.channels) {
      expect(seamRatio(ch)).toBeLessThanOrEqual(1);
      expect(seamRatio(resampleLoop(ch, 48000, 44100))).toBeLessThanOrEqual(1);
    }
  });
});
