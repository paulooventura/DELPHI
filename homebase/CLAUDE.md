# Homebase — Claude / Claude Code

You design, write, and specify. Cursor commits, deploys, and wires the Next.js app. You two meet in **this folder**, not in Paulo’s clipboard.

## Where your work lands

| You produced | Cursor will put it |
|--------------|--------------------|
| Portal / Tonal / Studies HTML | `agent/web/public/portal.html` (never deploy a canonical diff raw — it has no host wiring) |
| Sky / clock / crystal behavior | `agent/web/` Next.js (Onyx + cosmic libs) |
| Copy, pitch, studies content | Portal sections or `docs/` as named in the handoff |
| Specs Cursor should implement | `homebase/board/HANDOFF.md` with file hashes and acceptance checks |

`DELPHI_TONAL_CANONICAL.html` (and similar) is a **diff reference**. Cursor merges the *intent* into `portal.html` while keeping `goLiveOr`, `hostedDeepLink`, and `bootPortal`.

## Session start

Read `homebase/MAP.md`, `board/QUEUE.md`, `board/HANDOFF.md`, then the project card. If HANDOFF says Cursor already shipped a SHA, do not re-describe that work as open.

## Session end

Fill `board/HANDOFF.md` using the template there. Include:

- What changed (intent, not a 2k-line dump)
- Paths + content hashes if you edited HTML
- What Cursor must do next
- How to prove it (`/fresh`, build stamp, a route)

Do **not** tell Paulo to copy a prompt into Cursor. The handoff file is the prompt.
