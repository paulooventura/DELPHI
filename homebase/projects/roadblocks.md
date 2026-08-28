# Roadblocks

Log blockers here so the next agent does not rediscover them. Newest first.

## 2026-08-28 — Homebase was a story with no repo

- `paulooventura/homebase` does not exist on GitHub (public or private visible to this agent).
- Cursor user rules already pointed at `~/Projects/homebase` and `board/QUEUE.md`.
- Delphi closeout rules told agents to update `projects/delphi.md` and run `python scripts/build_index.py` — those files were not in this repo.
- **Mitigation:** `homebase/` in `DELPHI` `main` is the spine until a standalone repo is created.

## 2026-08-28 — Cloud agents clone empty `master`

- GitHub default branch for `paulooventura/DELPHI` is `master` (3 files).
- All real work (415 files, build `2026-08-28d`) is on `main`.
- This Cloud Agent session booted on empty `master`; environment setup failed.
- **Fix (needs Paulo in GitHub UI):** Settings → General → Default branch → `main`.

## 2026-08-28 — GitHub Pages still claims `delphi.pauloventura.org`

- Pages source: `gh-pages` placeholder HTML.
- Live HTTPS currently hits **Vercel** (good).
- If Wix DNS ever flips back to `github.io`, the custom domain shows a blank placeholder.
- **Fix (needs Paulo in GitHub UI):** Repo Settings → Pages → remove custom domain. Leave Pages off or on `gh-pages` without that domain.

## Persistent — phone WebView cache

- iOS Home Screen icons freeze an old Delphi shell.
- Always test with https://delphi.pauloventura.org/fresh in Safari, then re-add the icon.

## Persistent — G: BLACKBOX

- Never delete or mirror-purge `G:\PVProjects`, `G:\Projects`, or creative libraries. Incident 2026-08-07. See `flow/FILES-AND-BACKUP.md`.
