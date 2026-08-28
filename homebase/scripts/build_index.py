#!/usr/bin/env python3
"""Build homebase/INDEX.md from project cards with YAML-ish frontmatter."""

from __future__ import annotations

import pathlib
import re
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJECTS = ROOT / "projects"
INDEX = ROOT / "INDEX.md"


def parse_frontmatter(text: str) -> dict[str, str]:
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not match:
        return {}
    meta: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip()
    return meta


def main() -> None:
    rows: list[dict[str, str]] = []
    for path in sorted(PROJECTS.glob("*.md")):
        if path.name == "roadblocks.md":
            continue
        meta = parse_frontmatter(path.read_text(encoding="utf-8"))
        if not meta.get("id"):
            continue
        meta["file"] = f"projects/{path.name}"
        rows.append(meta)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Homebase index",
        "",
        f"Generated {now} by `homebase/scripts/build_index.py`. Do not hand-edit.",
        "",
        "| ID | Name | Status | Canonical | Live | Card |",
        "|----|------|--------|-----------|------|------|",
    ]
    for row in rows:
        live = row.get("live", "—")
        if live.startswith("http"):
            live = f"[link]({live})"
        repo = row.get("repo", "")
        branch = row.get("branch", "")
        canon = "—"
        if repo:
            label = repo.rstrip("/").split("/")[-1]
            if branch:
                canon = f"[{label}]({repo}) `{branch}`"
            else:
                canon = f"[{label}]({repo})"
        lines.append(
            f"| `{row['id']}` | {row.get('name', row['id'])} | {row.get('status', '')} "
            f"| {canon} | {live} | [{row['file']}]({row['file']}) |"
        )
    lines.extend(
        [
            "",
            "Also read: [MAP.md](MAP.md) · [QUEUE](board/QUEUE.md) · [roadblocks](projects/roadblocks.md)",
            "",
        ]
    )
    INDEX.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {INDEX.relative_to(ROOT.parent)} ({len(rows)} projects)")


if __name__ == "__main__":
    main()
