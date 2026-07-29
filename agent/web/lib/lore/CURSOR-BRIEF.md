# DELPHI — The Lore Engine · Cursor Build Brief

Everything under `agent/web/`. Alias `@/*` → `agent/web/*`. Tests: Vitest.

Do the parts **in order**. Confirm `npx tsc --noEmit` and `npx vitest run` pass at each
checkpoint before moving on. Several parts have a non-negotiable invariant — those
are called out with ⚠ and must have a passing test before you proceed.

---

## The vision, in one paragraph (so every decision serves it)

Delphi reads a single moment in time through every way humanity has learned to read
the sky, then distills that chorus into one clear picture of *now*. The divergences
between traditions are the point, not noise — that's why the clock has many rings.
The app is a grounding instrument: the compass orients you to *here*, the sky map to
*what's above here*, the lore to *how the people of here have read this sky*. Land
first. Precision and mystery are not in tension — the precision is what lets the
breadth mean something. And honesty about *what each thing is* is the whole integrity:
computed facts vs. authored interpretation vs. drawn divination, each labeled, never
faked, sacred traditions never fabricated.

---

## Files provided (drop these in first)

```
lib/lore/qualia.ts        — 228 entries, 17 systems, scored on 8 axes (generated; don't hand-edit)
lib/lore/compose.ts       — the distillation engine (resonance / tension / distill / composeMoment)
lib/lore/geoHeritage.ts   — land-first foregrounding + land acknowledgment
lib/lore/cast.ts          — the crypto-random divination draw
```

They compile together as-is. `qualia.ts` is generated from `master.py` + `complete.py`
(kept in the repo for regeneration, not shipped). If you edit vocabulary, edit the
Python source and regenerate — never hand-edit `qualia.ts`.

The **eight axes** (each −1..+1): active·rising·steady·warm·outward·binding·gentle·light
(poles: receptive·falling·restless·cool·inward·dissolving·fierce·shadow).

---

## PART 0 — Fix the Tzolk'in count (BLOCKER — the day-sign feeds the chord)

Still open from earlier and it blocks Part 1, because Tzolk'in day-sign + tone are
computed inputs to the moment.

- Reference (GMT 584283 converter) gives **1 Ak'b'al, Long Count 13.0.13.14.3** for
  2026-07-24; the app currently shows 2 Kan. Compare our Long Count to
  `13.0.13.14.3` — if Long Count matches but Tzolk'in doesn't, the modulo-260
  indexing is off by one; if Long Count also disagrees, the correlation constant is
  wrong. Use the **local civil date**, not the UTC instant.
- `galactic1320` (Dreamspell) still just relabels the Tzolk'in kin — flipping the
  Maya-correlation dropdown moves both. Give Dreamspell its **own anchor + Feb-29-skip
  rule**, reading only from `ctx`. Once independent, the correlation dropdown must
  stop affecting the Dreamspell card.

⚠ **Checkpoint:** golden test asserts `1 Ak'b'al` (kin 121) for 2026-07-24, and a
Feb-28/29/Mar-1 2024 test shows traditional Tzolk'in advancing through the leap day
while Dreamspell holds. `tsc` clean.

---

## PART 1 — The moment resolver (what's active *now*)

Build `lib/lore/resolveMoment.ts`: given `(jd, lat, lon)`, return the ~9 **computed**
entries active at this instant, by id, from `momentPool()`. Wire each to real data —
mostly from PHASE, which you already have:

| System              | How to resolve the active entry |
|---------------------|--------------------------------|
| Western sign        | Sun's tropical ecliptic longitude → 30° bin → `wz-*` (PHASE `tropical-year`) |
| Vedic sidereal sign | Sun's **sidereal** longitude (tropical − ayanamsa ~24°) → `vsz-*` (the divergence is intended) |
| Moon phase          | PHASE `lunar-synodic` → 1 of 8 `mp-*` |
| Moon's nakshatra    | Moon's **sidereal** longitude / 13°20′ → `nk-*` (MEASURED — ephemeris, not lookup) |
| Chinese animal      | Year branch → `cz-*` |
| Wu Xing             | Year's Heavenly-Stem element → `wx-*` |
| Planetary day       | Day of week → `pd-*` |
| Tzolk'in day-sign   | Today's kin day-sign (from the FIXED count) → `tz-*` |
| Tzolk'in tone       | Today's kin tone 1–13 → `tn-*` |
| Egyptian decan      | Ecliptic 10° band currently rising → `dc-*` |

