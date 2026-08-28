# Portal source → served file

In this GitHub repo there is **no** `portal/src/` tree. The file Vercel serves is:

```
agent/web/public/portal.html
```

## Canonical links (two doors — same domain)

| What you want | URL | What you'll see |
|---|---|---|
| **Portal** (yinyang compass, Tonal, Studies) | **https://delphi.pauloventura.org/portal** | Oracle phrase, compass, Tonal builder |
| **Sky app** (crystal gate, cosmic clock, sky map) | https://delphi.pauloventura.org/ | Black crystal → Allow access → tabs |
| **Force fresh portal** (cache bust) | https://delphi.pauloventura.org/fresh | Redirects to portal with latest build |

If the portal looks stale: open **`/fresh`** in Safari (not a Home Screen icon). Delete any old DELPHI icon from the home screen, open `/fresh`, then re-add if needed.

Confirm you're on the latest build: portal shows **`portal · build 2026-08-28d`** at the bottom; crystal gate shows **`build 2026-08-28d`** at the bottom.

On Paulo's Windows machine the editable draft lives at `G:\DELPHI\portal\src\DELPHI_portal.html`.
Canonical Claude diffs (`DELPHI_TONAL_CANONICAL.html`) are **diff references only** — never deploy them raw (they lack host wiring).

## Sync workflow (Windows → repo)

1. Edit `G:\DELPHI\portal\src\DELPHI_portal.html` (keep `goLiveOr` / `hostedDeepLink` / `bootPortal`).
2. Copy into the repo:
   ```powershell
   Copy-Item -Force G:\DELPHI\portal\src\DELPHI_portal.html G:\DELPHI\DELPHI-main\agent\web\public\portal.html
   ```
3. Confirm the HTML comment near the top: `<!-- build: … -->`.
4. Commit + push `main` → Vercel Production auto-deploys `delphi.pauloventura.org`.

## Prove live == latest

```bash
curl -s https://delphi.pauloventura.org/portal.html | grep "build:"
curl -s https://delphi.pauloventura.org/ | grep -o "build 2026[^<]*"
```

Homepage crystal screen shows `build {DELPHI_BUILD}` from `agent/web/lib/buildStamp.ts`.
