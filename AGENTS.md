# Delphi — agent OS

This repository **is** DELPHI. Canonical branch is **`main`**. Live site is **https://delphi.pauloventura.org**.

If the tree is only `DELPHI.sln` + gitignore, you cloned **`master`** (empty June 2026 skeleton). Fix:

```bash
git fetch origin main
git switch main
```

Then read **[homebase/MAP.md](homebase/MAP.md)** and **[homebase/AGENTS.md](homebase/AGENTS.md)**. That hub is how Cursor and Claude stay in sync without using Paulo as a courier.

## Work in the right place

| Job | Path |
|-----|------|
| Sky, clock, crystal, sensors | `agent/web/` (Next.js) |
| Portal, Tonal, Studies | `agent/web/public/portal.html` (rewrites `/portal`, `/studies`, `/tonal`) |
| Hub / queue / backup rules | `homebase/` |
| Domain / DNS | `docs/DOMAIN.md` |

Dev: `cd agent/web && npm install && npm run dev` → http://localhost:3000

## Closeout

1. Commit and push (see `.cursor/rules/auto-commit-deploy.mdc`).
2. Update `homebase/projects/delphi.md`.
3. `python homebase/scripts/build_index.py`
4. Write `homebase/board/HANDOFF.md` for Claude — do not ask Paulo to paste a prompt.
