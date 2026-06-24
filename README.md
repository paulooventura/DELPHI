# Cosmos Prowler v7

This repository contains the Cosmos Prowler backend and Next.js frontend.

Quick dev

```bash
cd DELPHI/agent/web
npm install
npm run dev
```

Deploying to production

**Live app:** [delphi-wine.vercel.app](https://delphi-wine.vercel.app)

Pushes to `main` deploy via GitHub Actions (`.github/workflows/vercel-deploy.yml`) when these repository secrets are set:

- `VERCEL_TOKEN` — from [Vercel Account → Tokens](https://vercel.com/account/tokens)
- `VERCEL_ORG_ID` — Project Settings → General
- `VERCEL_PROJECT_ID` — Project Settings → General

**Alternative (no secrets):** In the [Vercel dashboard](https://vercel.com), connect this GitHub repo to the `delphi-wine` project with **Root Directory** = `agent/web`. Vercel will deploy automatically on every push to `main`.

`palotino.netlify.app` is a separate Netlify site; Netlify deploy is optional and requires `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID` secrets.

Legacy GitHub Pages (`delphi.pauloventura.org`) is a placeholder only — not the Next.js app.

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
