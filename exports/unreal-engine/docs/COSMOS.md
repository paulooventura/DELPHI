# COSMOS — merged into main DELPHI

The COSMOS prototype is **unified with the localhost app** at `/`. There is no separate second app.

## One engine

| Layer | Canonical module |
|-------|------------------|
| Real-time clock | `hooks/useCosmicClock` → `lib/cosmic/CosmicClockEngine` |
| Calendar cycles | `lib/cycleSystems.ts` + **13:20** `lib/galacticFrequency.ts` (13 Tones × 20 Tribes) |
| Sky / AR | `components/CelestialSkyView` + `lib/starmap.ts` + `astronomy-engine` |
| Moment reading | `lib/synthesisFromSnapshot.ts` (tab **Moment** on `/`) — tone/tribe code words |
| Weather | `/api/cycles` → Open-Meteo |

`services/astronomyEngine.ts` remains in the repo (validated JD math) but is **not** used by the live UI — the main stack above is canonical.

## Routes

| URL | Behavior |
|-----|----------|
| `/` | Full DELPHI — Clock · Sky · **Moment** · Senses · Oracle |
| `/cosmos` | Redirects to `/?tab=moment` |

## Local dev

```bash
cd agent/web
npm install
npm run dev
```

Open http://localhost:3000 — same app Vercel should serve after deploy.

## World calendars & zodiacs (roadmap)

Full planetary design: **[WORLD-CYCLES.md](./WORLD-CYCLES.md)** — registry architecture, Tier A–D catalog (Hijri, Hebrew, Persian, Chinese lunisolar, Maya Haab/Long Count, Vedic, etc.), UI Atlas, and build phases.

## 13:20 Galactic Frequency

Canonical data: `agent/web/lib/galacticFrequency.ts`

- **13 Tones of Creation** — each with power / action / essence (Magnetic → Cosmic)
- **20 Tribes of Time** — Red/White/Blue/Yellow seals paired to Maya day signs (Dragon → Sun)
- Wired into `CycleSnapshot.galactic`, Moment tab, clock plumb rows, and zeitgeist phrases
- Reference plate: `docs/assets/13-tones-20-tribes.png`

## Vercel

See [DOMAIN.md](./DOMAIN.md): Root Directory empty, build overrides off, repo `vercel.json` handles `agent/web`.
