# Map — one universe, no duplicates

Verified 2026-08-28 from GitHub + live HTTP. If a chat, iCloud note, or old clone disagrees with this page, **this page wins** until someone updates it in git.

## Live doors (use these)

| Endeavor | Open this | What it is | Canonical git |
|----------|-----------|------------|---------------|
| **DELPHI sky / clock / crystal** | https://delphi.pauloventura.org | Next.js app on Vercel | `paulooventura/DELPHI` **`main`** |
| **Portal · Tonal · Studies** | https://delphi.pauloventura.org/portal | Same domain, `portal.html` | same repo / same branch |
| **Force a fresh portal** | https://delphi.pauloventura.org/fresh | Cache-bust redirect | same |
| **M&V2 (the game)** | https://paulooventura.github.io/MV2/ | Browser platformer, Pages from `main` | `paulooventura/MV2` **`main`** |
| Artist site | https://www.pauloventura.org | Wix hub (not git) | — |

Current Delphi production stamp: **`2026-08-28d`** (`agent/web/lib/buildStamp.ts`). If a phone shows an older shell, open `/fresh` in Safari (not a Home Screen icon).

## Stale traps (do not work here)

| Trap | Why it exists | What to do |
|------|---------------|------------|
| GitHub default branch **`master`** on DELPHI | Empty VS skeleton (3 files, June 2026). Cloud agents clone this and think the repo is blank. | Checkout **`main`**. Change GitHub default branch to `main`. |
| GitHub Pages **`gh-pages`** | Placeholder “add your Delphi project when ready” still claims custom domain `delphi.pauloventura.org`. | Remove Pages custom domain. Real app is Vercel. |
| Repo homepage `delphi-wine.vercel.app` | Old Vercel alias. It still works as a redirect. | Prefer `delphi.pauloventura.org`. |
| `paulooventura/Mind-and-Venture` | Older game copy. Custom domain `mindandventure.pauloventura.org` last shipped **2026-07-09**. | Play **MV2**. Treat this repo as archive. |
| `paulooventura/COSMOS` | Early PWA prototype (June 2026). | Merged into DELPHI. Do not revive. |
| Nested `G:\DELPHI\DELPHI-main` vs `cd DELPHI/agent/web` | README used to pretend this repo lives *inside* another DELPHI folder. | This repo **is** Delphi. Dev is `cd agent/web`. |

## What sits inside DELPHI (not separate apps)

- **Tonal** — events / RESONANCE builder on `/tonal` and `/portal`
- **Studies** — `/studies` (same portal)
- **COSMOS sky map** — `/` sky tab in the Next.js app
- **Homebase** — this folder

## Not on this GitHub (local / other)

These names appear in machine notes. They are **not** `paulooventura/*` public repos as of 2026-08-28:

- `homebase` as its own GitHub repo — **missing**; this folder is the stand-in
- `cursor-voice-agent` / Paula / PVC — Mac/Windows local
- Chorus — separate research engine; never mix into Delphi

## How data should flow

```
board/QUEUE.md  →  agent does work in the canonical repo  →  push canonical branch
        ↓                                                      ↓
 board/HANDOFF.md  ←  other agent reads git, not Paulo   live URL updates
        ↓
 projects/<name>.md + INDEX.md
```

Paulo decides. Agents write. Git is the bus.