⚠ **Invariant test:** the resolver returns only `nature === "computed"` entries. A
`cast` or `birth` entry in the moment set is a broken promise — assert it never happens.

**Checkpoint:** `resolveMoment(jdNow, lat, lon)` returns the correct ~9 ids for now.
`composeMoment(active, lat, lon)` from `compose.ts` produces resonance + tension.
Verify the Leo/Horse steady tension appears today. `tsc` clean.

---

## PART 2 — The distilled phrase (home-screen text)

`compose.ts` gives two paths:
- `distillTemplate(chord)` — deterministic, offline, the **fallback**.
- `buildPrompt(chord)` — returns `{system, user}` for a model call.

Wire the **model path** via the API-in-artifacts pattern (Sonnet). The system prompt
in `buildPrompt` is already strict: one sentence, name the *chord* not the inputs,
honor tension, banned words (energy/vibes/manifest/align/journey/universe).

- **Always** fall back to `distillTemplate` if the call fails or returns >1 sentence
  or contains a banned word. The home screen must never block on the network.
- Cache the day's phrase (key on date + rounded coords). Don't regenerate per render.

**Checkpoint:** home shows one distilled sentence about now, computed-only, with a
graceful offline fallback. `tsc` clean.

---

## PART 3 — Land-first geo-heritage

`geoHeritage.ts` provides `resolveHeritage(lat,lon)`, `foregroundByLand(active,regions)`,
`landCalendar(regions)`. `composeMoment()` already calls them. Wire the UI:

1. **Foreground:** the reading leads with the land's own traditions (Nashville →
   Cherokee framing + `southeast-woodlands`/Cherokee first; Cyprus → Greek/Babylonian
   first). The full chorus is still present, just ordered — one tap shows all.
