# DELPHI — Midjourney Asset Manifest

Everything the Cast experience needs you to generate, with exact counts, naming,
dimensions, and a locked style so the sets stay consistent.

---

## THE LOCKED STYLE (paste into every prompt)

The single most important thing: every asset must read as ONE deck. Midjourney
drifts between generations, so append this exact suffix to every prompt and use
the same `--style` reference where possible.

```
… rendered in violet line-light on pitch-black onyx, faceted geometry, glowing
from within like a gem on black velvet, hairline cold-violet (#8A7BFF) strokes,
machined precision, no background texture, centered, symmetrical, dark UI asset
--ar {see below} --style raw --stylize 150
```

Keep `--stylize` low (150) so MJ doesn't wander off-brief. Generate a few, pick
the one that matches the onyx world, and — critically — **use it as an image
prompt / style reference for the rest of that set** so all cards in a suit match.

Transparent-ready: generate on pure black (#000), and the app composites them on
the onyx ground. If you can export PNG with alpha, better.

---

## 1 · TAROT — 78 card faces + ritual

**Card faces (78 individual PNGs).** Each the tarot figure as an onyx tablet,
its central image drawn in violet line-light.

Slots (the app expects these filenames):
```
tarot/major/00-the-fool.png … 21-the-world.png        (22)
tarot/wands/ace.png … king.png                         (14)
tarot/cups/ace.png … king.png                          (14)
tarot/swords/ace.png … king.png                        (14)
tarot/pentacles/ace.png … king.png                     (14)
```
- **Dimensions:** `--ar 2:3` (card proportion), export ~800×1200.
- **Consistency tip:** generate each SUIT as a batch with one style reference so
  the 14 cards of a suit share a visual signature (their element's tint within
  the violet range — Wands slightly warmer, Cups cooler, etc., but all onyx).

**Ritual animation (DURING phase):** a shuffle-and-lay sequence — the deck
riffles, cuts, and cards glide face-down into position, then flip.
- Slot: `tarot/ritual-shuffle.mp4` (or a sprite sequence).
- **Dimensions:** 1080×1080 or 1080×1920 (portrait), 2–4 s, loops into the reveal.

---

## 2 · I CHING — 64 hexagrams + coin ritual

**Hexagram figures (64).** Each is six horizontal lines (yang = solid, yin =
broken) drawn in violet light on onyx. *These can be pure SVG* (they're
geometric) — but if you want MJ atmosphere behind them, generate a backing
texture and composite the lines in code.
```
iching/01.png … 64.png            (64 — or render as SVG line-figures)
```
- **Dimensions:** `--ar 1:1`, ~800×800.
- **Recommendation:** render the six lines as SVG in the app (perfectly crisp,
  animatable line-by-line), and skip MJ for these unless you want a painted
  backdrop. The line-by-line *build* is the ritual — SVG animates it best.

**Ritual animation (DURING):** three coins thrown, six times — each throw resolves
into one line that draws itself from the bottom up.
- Slot: `iching/ritual-coins.mp4`.
- **Dimensions:** 1080×1920, ~4–6 s (it's the longest ritual — six throws).

---

## 3 · RUNES — 24 stone faces + cast ritual

**Rune faces (24).** Each an Elder Futhark glyph carved in violet light on a dark
stone.
```
runes/fehu.png runes/uruz.png … runes/othala.png     (24, Elder Futhark order)
```
- **Dimensions:** `--ar 3:4` (stone proportion), ~600×800.
- **Consistency:** these are simple glyphs — very easy to keep consistent, or
  render as SVG. MJ gives them stone texture; SVG gives them crisp glow. Your call.

**Ritual animation (DURING):** two options, since the app offers both depths —
- `runes/ritual-draw.mp4` — a hand reaches into a pouch, pulls a stone.
- `runes/ritual-scatter.mp4` — stones tumble across a dark cloth and settle,
  some face-up (lit) some face-down (dim).
- **Dimensions:** 1080×1920, 2–4 s each.

---

## 4 · ORISHA — 8 emblems + cowrie ritual

**Orisha emblems (8).** Each an abstract, respectful sigil for the principal
Orisha — NOT figurative depictions of the deities (avoid literal representation;
use their associated symbol/color-in-violet: Ogun's iron, Yemoja's waters,
Shango's axe, Oshun's river, etc., all in the onyx-violet language).
```
orisha/eshu.png orisha/ogun.png orisha/yemoja.png orisha/oshun.png
orisha/shango.png orisha/oya.png orisha/obatala.png orisha/orunmila.png   (8)
```
- **Dimensions:** `--ar 1:1`, ~800×800.
- **Respect note:** keep these symbolic/emblematic, not portraiture. This set
  most needs a light, reverent hand — when in doubt, more abstract.

**Ritual animation (DURING):** sixteen cowrie shells cast onto a mat and settle;
some land mouth-up (open, lit), some mouth-down.
- Slot: `orisha/ritual-cowries.mp4`.
- **Dimensions:** 1080×1920, 2–4 s.

---

## 5 · THE THREE GEMSTONES (green / yellow / red)

The consent stones — present through the whole ritual. **Render as SVG in the
app**, not MJ — they must be crisp, animatable (glow when active, dim when not),
and pixel-perfect at small sizes. Spec for Cursor, not for you:
```
stone-green  (proceed / draw / save)
stone-yellow (pause / slow)
stone-red    (stop / release)
```
Faceted, lit-from-within, in the onyx language, ~64–96px touch targets.

---

## Summary of what to generate in Midjourney

| Set             | Count | AR    | Notes |
|-----------------|-------|-------|-------|
| Tarot faces     | 78    | 2:3   | batch per suit w/ style ref |
| Tarot ritual    | 1     | 9:16  | shuffle-and-lay |
| I Ching figures | 0–64  | 1:1   | prefer SVG; MJ only for backdrop |
| I Ching ritual  | 1     | 9:16  | coin throws, ~4–6 s |
| Rune faces      | 0–24  | 3:4   | MJ for stone texture, or SVG |
| Rune rituals    | 2     | 9:16  | draw + scatter |
| Orisha emblems  | 8     | 1:1   | symbolic, not figurative |
| Orisha ritual   | 1     | 9:16  | cowrie cast |

**Minimum MJ set if you want to move fast:** the 78 tarot faces + 8 Orisha
emblems + the 5 ritual animations. Render I Ching and runes as SVG (they're
geometric and animate better in code). That's the highest-impact art, and the
line-based realms stay crisp and consistent for free.

The app is built to drop these into named slots — as each asset lands, it appears.
Nothing blocks on having them all; placeholder onyx glyphs render until the real
art arrives.
