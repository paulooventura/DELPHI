# Files, backup, and storage

The goal is one obvious home for each kind of thing. No second “real” copy that diverges.

## Three layers

| Layer | What belongs | Canonical place | Backup |
|-------|----------------|-----------------|--------|
| **1. Code + this hub** | Git repos, Homebase markdown | GitHub (`main` for Delphi and MV2) | `git push` is the backup. Clone on Air and Book. |
| **2. Working machines** | Local checkouts, `.env.local`, IDE | Air `~/Projects/…`, Book `G:\DELPHI\…` | Rebuild from git. Do not treat clones as unique. |
| **3. Creative library (BLACKBOX)** | Audio, video, FLPs, samples, masters | `G:\PVProjects`, `G:\Projects` | Copy/verify backups only. **Never delete, never `/MIR`, never purge.** |

Paulo is not a backup drive. If work only exists in a chat, it does not exist. Put it in layer 1 or 3.

## Where to put what

| Thing | Put it here | Not here |
|-------|-------------|----------|
| Delphi / Tonal / Studies code | `paulooventura/DELPHI` `main` → `agent/web/` | `master`, `gh-pages`, random HTML on Desktop |
| Portal HTML that ships | `agent/web/public/portal.html` | Claude “canonical” files as a deploy target |
| Game code | `paulooventura/MV2` `main` | `Mind-and-Venture` |
| Maps, queues, “what is live” | `homebase/` (this tree) | iMessage, screenshots of chats |
| API keys | `agent/web/.env.local` (gitignored) + Vercel env | Git, Homebase, Discord |
| Music / video / FLP / masters | `G:\PVProjects` or `G:\Projects` | Git (too big; also BLACKBOX) |
| Wix artist site | Wix | This repo |

## Daily / weekly flow

**After any real change (code):**

1. Commit on the canonical branch.
2. Push to GitHub.
3. Hit the live URL (or `/fresh` for Delphi portal).
4. Update `homebase/projects/<name>.md` + rebuild index.

**After any real change (creative files on G:):**

1. Save in the project folder on G:.
2. Copy to the backup destination you already use (external drive / NAS).
3. Open the copy and confirm it plays / opens.
4. Only then — and only if you explicitly want the source gone — remove the original. Agents must **stop** if a move fails (file locked). Never invent a delete fallback.

**Weekly (Paulo, 15 minutes):**

1. Run `bash homebase/scripts/status.sh` (or ask an agent to).
2. Skim `board/QUEUE.md` — done items get dated, not deleted forever.
3. Confirm Air and Book both `git pull` Delphi `main` and MV2 `main`.

## Windows (Book) paths

| Path | Role |
|------|------|
| `G:\DELPHI\DELPHI-main` | Git clone of this repo. Keep it on `main`. |
| `G:\DELPHI\portal\src\DELPHI_portal.html` | Optional portal draft. Copy into the clone before ship. |
| `G:\PVProjects`, `G:\Projects` | BLACKBOX creative library |
| `C:\Users\…\AppData\Local\Temp`, npm-cache, GPU shader cache | Disposable. OK to clear when freeing space. |

Hard rule (incident 2026-08-07): **no** `robocopy /MIR`, `/PURGE`, `rd /s /q` on content trees, no “delete leftovers after a failed rename.”

## Mac (Air) paths

| Path | Role |
|------|------|
| `~/Projects/homebase` | Preferred hub checkout (copy of this folder, or future standalone repo) |
| `~/Projects/…` other clones | Same GitHub remotes as Book |
| Ollama | Local brain — keep running; do not quit to “fix” chat |

Air cannot SSH-install Book or iPhone until keys exist. Sync is GitHub, not `scp` of whole disks.

## What “backup” means (short)

- **Code:** if it is not on GitHub `main`, it is not backed up.
- **Homebase:** if the map is only in a chat, the next agent will rebuild the hurricane.
- **Media:** if the only copy is one folder on G:, it is not backed up. Duplicate to another disk, then verify playback.
- **Secrets:** password manager / Vercel / local env files. Never git.

## Sync between Air, Book, Palotino, iPhone

```
Book / Air  --git push/pull-->  GitHub  --git pull-->  the other machine
                 ^                      |
                 |                      +--> Vercel / Pages (live sites)
                 |
            board/QUEUE.md  (iPhone can read this when Homebase is on GitHub)
```

iPhone is a QUEUE client. It does not host Delphi or MV2 source.
