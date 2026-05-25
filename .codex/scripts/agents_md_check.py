#!/usr/bin/env python3
"""
Lightweight AGENTS.md drift checker.

Not a generator â€” generators force the template's section choices on
every consumer, which is too prescriptive. This script reads the
project's AGENTS.md and reports which expected sections are present
and which are missing or still placeholders. /gtr:doctor consumes the
exit code and the JSON output.

Sections are matched as level-2 headings (``## <name>``). Placeholder
detection: a section is "placeholder" if its body is empty or contains
only HTML comments / lines starting with ``<!--``.

Usage::

    python .codex/scripts/agents_md_check.py            # human-readable
    python .codex/scripts/agents_md_check.py --json     # machine-readable
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


# Sections that are *commonly* present after /gtr:setup runs. None are strictly
# required: a project may omit any of them or rename them. The script reports
# presence informationally; it does not fail on missing sections. Exit code is
# non-zero only when AGENTS.md does not exist at all.
EXPECTED_SECTIONS: list[tuple[str, bool]] = [
    ("Project Overview", False),
    ("Architecture", False),
    ("Development Commands", False),
    ("Code Standards", False),
    ("File Organization", False),
    ("Protected Files", False),
    ("Git and Commits", False),
    ("What NOT to Do", False),
    ("Release", False),
    ("Communication", False),
    ("First-time setup check", False),
    ("Available commands", False),
    ("Planning workflow", False),
]


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_sections(text: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    current: str | None = None
    buf: list[str] = []
    for line in text.splitlines():
        m = re.match(r"^##\s+(.+?)\s*$", line)
        if m:
            if current is not None:
                sections[current] = "\n".join(buf).strip()
            current = m.group(1).strip()
            buf = []
        else:
            buf.append(line)
    if current is not None:
        sections[current] = "\n".join(buf).strip()
    return sections


def is_placeholder(body: str) -> bool:
    if not body.strip():
        return True
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("<!--"):
            continue
        if line.startswith("-->"):
            continue
        return False
    return True


def matching_section_name(expected: str, sections: dict[str, str]) -> str | None:
    if expected in sections:
        return expected
    prefix = f"{expected} ("
    for actual in sections:
        if actual.startswith(prefix):
            return actual
    return None


def check(path: Path) -> dict:
    if not path.is_file():
        return {
            "found": False,
            "missing": [name for name, _ in EXPECTED_SECTIONS],
            "placeholders": [],
            "extras": [],
        }
    sections = parse_sections(path.read_text(encoding="utf-8"))
    expected_names = [name for name, _ in EXPECTED_SECTIONS]
    matches = {
        name: matching_section_name(name, sections)
        for name in expected_names
    }
    missing = [name for name, actual in matches.items() if actual is None]
    placeholders = [
        name
        for name, actual in matches.items()
        if actual is not None and is_placeholder(sections[actual])
    ]
    matched_actual = {actual for actual in matches.values() if actual is not None}
    extras = [name for name in sections if name not in matched_actual]
    return {
        "found": True,
        "missing": missing,
        "placeholders": placeholders,
        "extras": extras,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--path", default=None, help="path to AGENTS.md (default: <project>/AGENTS.md)")
    args = parser.parse_args()

    target = Path(args.path) if args.path else project_root() / "AGENTS.md"
    result = check(target)

    if args.json:
        json.dump(result, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
    else:
        if not result["found"]:
            print(f"AGENTS.md not found at {target}")
        else:
            print(f"AGENTS.md sections: ok={len(EXPECTED_SECTIONS) - len(result['missing']) - len(result['placeholders'])}, missing={len(result['missing'])}, placeholders={len(result['placeholders'])}")
            for name in result["missing"]:
                print(f"  missing:     ## {name}")
            for name in result["placeholders"]:
                print(f"  placeholder: ## {name}")
            if result["extras"]:
                print(f"  extras (project-specific, not flagged): {len(result['extras'])}")

    # Exit non-zero only when AGENTS.md is absent. Missing sections are
    # informational â€” projects are free to define their own structure.
    if not result["found"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
