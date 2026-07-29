# Delphi deck builder

Source for tradition-accurate cast symbols (I Ching hexagrams, Elder Futhark, diloggun odu, Tarot structure).

- `realms.py` — vector geometry from each tradition’s defining data
- `build_deck.py` — generate or overlay card images (gold on indigo)
- `symbols_*.png` / `deck_proof_sample.png` — proof sheets

The live CAST tab draws the same figures as SVG via `agent/web/lib/cast/realms.ts` + `CastSymbol.tsx`. Keep those in sync when you change stroke/line data here.

```bash
python build_deck.py --realm iching --mode generate --out ./out/iching --font /path/to/serif.ttf
python build_deck.py --all --mode generate --out ./out
```
