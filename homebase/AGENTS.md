# Homebase — agent instructions

You are not the only agent. Cursor (this side) and Claude (copy, portal HTML, Tonal/Studies design) share **this folder via git**. Paulo should not paste your output to the other model.

## Non-negotiables

1. **Canonical Delphi branch is `main`.** If the checkout only has `DELPHI.sln`, `.gitignore`, and `.gitattributes`, you are on empty `master`. Run `git fetch origin main && git checkout main` before doing any work.
2. **Live Delphi is Vercel**, not GitHub Pages: https://delphi.pauloventura.org (build stamp in `agent/web/lib/buildStamp.ts`).
3. **Update Homebase when you finish.** `projects/<name>.md`, then `python homebase/scripts/build_index.py`.
4. **Write the other agent’s next step into `board/HANDOFF.md`.** Do not say “paste this to Claude/Cursor.”
5. **Never delete creative media** on `G:\PVProjects`, `G:\Projects`, or any BLACKBOX library. See `flow/FILES-AND-BACKUP.md`.
6. **Chorus is not Delphi.** Do not mix Chorus naming, worlds, or paths into this repo.

## Read order for a new session

1. `homebase/MAP.md`
2. `homebase/board/QUEUE.md` and `homebase/board/HANDOFF.md`
3. The project card you were asked about (`projects/delphi.md`, `projects/mv2.md`, …)
4. `homebase/projects/roadblocks.md`

## After code changes in Delphi

Follow `.cursor/rules/auto-commit-deploy.mdc`: commit, push `main`, Vercel deploys https://delphi.pauloventura.org. Then Homebase closeout above.
