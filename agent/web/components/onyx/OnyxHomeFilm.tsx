"use client";

import { useEffect, useRef } from "react";
import { DELPHI_BUILD } from "../../lib/buildStamp";
import { getClockAudio } from "../../lib/clockSfx";
import { AUDIO_BUS, audioBusInput, ensureAudioBus } from "../../lib/audioBus";
import { loadSeamlessLoop } from "../../lib/seamlessLoop";
import { isSymphonyDucked, subscribeSymphonyDuck } from "../../lib/symphonyDuck";

/**
 * Home street background — Paulo's Delphi omphalos seamless loop.
 * Video is silent (public/pneuma-home-omphalos.mp4); its sound plays as a
 * sample-exact Web Audio loop (public/pneuma-home-omphalos-loop.wav, 4.625 s,
 * same period as the picture) on the AudioBus "bed" channel, so the stone
 * switch, tab park and leave fades all apply without extra wiring.
 * Picture is nudged (playbackRate) to stay in phase with the audio clock.
 */

const VIDEO_SRC = `/pneuma-home-omphalos.mp4?v=${DELPHI_BUILD}`;
const LOOP_SRC = `/pneuma-home-omphalos-loop.wav?v=${DELPHI_BUILD}`;

const LOOP_GAIN = 0.7;
const DUCKED_GAIN = 0.28;
const FADE_IN_S = 0.9;
const FADE_OUT_S = 0.6;
const DUCK_S = 0.35;
/** Voice hand-off when re-phasing the audio to the picture. */
const RESYNC_XFADE_S = 0.08;
/** Beyond this the audio restarts at the picture's phase (after resume / long stall). */
const RESYNC_OVER_S = 0.3;
/** Inside this window nothing moves. */
const SYNC_DEADBAND_S = 0.03;
const MAX_RATE_NUDGE = 0.06;
/** A stalled picture must not machine-gun audio restarts. */
const MIN_RESYNC_GAP_S = 1.5;

type Voice = { src: AudioBufferSourceNode; gain: GainNode; startedAt: number; offset: number };

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

export function OnyxHomeFilm({ soundOn = true }: { soundOn?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    const play = () => {
      void v.play().catch(() => {
        /* autoplay may wait for gesture */
      });
    };
    play();
    const onVis = () => {
      if (document.visibilityState === "hidden") v.pause();
      else play();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      v.pause();
    };
  }, []);

  useEffect(() => {
    if (!soundOn) return;
    const v = ref.current;
    const ctx = getClockAudio();
    if (!v || !ctx) return;

    let alive = true;
    let buffer: AudioBuffer | null = null;
    let voice: Voice | null = null;
    let syncTimer = 0;
    let lastResync = -Infinity;
    const master = ctx.createGain();
    master.gain.value = AUDIO_BUS.SILENCE;
    ensureAudioBus(ctx);
    master.connect(audioBusInput("bed", ctx));

    const level = () => (isSymphonyDucked() ? DUCKED_GAIN : LOOP_GAIN);

    const videoPhase = (period: number) => {
      const t = Number.isFinite(v.currentTime) ? v.currentTime : 0;
      return ((t % period) + period) % period;
    };

    const retire = (old: Voice, sec: number) => {
      ramp(old.gain.gain, AUDIO_BUS.SILENCE, sec, ctx);
      try {
        old.src.stop(ctx.currentTime + sec + 0.02);
      } catch {
        /* already stopped */
      }
      old.src.onended = () => {
        try {
          old.src.disconnect();
          old.gain.disconnect();
        } catch {
          /* ignore */
        }
      };
    };

    /** Start a voice at the picture's phase; hand off from any current voice. */
    const startVoice = (xfade: number) => {
      if (!buffer || !alive) return;
      const period = buffer.duration;
      const offset = videoPhase(period);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = xfade > 0 ? AUDIO_BUS.SILENCE : 1;
      src.connect(gain);
      gain.connect(master);
      const startedAt = ctx.currentTime;
      lastResync = startedAt;
      src.start(startedAt, offset);
      if (xfade > 0) ramp(gain.gain, 1, xfade, ctx);
      const prev = voice;
      voice = { src, gain, startedAt, offset };
      if (prev) retire(prev, Math.max(xfade, 0.02));
      v.playbackRate = 1;
    };

    const audioPhase = (vc: Voice, period: number) => {
      const heard = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
      const p = (heard - vc.startedAt + vc.offset) % period;
      return (p + period) % period;
    };

    const sync = () => {
      if (!alive || !buffer || !voice || ctx.state !== "running") return;
      if (v.paused || v.seeking || v.readyState < 3) {
        if (v.playbackRate !== 1) v.playbackRate = 1;
        return;
      }
      const period = buffer.duration;
      let diff = videoPhase(period) - audioPhase(voice, period);
      if (diff > period / 2) diff -= period;
      if (diff < -period / 2) diff += period;
      const mag = Math.abs(diff);
      if (mag > RESYNC_OVER_S) {
        if (ctx.currentTime - lastResync >= MIN_RESYNC_GAP_S) startVoice(RESYNC_XFADE_S);
      } else if (mag > SYNC_DEADBAND_S) {
        const nudge = Math.max(-MAX_RATE_NUDGE, Math.min(MAX_RATE_NUDGE, diff * 0.5));
        v.playbackRate = 1 - nudge;
      } else if (v.playbackRate !== 1) {
        v.playbackRate = 1;
      }
    };

    const onState = () => {
      if (ctx.state === "running" && voice) startVoice(RESYNC_XFADE_S);
    };
    const unsubDuck = subscribeSymphonyDuck(() => ramp(master.gain, level(), DUCK_S, ctx));

    void loadSeamlessLoop(ctx, LOOP_SRC)
      .then(buf => {
        if (!alive) return;
        buffer = buf;
        startVoice(0);
        ramp(master.gain, level(), FADE_IN_S, ctx);
        ctx.addEventListener("statechange", onState);
        syncTimer = window.setInterval(sync, 250);
      })
      .catch(() => {
        /* picture still loops; sound just stays off */
      });

    return () => {
      alive = false;
      window.clearInterval(syncTimer);
      ctx.removeEventListener("statechange", onState);
      unsubDuck();
      v.playbackRate = 1;
      ramp(master.gain, AUDIO_BUS.SILENCE, FADE_OUT_S, ctx);
      const last = voice;
      voice = null;
      window.setTimeout(() => {
        if (last) {
          try {
            last.src.stop();
          } catch {
            /* ignore */
          }
          last.src.disconnect();
          last.gain.disconnect();
        }
        master.disconnect();
      }, FADE_OUT_S * 1000 + 80);
    };
  }, [soundOn]);

  return (
    <div className="onyx-home-film" aria-hidden>
      <video ref={ref} autoPlay muted loop playsInline preload="auto" poster="">
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
    </div>
  );
}
