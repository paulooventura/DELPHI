# DELPHI — The Live Orrery Clock (stacked lanes)

The clock is not rings — it's the rings **unrolled** into horizontal lanes, stacked
vertically, each scrolling left at its own true rate. A living machine you read by
looking down one vertical line. Reached by swiping RIGHT from home.

---

## The concept

Unroll each cyclic ring into a horizontal strip that scrolls leftward. Stack the
strips vertically. A fixed **"now" line** runs down the center of the whole stack —
everything under it is happening right now. Read straight down that line and you're
reading the complete moment, every cycle at once.

- **Fastest at the bottom (south), slowest at the top (north).**
- **Colour encodes speed: a red→blue gradient.** Fast lanes glow red-hot at the
  bottom, cooling through orange/amber/green up to deep blue at the near-still top.
  Colour does real work — the eye reads the speed gradient before any label.
- The spectrum lives IN the lanes; the surrounding UI stays pitch-black + violet, so
  it reads as instruments lit on a dark console, not a rainbow.

## The splash

Swiping right plays a **once-through video** (Midjourney: the 12-ring spinning
orrery, red-core → blue-rim, all rings turning leftward) that resolves into the live
stacked-lanes view — a zoom-in from the whole spinning wheel to the unrolled lanes.
Play once, tap to skip, cold-entry only. Match the video's leftward spin to the
lanes' leftward scroll so it feels continuous.

---

## The 12 moving lanes (fastest → slowest, red → blue)

| # | Lane | Cycle length | Colour | Source |
|---|------|-------------|--------|--------|
| 1 | Milliseconds | 1000 ms | red | display pulse (no qualia) |
| 2 | Seconds | 60 s | red-orange | display pulse |
| 3 | Minutes | 60 min | orange | display pulse |
| 4 | Ghati | ~24 min | orange-amber | Vedic (display; optional qualia) |
| 5 | Muhūrta | ~48 min | amber | `muhurta` (30) — quality-bearing |
| 6 | Planetary hour | ~60 min (unequal) | amber-yellow | `planetary-hour` (7) — quality-bearing |
| 7 | Chinese shí | 2 h | yellow-green | `chinese-shi` (12) — quality-bearing |
| 8 | The day (sunrise→sunset) | 24 h | green | measured arc |
| 9 | Pancawara | 5 days | green-teal | `pancawara` (5) |
| 10 | Moon phase | ~29.5 days | teal-blue | `moon-phase` (8) — measured |
| 11 | Wuku / Tzolk'in | 7 / 260 days | blue | `pawukon-wuku`, `tzolkin-daysign` |
| 12 | Solar season | ~1 year | deep blue | `western-zodiac` season |

Lanes 5–7 are the sub-day quality-bearing rings — they're what make each home-screen
snapshot differ through the day. Lanes 1–4 and 8 are measured motion (the pulse and
the light); they make the machine *look* alive without pretending to a "quality of
this millisecond" no culture named.

## "The slow sky" — the north cluster

Above lane 12, a compact band in the coldest blue holds the near-frozen systems that
don't merit their own moving lane: the precessional drift, the slow decan governance,
the Nakshatra-of-the-Moon (changes ~daily), the Arabic manzil, the numerology root of
the date. Shown as a small stack of near-static labels with their current value — present
in the reading, honestly not "moving" at a watchable pace. This keeps the machine
readable: motion where motion is real, stillness named as stillness.

---

## Rendering (build live, not as video)

- **Canvas or SVG, live** — each lane scrolls at its real computed rate from the
  ephemeris + clocks. Do NOT fake it with a fixed-speed loop; the honesty is that the
  motion is true. `requestAnimationFrame`; compute each lane's offset from actual time.
- Cells within a lane are the cycle's marks (shí animals, wuku names, decan glyphs,
  the moon's face). The cell crossing the now-line glows and is labeled.
- **Tier styling:** measured lanes get a crisp, exact treatment (solid marks, precise
  ticks); celebrated lanes a softer, warmer treatment. The two-tier truth is visible
  here too.
- **Tap a lane** → it expands to explain that system (what it is, its tier, its current
  value, its source) — the teaching surface.
- **Optional — scrub time:** drag the stack left/right along the now-line to move the
  whole machine forward/back, seeing how lanes will align tonight or aligned this
  morning. The fixed now-line makes this natural. (Ship without it first; it's a
  delight-add.)

## Performance

- Milliseconds lane: don't re-render 60fps of text — animate a smooth gradient sweep,
  not ticking numerals, or the GPU cries. The fast lanes are *motion*, not readouts.
- Virtualize off-screen cells; only draw what's near the now-line.
- Pause the RAF loop when the clock tab isn't visible.

## Sonic layers

The Schumann bed stays the planet's continuous voice. Civil seconds / minutes /
hours keep the wood tick and the gongs. Each new measured lane gets a mark when
its **index actually advances** — not a fake loop:

| Lane | Sound |
|------|--------|
| Ghaṭi | clay / wood (~24 min from sunrise) |
| Muhūrta | warmer bowl (~48 min) |
| Planetary hour | bowl pitched to the Chaldean ruler |
| Chinese shí | pentatonic wood (~2 h) |
| Kè | water-clock drip (14.4 min) |
| .beat | high whisper (86.4 s) |
| Sunrise / sunset | two-strike day gate |
| Moon / wuku / pancawara / season | rare slow-sky bowl |

Helek and prāṇa stay silent — too fast; they would drown the second.

## The point

Reading down the now-line, the user sees that the single sentence on the home screen
is the distilled output of this entire turning machine — dozens of independent cultural
cycles, measured and celebrated, resolved into one coherent line about *now*. The awe
is in seeing how much is moving, how independent it all is, and how it still composes.
