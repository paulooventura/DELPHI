# Homebase

This folder is the **hub**. Every endeavor, live URL, canonical git branch, machine path, backup rule, and Cursor ↔ Claude handoff lives here so Paulo is not the middleman.

Until `github.com/paulooventura/homebase` exists as its own repo, **this directory on `paulooventura/DELPHI` `main` is the spine**. Clone Delphi, open `homebase/`, and you have the map.

## Start here

| File | What it is |
|------|------------|
| [MAP.md](MAP.md) | One-page universe: what exists, what is live, what is stale |
| [flow/GIT-CANON.md](flow/GIT-CANON.md) | One repo → one branch → one live URL |
| [flow/FILES-AND-BACKUP.md](flow/FILES-AND-BACKUP.md) | Where files live, what to back up, what never to delete |
| [flow/CURSOR-CLAUDE.md](flow/CURSOR-CLAUDE.md) | How Cursor and Claude share work without you copying |
| [board/QUEUE.md](board/QUEUE.md) | Inbox / command bus |
| [board/HANDOFF.md](board/HANDOFF.md) | Current packet between agents |
| [projects/](projects/) | Per-endeavor status (read these, don't hunt chats) |
| [machines.md](machines.md) | Air, Book, Palotino, iPhone |
| [scripts/status.sh](scripts/status.sh) | Prove live sites match git |

## Agent closeout (every finished task)

```bash
# 1. Update the project card you touched
# 2. Rebuild the index
python homebase/scripts/build_index.py
# 3. Prove live == git
bash homebase/scripts/status.sh
```

Write test URLs and the other agent's next prompt into `board/HANDOFF.md`. Do not ask Paulo to ferry text between Cursor and Claude.

## Local copies (when you sit at a machine)

| Machine | Path |
|---------|------|
| Mac (Air) | `~/Projects/homebase` — copy or symlink this folder |
| Windows (Book) | `G:\DELPHI\DELPHI-main\homebase` until the standalone repo exists |
| iPhone | Read `board/QUEUE.md` only (no native app) |