2. **Land calendar:** `landCalendar(regions)` returns the current honest calendar of
   place (e.g. which Cherokee moon we're in). Show it as a **calendar**, never a
   personality reading — these entries have no polarity by design.
3. **Acknowledgment:** `resolveHeritage().acknowledgment` returns the land
   acknowledgment. Surface it **at the location fix** (the splash / compass "locating"
   moment), tied to coordinates. This is first-class, not a footnote.

⚠ **Honesty invariant:** `honesty: "acknowledge"` traditions (Aboriginal, etc.) have
NO qualia entries — they surface *only* as the acknowledgment + outward link, never as
scored qualities. `honesty: "foreground"` traditions (Cherokee moons) appear only via
`landCalendar`, never in the personality chord. Test: no `foreground`/`acknowledge`
entry ever enters `compose()`.

**Note on the starter `LANDS` table:** the bounding boxes are coarse and the
acknowledgment text is a starting point. Before production, resolve Indigenous
territory against a real dataset (e.g. Native Land Digital) and **verify each
acknowledgment with the nation's own cultural office**. Leave a `// TODO(verify)` on
each `acknowledge` block.

**Checkpoint:** Nashville coords foreground the Cherokee moon + show the acknowledgment;
a neutral-ocean coord foregrounds nothing and shows the full global chorus. `tsc` clean.

---

## PART 4 — The three-layer app (maps onto the onyx descent)

- **HOME** (street→sky→moment in the descent): the computed moment-chord sentence +
  the onyx tarot-style sigil. Math only. No birthday, no cast. Default open.
- **YOU** (opt-in, birth data): compose the personal chord from `personPool()` at the
  natal moment; show where the person resonates/clashes with now. Birth data computed
  and stored **locally only**, never transmitted (show that in the UI).
- **CAST** (opt-in side-door, not part of the vertical descent): see Part 5.

**Decomposition view** ("tap to see why"): `decompose(chord)` traces the chord back to
each tradition, provenance intact — Leo gave radiance, Horse gave restlessness, here's
the clash. Surface `source` + `claim` verbatim. This is the honesty layer made visible.

---

## PART 5 — The cast layer (divination)

`cast.ts` provides `castReading(system, count)` and `CAST_SYSTEMS`.

⚠ **The one detail that IS the feature:** selection uses `crypto.getRandomValues()`
with rejection sampling (in `drawIndex`). Never `Math.random()`. Do not "simplify" it.

- The user chooses **whether** to cast and **which** tradition: tarot (22), Orisha (8),
  I Ching (8), runes (8) — or none. Never automatic, never on home.
- Show `CAST_FRAMING[system]` honestly. Orisha especially: "a reflective draw inspired
  by the 16-cowrie method," **not** "your Ifá reading." Keep that framing verbatim.

**Checkpoint:** a chosen cast returns an unbiased draw with correct framing; no cast
path touches the home chord.

---

## PART 6 — Two disclaimers

- **Settings/About** (integrity anchor): calendar readings computed from real
  astronomical positions to the arcminute; tarot/Ifá/I-Ching/rune draws are genuine
  cryptographic-random casts; nothing predicts the future; offered as a mirror for
  reflection. Name the honesty tiers (computed / drawn / acknowledged).
- **In-the-moment** (light touch, at the card turn): e.g. "drawn just now, for you."
  Don't lecture at the moment of reflection.

---

## PART 7 — Onyx skin (from the earlier design files)

Bring the design references (`delphi.html`, `delphi-sky.html`, `delphi-splash.html`,
`onyx-tokens.css`) into the app:
- Adopt `onyx-tokens.css` into `observatoryTokens.ts` — pitch-black ground, one violet
  light, glass surfaces, three claim-marks, weighted motion.
- Re-skin the clock, sky view, and moment/attunement surfaces.
- Splash: play-once → transition into HOME (not looped); skip on tap; cold-start only.
- Ambient haptic pulse: **default the per-second tick OFF, keep the felt minute**; the
  slide-stone quiets it. Note: `navigator.vibrate` is Android-only in browsers — on
  iOS the visual pulse carries it, or wrap native (Capacitor → `UIImpactFeedbackGenerator`).

---

## Build order summary

0. Fix Tzolk'in (blocker) → test
1. Moment resolver → invariant test (computed-only)
2. Distilled phrase + fallback
3. Geo-heritage → honesty invariant test
4. Three-layer app
5. Cast layer (crypto draw)
6. Disclaimers
7. Onyx skin

Parts 0–3 are the engine and must be in order. 4 is UI on a working engine. 5–7 are
independent and can follow. Confirm `tsc` + the two invariant tests pass before Part 4.

## The invariants, collected (each needs a passing test)

1. Tzolk'in reads `1 Ak'b'al` for 2026-07-24; Dreamspell computes independently.
2. The moment-chord contains only `nature: "computed"` entries.
3. `foreground`/`acknowledge` entries never enter `compose()`.
4. The cast uses crypto entropy + rejection sampling; no cast entry touches home.

---

# ADDENDUM — Full-fidelity casts + the three-phase ritual

Supersedes the cast portions above. New files: `casting.ts` (ritual engine),
`ASSET-MANIFEST.md` (the Midjourney/SVG assets). `qualia.ts` is regenerated to
356 entries with full cast decks.

## The decks are now full fidelity

- **Tarot 78** — `tarot-major` (22) + `tarot-minor` (56). Use `tarotDeck()` for
  the full 78-card draw. Cards carry `arcana`/`suit`/`rank`.
- **I Ching 64** — `iching-hexagram`, carry `hexNum`/`pinyin`. (The 8 trigrams
  were removed; hexagrams are what a cast yields.)
- **Runes 24** — `rune-cast`, Elder Futhark, `futhark: "elder"`. No blank rune.
- **Orisha 8** — UNCHANGED. Do not expand toward the 256 odu. This is the honesty
  boundary; the framing ("reflection in the spirit of the tradition, not a
  babalawo's reading") is load-bearing, not decoration.

## The three-phase ritual (casting.ts)

Every cast is BEFORE → DURING → AFTER, mapped to the Resonant Consent arc. Build
it as a state machine:

- **BEFORE (Introduction):** the screen stills; narration frames it honestly
  (mirror, not forecast); the user chooses a **depth** from `DEPTHS[realm]`
  (tarot: one/three/celtic-cross · runes: draw-1/3/5/scatter · iching: hexagram ·
  orisha: cowrie); holds a question; touches GREEN to proceed.
- **DURING (Experience):** the realm's ritual animation plays (see manifest);
  `performCast(cfg)` resolves the crypto draw *inside* the gesture; objects emerge
  into positions. YELLOW (slow) and RED (stop) are live the whole time.
- **AFTER (Conclusion):** the reading resolves with positions + meanings +
  provenance; narration invites integration; GREEN saves, RED releases cleanly.

Each realm has its own verb, honored by `performCast`:
- Tarot is **laid** — draw from 78 into positional spreads; upright/reversed is a
  crypto coin.
- I Ching is **built** — six lines bottom-up via 3-coin throws (6/7/8/9); changing
  lines transform the primary hexagram into a second ("moving toward"). King Wen
  lookup is in `casting.ts` and is verified (all-yang→1, all-yin→2, Peace→11).
- Runes are **cast** — draw (1/3/5) or scatter (5–9, face-up/down, reversed).
- Orisha is **counted** — 16 cowries, count mouth-up → maps to one of 8.

## The gemstones (green/yellow/red)

`STONES_BY_PHASE` says which are active per phase. Render as onyx SVG (crisp,
animatable, ~64–96px). They are the Resonant Consent cue system made touchable —
GREEN proceed/save, YELLOW pause/slow, RED stop/release. Always reachable; the
user is never trapped in a cast.

## The narration

`NARRATION[phase][realm]` (+ `.common`) holds the lines. Show them timed to each
phase. They teach the real mechanism AND hold the honest frame. Keep the Orisha
line verbatim.

## Assets

Per `ASSET-MANIFEST.md`. Build an asset-slot system: images drop into named slots
(`tarot/major/00-the-fool.png`, `iching/11.png`, `runes/fehu.png`,
`orisha/ogun.png`) and render as they arrive. Until an asset lands, show a
placeholder onyx glyph (the entry's `glyph` field). Nothing blocks on complete
art. Recommend: render I Ching hexagram figures and rune glyphs as **SVG**
(geometric, animate better); use Midjourney for the 78 tarot faces, 8 Orisha
emblems, and the 5 ritual animations.

## New invariants (add tests)

5. `tarotDeck()` returns exactly 78; a tarot cast never repeats a card.
6. I Ching: `performCast` produces a valid King Wen number 1–64; changing lines
   yield a different transformed hexagram.
7. Every `performCast` outcome draws only `nature: "cast"` entries.
8. Orisha pool stays length 8; no code path expands it.

---

# ADDENDUM 2 — The layered, living moment phrase

`compose.ts` exports `composeLayers()` and `layerPrompt()`. Build the home
reading as user-chosen layers — consistent math, transparent lore.

## The three layers (composeLayers)

- **Layer 0 — "The moment"** — computed-only, the ground truth. Enforced: even if
  a cast/birth entry is passed, Layer 0 strips to `nature: "computed"`. Two users
  in the same place at the same time get the SAME Layer 0. Recompute only when the
  sky rolls over (active moment-entries change — roughly hourly), never on a timer
  or per render. Cache per (date-hour + rounded coords).
- **Layer 1 — "The moment, through you"** — appears only when birth data is set.
  Folds natal entries onto Layer 0. Labeled. Layer 0 stays intact beneath.
- **Layer 2 — "…coloured by what you drew"** — appears only after a cast. Folds
  drawn entries onto the top layer. Labeled. Persists until cleared or the day turns.

## Rules (the whole point)

- **Consistent math, transparent lore.** Layer 0 is pure and identical for
  everyone at that place/instant. The lore layers always show a label naming
  exactly what they add, and offer one-tap return to Layer 0.
- **The user chooses how to read.** Let them switch freely between available
  layers; `composeLayers({active})` sets which is showing. Default to the deepest
  available, but the choice is theirs and sticky.
- **Additive and reversible.** Dropping a layer returns the one beneath, unchanged
  — we rebuild from entry sets, never mutate lower layers.
- **Freshness from truth, not churn.** Recompose on real events only: sky rolls
  over, birth data added, card drawn, layer toggled. The phrase should feel
  authored and stable, never shuffled.
- Every layer distills with the same chorus-wide voice (`layerPrompt` → the model;
  name the emergent character, never the systems). Fall back to `distillTemplate`
  on the active layer's chord.
- Decomposition ("tap to see why") reflects the ACTIVE layer, tracing its phrase
  back to every contributor, each labeled by `nature` (moment / natal / drawn).

## Test (add)

9. Layer 0 is identical for two users at the same place+instant, and stays
   computed-only even if cast/birth entries are passed to `composeLayers`.
10. Adding natal input yields a distinct Layer 1 without changing Layer 0;
    drawing yields Layer 2; clearing the draw returns exactly the prior phrase.
