# DELPHI

Oracle / sky / clock app, plus **Tonal** and **Studies** on the same domain.

**Live:** [delphi.pauloventura.org](https://delphi.pauloventura.org)  
**Portal (Tonal · Studies):** [delphi.pauloventura.org/portal](https://delphi.pauloventura.org/portal)  
**Stale icon on a phone?** [delphi.pauloventura.org/fresh](https://delphi.pauloventura.org/fresh)  
**Artist hub (Wix):** [www.pauloventura.org](https://www.pauloventura.org)

Canonical git branch is **`main`**. GitHub `master` is an empty Visual Studio skeleton — do not work there.

The map of *all* endeavors (this app, M&V2, stale copies, backup rules, Cursor ↔ Claude) is **[homebase/](homebase/MAP.md)**.

## Dev

```bash
cd agent/web
npm install
npm run dev
```

Open http://localhost:3000. This repo is Delphi; there is no extra `DELPHI/` parent folder in git.

## Deploy

Pushes to `main` deploy Vercel production. Project settings: [docs/DOMAIN.md](docs/DOMAIN.md) (root directory empty, build overrides off). Alias `delphi-wine.vercel.app` follows the custom domain. Legacy Netlify (`palotino.netlify.app`) is unrelated.

Optional keys in `agent/web/.env.local` or Vercel (never commit them): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AIRLABS_API_KEY`. Research Console stays free without them. Aircraft on Sky uses AirLabs when set, otherwise demo traffic.

## Related

| | |
|--|--|
| Game (canonical) | [MV2](https://github.com/paulooventura/MV2) → [play](https://paulooventura.github.io/MV2/) |
| Hub | [homebase/](homebase/) |
| Agent rules | [AGENTS.md](AGENTS.md) |
