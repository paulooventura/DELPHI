# Cosmos Prowler v7

This repository contains the Cosmos Prowler backend and Next.js frontend.

Quick dev

```bash
cd DELPHI/agent/web
npm install
npm run dev
```

Deploying to GitHub + Netlify

This project is built to be local-first and cloud-ready. The UI and intelligence are self-contained in `agent/web`, so the same app can run locally and also deploy to `palotino.netlify.app` without depending on paid APIs.

1. Initialize a git repo and push to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
# create a repo on GitHub and add remote
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
git push -u origin main
```

2. On Netlify, connect this repository to the existing site `palotino.netlify.app`. Set the build command to:

```
npm --prefix DELPHI/agent/web run build
```

and the publish directory to:

```
DELPHI/agent/web/.next
```

3. Add the `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` as GitHub Secrets so the workflow can deploy to `palotino.netlify.app` automatically.

Secrets required for the workflow:
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`

The repository includes `netlify.toml` and a GitHub Actions workflow that deploys to `palotino.netlify.app` on push to `main` and also on a 10-minute schedule so the cloud site stays synchronized.

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
