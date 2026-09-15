# AudioBus — master fades, cueing, hand-offs

Module: `lib/audioBus.ts` · knobs: `lib/audioBusConfig.ts`

**One rule:** nothing starts or stops at full volume. Every source ramps through a
GainNode envelope. Hard cuts are the pops.

## Graph

```
[ticks] [chord] [splash] [bed] [media]
     └─► channelGain ─► masterGain ─► limiter ─► destination
```

- Clock marks / bells → `ticks` (via `clockSfx` masterBus).
- Heliodrome NOW-Chord → `chord` (armed after Allow-access).
- Splash / clip beds → `splash` (dry + delay tail).
- Legacy Schumann pad (if revived) → `bed`.
- Future HTMLMedia (Aulos MediaElementSource) → `media`.

## API

| Call | Role |
|------|------|
| `ensureAudioBus(ctx)` | Build once per AudioContext |
| `audioBusInput(channel, ctx)` | Connect sources here — never `destination` |
| `fadeIn` / `fadeOut` | Channel envelopes |
| `crossfade(from, to)` | Screen hand-off |
| `duck` / `unduck` | Soft attenuation (Aulos ducks `chord`) |
| `armHeliodrome()` | Ceremonial ~1.6s wake after Allow |
| `disarmHeliodrome()` | Fade before tear-down |
| `connectClipWithTail(ctx, src)` | Clip dry + delay dissolve |

Tune times / duck dB in `AUDIO_BUS` (`audioBusConfig.ts`).

## Contracts

- Heliodrome starts only after Allow-access unlocks AudioContext, then fades in.
- Splash endings dissolve (fade dry + wet tail), never cut.
- Freeze soft-zeros chord voices with ramps; mute/park fades then suspends.
- Aulos sets `symphonyDuck` → bus ducks chord (~8 dB), does not tear the graph.
- Limiter holds the stacked layers.

## Do not

- Connect new sources straight to `ctx.destination`.
- Instant `.gain.value = 0` / `1` for starts/stops.
- Invent a second AudioContext for playback (mic meter stays separate / input-only).
