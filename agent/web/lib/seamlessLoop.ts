/**
 * Sample-exact audio loops for Web Audio.
 *
 * Compressed formats (AAC/MP3) pad the start/end with encoder silence, and
 * decodeAudioData resamples with zero-padded edges — both put a click at the
 * loop seam. So loops ship as 16-bit PCM WAV cut to the exact period, parsed
 * here, and resampled to the context rate with wrap-around interpolation.
 */

export type PcmLoop = {
  sampleRate: number;
  /** One Float32Array per channel, each exactly one loop period long. */
  channels: Float32Array[];
};

export function parseWavPcm16(buf: ArrayBuffer): PcmLoop {
  const view = new DataView(buf);
  const tag = (o: number) =>
    String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("not-wav");

  let off = 12;
  let fmt: { channels: number; sampleRate: number; bits: number; format: number } | null = null;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= view.byteLength) {
    const id = tag(off);
    const size = view.getUint32(off + 4, true);
    const body = off + 8;
    if (id === "fmt ") {
      fmt = {
        format: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      dataOff = body;
      dataLen = Math.min(size, view.byteLength - body);
      break;
    }
    off = body + size + (size & 1);
  }
  if (!fmt || dataOff < 0) throw new Error("wav-missing-chunks");
  if (fmt.format !== 1 || fmt.bits !== 16) throw new Error("wav-not-pcm16");

  const nch = fmt.channels;
  const frames = Math.floor(dataLen / (2 * nch));
  const channels = Array.from({ length: nch }, () => new Float32Array(frames));
  let p = dataOff;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nch; c++) {
      channels[c]![i] = view.getInt16(p, true) / 32768;
      p += 2;
    }
  }
  return { sampleRate: fmt.sampleRate, channels };
}

/** Catmull-Rom resample of one full period; indices wrap so the seam stays continuous. */
export function resampleLoop(src: Float32Array, fromRate: number, toRate: number): Float32Array {
  const len = src.length;
  if (fromRate === toRate || len === 0) return src.slice();
  const outLen = Math.max(1, Math.round((len * toRate) / fromRate));
  const step = len / outLen;
  const out = new Float32Array(outLen);
  const at = (i: number) => src[((i % len) + len) % len]!;
  for (let i = 0; i < outLen; i++) {
    const x = i * step;
    const i1 = Math.floor(x);
    const t = x - i1;
    const p0 = at(i1 - 1);
    const p1 = at(i1);
    const p2 = at(i1 + 1);
    const p3 = at(i1 + 2);
    out[i] =
      p1 +
      0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  }
  return out;
}

const cache = new Map<string, Promise<AudioBuffer>>();

/** Fetch a PCM16 WAV loop and build an AudioBuffer at the context's own rate. */
export function loadSeamlessLoop(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const key = `${ctx.sampleRate}|${url}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`loop ${res.status}`);
    const pcm = parseWavPcm16(await res.arrayBuffer());
    const chans = pcm.channels.map(ch => resampleLoop(ch, pcm.sampleRate, ctx.sampleRate));
    const buf = ctx.createBuffer(chans.length, chans[0]!.length, ctx.sampleRate);
    chans.forEach((ch, i) => buf.copyToChannel(ch as Float32Array<ArrayBuffer>, i));
    return buf;
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}
