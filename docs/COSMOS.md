# COSMOS — merged into main DELPHI

The COSMOS prototype is **unified with the localhost app** at `/`. There is no separate second app.

## One engine

| Layer | Canonical module |
|-------|------------------|
| Real-time clock | `hooks/useCosmicClock` → `lib/cosmic/CosmicClockEngine` |
| Calendar cycles | `lib/cycleSystems.ts` |
| Sky / AR | `components/CelestialSkyView` + `lib/starmap.ts` + `astronomy-engine` |
| Moment reading | `lib/synthesisFromSnapshot.ts` (tab **Moment** on `/`) |
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

## Vercel

See [DOMAIN.md](./DOMAIN.md): Root Directory empty, build overrides off, repo `vercel.json` handles `agent/web`.
