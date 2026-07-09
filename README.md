# Cosmos Prowler v7

This repository contains the Cosmos Prowler backend and Next.js frontend.

Quick dev

```bash
cd DELPHI/agent/web
npm install
npm run dev
```

Deploying to production

**Live app:** [delphi.pauloventura.org](https://delphi.pauloventura.org)  
**Artist hub (Wix):** [www.pauloventura.org](https://www.pauloventura.org)

See [docs/DOMAIN.md](docs/DOMAIN.md) for DNS setup (CNAME `delphi` → Vercel).

Pushes to `main` deploy via Vercel Git integration or `.github/workflows/vercel-deploy.yml` (requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).

In Vercel → project **delphi** → use **Mode A** in [docs/DOMAIN.md](docs/DOMAIN.md) (Root Directory empty, overrides off).

`delphi-wine.vercel.app` redirects to the custom domain. Legacy Netlify (`palotino.netlify.app`) is unrelated.

Local usage:

```bash
cd DELPHI/agent/web
npm install
npm run dev
```

Open `http://localhost:3000` for the same local UI and intelligence.

No external credit-based or API-token-based services are required by default. The Research Console scavenges only free, no-key sources (Crossref, PubMed, arXiv, OpenAlex, Semantic Scholar, Wikipedia, Wikidata, DuckDuckGo, OpenLibrary, Stack Exchange, HackerNews, Reddit) and cross-references them with local logic, so it stays free and lightweight by default.

Optional: AI cross-check

If you already have your own API key(s) for OpenAI, Anthropic, and/or Google Gemini, set any of the following in `agent/web/.env.local` to have the Research Console additionally cross-check its free-source findings against those models (every key you provide gets queried, not just one):

```
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
```

These are entirely optional — with none set, zero paid calls are ever made. The app only spends a key's quota you've explicitly provided, and only on the final synthesis step (not every phase).

### Optional: live aircraft (AirLabs)

For real ADS-B traffic on the Sky tab, add your [AirLabs](https://airlabs.co/) API key to Vercel (or `agent/web/.env.local` locally):

```
AIRLABS_API_KEY=your_key_here
```

With the key set, the app uses AirLabs for:

- **Live flights** within ~250 km of your GPS (`/api/v9/flights`)
- **Nearest airport** context on the sky HUD and catalog (`/api/v9/nearby`)
- Rich aircraft tap-details: route (dep→arr), airline, aircraft type, registration, status, vertical rate

Without the key, demo traffic is shown so the sky layer still works offline.

Other AirLabs endpoints (schedules, airlines DB, routes) can be wired later for departure boards and flight lookup.
