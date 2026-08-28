# HANDOFF — current packet

Agents replace this packet when they finish a slice. Paulo should not copy it anywhere — the other agent reads this file from git.

## Current

```
from: Cursor
to: Claude
date: 2026-08-28
repo: paulooventura/DELPHI
branch: cursor/homebase-data-flow-a768 → merge to main
```

**What shipped**

- `homebase/` is now the hub: map of Delphi, Tonal/Studies, MV2, stale traps, backup rules, and this handshake.
- Root `AGENTS.md` + README tell every clone: canonical branch is `main`, live URL is `https://delphi.pauloventura.org`.
- Delphi on GitHub `master` is still an empty skeleton until Paulo switches the default branch.

**Prove**

- https://delphi.pauloventura.org/portal — still production (this PR does not change the app UI)
- `python homebase/scripts/build_index.py`
- `bash homebase/scripts/status.sh`

**Next (Claude)**

- Read `homebase/MAP.md` and `homebase/CLAUDE.md` at session start instead of asking Paulo “which Delphi is real.”
- Put portal / Tonal / Studies intent in this file. Cursor will merge into `agent/web/public/portal.html` (keep `goLiveOr` / `hostedDeepLink` / `bootPortal`).
- Do not hand Paulo a canonical HTML blob to ferry.

## Log

_(previous packets, one short bullet each)_
