# DELPHI

Oracle, sky, and clock — plus **Tonal** and **Studies** on the same domain.

**Live:** [delphi.pauloventura.org](https://delphi.pauloventura.org)  
**Portal (Tonal · Studies):** [delphi.pauloventura.org/portal](https://delphi.pauloventura.org/portal)  
**Stale phone icon?** [delphi.pauloventura.org/fresh](https://delphi.pauloventura.org/fresh)  
**Artist hub (Wix):** [www.pauloventura.org](https://www.pauloventura.org)

Canonical git branch is **`main`**. GitHub `master` is an empty Visual Studio skeleton — do not work there.

The map of every endeavor (this app, machines, Cursor ↔ Claude) lives in **[paulooventura/homebase](https://github.com/paulooventura/homebase)** — do not copy that hub into this repo.

COSMOS is the old name for this same app (alias only). GitHub `paulooventura/COSMOS` is a different artist-hub PWA — do not fold it in.

## Dev

```bash
cd agent/web
npm install
npm run dev
```

Open http://localhost:3000. There is no extra `DELPHI/` parent folder in git.

## Two doors, one domain

| Want | URL | What you get |
|---|---|---|
| Sky / clock / you | `/` `/?mode=sky` `/?mode=rings` `/?mode=you` | Onyx Next app |
| Portal compass | `/portal` | Yinyang, Tonal, Studies |
| Studies / Tonal | `/studies` `/tonal` | Same HTML portal, deep-linked |

Do not change those Next rewrites. Do not deploy `master`, GitHub Pages, or Netlify.

On Book the HTML draft is `G:\DELPHI\portal` — copy into `agent/web/public/portal.html` then push `main`. See [docs/PORTAL-SYNC.md](docs/PORTAL-SYNC.md).

## Deploy

Pushes to `main` deploy Vercel production. Settings: [docs/DOMAIN.md](docs/DOMAIN.md) (root directory empty, build overrides off). Alias `delphi-wine.vercel.app` follows the custom domain.

Optional keys in `agent/web/.env.local` or Vercel (never commit them): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AIRLABS_API_KEY`. Research Console stays free without them. Aircraft on Sky uses AirLabs when set, otherwise demo traffic.
