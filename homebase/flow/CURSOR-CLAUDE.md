# Cursor ↔ Claude — stop using Paulo as the bus

Paulo decides priorities. He should not copy prompts, HTML, or SHAs between windows.

## Roles

| Agent | Owns | Does not own |
|-------|------|----------------|
| **Cursor** (Composer / Cloud) | Git, Next.js, deploy, tests, Homebase files in this repo | Long-form Tonal copy, portal design dumps, “what should this feel like” first drafts |
| **Claude** (chat or Claude Code) | Specs, copy, portal/Tonal/Studies intent, research tone | Pushing `main`, Vercel, inventing a second Delphi tree |

Both **read and write Homebase**. That is the shared disk.

## The river

```
1. Paulo (or an agent) adds a line to board/QUEUE.md
2. The agent who is working takes it (mark `claimed:`)
3. Work happens in the canonical repo/path from MAP.md
4. Agent fills board/HANDOFF.md for the other agent
5. Commit + push (Cursor) or save hashes (Claude)
6. Update projects/<name>.md + python homebase/scripts/build_index.py
7. Other agent starts from HANDOFF, not from a screenshot of a chat
```

## What never happens

- “Paste this into Cursor.”
- “Paste this into Claude.”
- Shipping `DELPHI_TONAL_CANONICAL.html` as production (no host wiring).
- Editing `G:\DELPHI\portal\src\…` and the git `portal.html` as if they were equal without a copy step recorded in HANDOFF.
- Opening a Cloud Agent on Delphi **`master`**.

## Packet rules (HANDOFF.md)

The working agent replaces the packet. Keep **one** current packet. Move the previous one under “Log” (short).

Must include:

- `from:` Cursor | Claude
- `to:` the other
- `repo` + `branch` + `SHA` if code moved
- `paths` touched
- `prove:` URLs or commands
- `next:` one concrete job for the other agent

## Delphi-specific

Portal proof:

```bash
curl -s https://delphi.pauloventura.org/portal.html | grep "build:"
```

Sky / clock proof: https://delphi.pauloventura.org/ (Vercel `x-powered-by: Next.js`). If you see GitHub Pages placeholder copy, DNS or Pages settings have drifted — see `projects/roadblocks.md`.
