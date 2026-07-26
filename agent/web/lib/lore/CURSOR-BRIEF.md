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
