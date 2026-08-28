---
id: delphi
name: DELPHI
kind: app
status: canonical
repo: https://github.com/paulooventura/DELPHI
branch: main
live: https://delphi.pauloventura.org
build: 2026-08-28d
updated: 2026-08-28
---

# DELPHI

Astro / oracle app: onyx crystal gate, cosmic clock, sky map, Moment readings. **Tonal** and **Studies** live on the same domain via the portal.

## Canonical

| | |
|--|--|
| Git | https://github.com/paulooventura/DELPHI |
| Branch | **`main`** (never `master`, never `gh-pages`) |
| Live | https://delphi.pauloventura.org |
| Portal | https://delphi.pauloventura.org/portal |
| Studies | https://delphi.pauloventura.org/studies |
| Tonal | https://delphi.pauloventura.org/tonal |
| Fresh | https://delphi.pauloventura.org/fresh |
| App code | `agent/web/` (Next.js 16) |
| Portal file | `agent/web/public/portal.html` |
| Build stamp | `agent/web/lib/buildStamp.ts` → `DELPHI_BUILD` |

Pushing `main` deploys Vercel production. Confirm stamp with:

```bash
curl -s https://delphi.pauloventura.org/portal.html | grep "build:"
```

## Doors

- `/` — crystal gate → clock / sky / moment (Next.js)
- `/portal` — yinyang compass, Tonal, Studies (`portal.html`)
- `/fresh` — cache bust → portal with current build query

## Local

```bash
cd agent/web
npm install
npm run dev
```

Open http://localhost:3000 — not `cd DELPHI/agent/web` (this repo already is Delphi).

Windows draft portal (optional, not canonical): `G:\DELPHI\portal\src\DELPHI_portal.html`. Copy into `agent/web/public/portal.html` before commit. Prefer editing the git file so Cursor and Claude are not forked.

## Open / known

- GitHub **default branch is still `master`** (empty). Agents and “Open in GitHub” fetch the skeleton. **Change default to `main`.**
- GitHub Pages `gh-pages` still lists custom domain `delphi.pauloventura.org` (placeholder HTML). Remove it so DNS cannot snap back to a blank page.
- Phone Home Screen icons cache an old shell — users must `/fresh` then re-add.
- Sky orientation on device: portal prototypes verified math; keep watching the live Next.js sky if sensors report `0 events`.
- Draft PRs: #5 environment.json, #3 Capacitor Android, #1 iOS run path.

## Not Delphi

Chorus is a different project. COSMOS GitHub repo is an archive of a prototype already merged here.
