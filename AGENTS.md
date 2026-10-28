# DELPHI — agent notes

- Work branch: `dev`. Commit and `git push origin dev` after every finished task. Never push `main`.
- Live branch: `main` → Vercel → https://delphi.pauloventura.org. The hourly Homebase Ship (`HOMEBASE\scripts\daily-ship.ps1`) merges `dev` into `main` after tests.
- Do not treat `master` or `gh-pages` as the app.
- Spine for all projects: https://github.com/paulooventura/homebase (`projects/delphi.md`). Do not nest a second Homebase in this repo.
- Portal HTML is `agent/web/public/portal.html`. Hosted Sky / Clock / You deep-link `/?mode=sky|rings|you`. Studies and Tonal stay on the portal file.
- Do not change Next rewrites for `/studies` `/tonal` `/portal`.
- Chorus / PVC is a different product. Do not mix Delphi lore into Chorus.
- Close out app changes: update Homebase `projects/delphi.md`, commit and push `dev`, reply with how to test (live after the next hourly Homebase Ship). Only when Paulo says "ship now": `powershell -File C:\Users\PVProductions\HOMEBASE\scripts\daily-ship.ps1 -Only DELPHI`.
