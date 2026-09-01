# Portal source → served file

In this GitHub repo there is **no** `portal/src/` tree. The file Vercel serves is:

```
agent/web/public/portal.html
```

## Canonical links (two doors — same domain)

| What you want | URL | What you'll see |
|---|---|---|
| **Live home** (glassy yin-yang after the crystal gate) | **https://delphi.pauloventura.org/** | Allow access → phrase + compass: ↑ sky · ↓ tonal · ← studies · → orrery · center you |
| **Portal** (HTML yin-yang, Tonal, Studies) | **https://delphi.pauloventura.org/portal** | Same doors; Tonal builder + Studies stay here |
| **Force fresh portal** (cache bust) | https://delphi.pauloventura.org/fresh | Redirects to portal with latest build |

If the portal looks stale: open **`/fresh`** in Safari (not a Home Screen icon). Delete any old DELPHI icon from the home screen, open `/fresh`, then re-add if needed.

Confirm you're on the latest build: portal shows **`portal · build 2026-09-01a`** at the bottom; crystal gate shows **`build 2026-09-01a`** at the bottom.

Hosted portal doors deep-link the live Onyx app: Sky → `/?mode=sky`, Orrery → `/?mode=rings`, You → `/?mode=you`. Studies and Tonal stay on the HTML portal. Do not change the `/studies` `/tonal` `/portal` rewrites.

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
