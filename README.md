# Cosmos Prowler v7

This repository contains the Cosmos Prowler backend and Next.js frontend.

Quick dev

- Start backend (from G:/DELPHI):

```bash
cd DELPHI
npx ts-node server.ts
```

- Start frontend (from repo root):

```bash
cd DELPHI/agent/web
npm install
npm run dev
```

Deploying to GitHub + Netlify

1. Initialize a git repo and push to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
# create a repo on GitHub and add remote
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
git push -u origin main
```

2. On Netlify, create a new site from GitHub and connect the repository. Set the build command to:

```
npm --prefix DELPHI/agent/web run build
```

and the publish directory to:

```
DELPHI/agent/web/.next
```

3. (Optional) Add the `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` as GitHub Secrets to allow automatic deploys via workflow.

Secrets required for the workflow:
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`

The repository includes `netlify.toml` and a GitHub Actions workflow to deploy on push when the secrets are configured.

If you want, I can create the GitHub repo for you (you'll need to provide an access token), or guide you through connecting Netlify.
