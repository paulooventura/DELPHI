# Git canon — one repo, one branch, one live URL

If two links disagree, the **canonical** column wins.

## Source of truth

| Project | Canonical remote | Canonical branch | Live URL | How it deploys |
|---------|------------------|------------------|----------|----------------|
| DELPHI (app + Tonal + Studies + this Homebase) | `https://github.com/paulooventura/DELPHI.git` | **`main`** | https://delphi.pauloventura.org | Vercel Git on `main` |
| MV2 (game) | `https://github.com/paulooventura/MV2.git` | **`main`** | https://paulooventura.github.io/MV2/ | GitHub Actions Pages |
| Artist hub | Wix | — | https://www.pauloventura.org | Wix editor |

## Delphi branches (what they actually are)

| Branch | Files | Role |
|--------|-------|------|
| `main` | Full app (~415 files) | **Only branch to develop and merge into** |
| `master` | `DELPHI.sln` + gitignore | Empty skeleton. GitHub default as of 2026-08-28. **Do not clone for work.** |
| `gh-pages` | Placeholder HTML + CNAME | Old GitHub Pages. **Do not deploy the app here.** |
| `cursor/*` | Feature branches | Fine. PR them to **`main`**. |

Clone the real app:

```bash
git clone -b main https://github.com/paulooventura/DELPHI.git
cd DELPHI
git switch main   # if you already cloned and landed on master
```

If `git status` shows a nearly empty tree, you are on `master`. Switch.

## Aliases (ok to open, not ok to develop against)

- https://delphi-wine.vercel.app — Vercel alias, should follow `main`
- https://paulooventura.github.io/Mind-and-Venture/ → redirects to the **old** game domain
- https://mindandventure.pauloventura.org — **stale** (July 2026). Canonical play URL is MV2 Pages.

## What Homebase is (and is not)

- Homebase is **context**: maps, queues, closeout, backup rules.
- Homebase is **not** a second copy of the Delphi or MV2 source trees.
- Code changes go in the project repo. Status changes go in `homebase/projects/`.

When `paulooventura/homebase` exists as its own repo, copy this folder there and keep Delphi’s `homebase/` as a pointer or submodule. Until then, **this folder on Delphi `main` is the hub**.
