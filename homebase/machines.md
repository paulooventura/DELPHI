# Machines

Context from local notes. Paths are what *should* exist; if a box is missing a clone, `git clone -b main` from GIT-CANON.

| Name | What it is | Role | Canonical folders |
|------|------------|------|-------------------|
| **Air** | MacBook Air (`AIR`, Tailscale `air`) | Hub laptop, Ollama local brain | `~/Projects/homebase`, git clones of DELPHI + MV2 |
| **Book** | Windows d-machine | Heavy Delphi/portal + G: libraries | `G:\DELPHI\DELPHI-main` on **`main`**; BLACKBOX on `G:\PVProjects` / `G:\Projects` |
| **Palotino** | Tailscale peer | Same git remotes; no special source of truth | Pull `main`. Do not invent a third Delphi. |
| **iPhone** | Phone + Home Screen icons | QUEUE reader + live-site tester | No native Chorus/Delphi repo. Test with `/fresh`, not a stale icon. |

## Rules that survive reboot

- **GitHub `main` is newer than whatever is on the disk** until you pull.
- Air: keep Ollama running (`ollama serve` / LaunchAgent). Do not quit it to debug chat.
- Book: never mirror-purge G: creative trees.
- Sync is **git**, not USB copies of `node_modules` or `.next`.
- iPhone does not get SSH-installed from Air until keys exist; it uses the live URLs + this QUEUE when Homebase is on GitHub.

## First command on a confused machine

```bash
cd <delphi-clone>
git fetch origin
git switch main
git pull origin main
bash homebase/scripts/status.sh
```
