#!/usr/bin/env python3
"""
Hook: SessionStart
Purpose: Inject a reminder into Codex's initial context when the project
         has not been set up via /gtr:setup yet. Marker file is
         .Codex/.setup-complete.

Stdout is appended to the session's initial context. Exit 0 always.
"""

import os
import sys

PROJECT_DIR = os.environ.get("CODEX_PROJECT_DIR", os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
MARKER = os.path.join(PROJECT_DIR, ".Codex", ".setup-complete")


def main() -> None:
    if os.path.exists(MARKER):
        sys.exit(0)

    sys.stdout.write(
        "[template] This project has not been initialised by the template "
        "setup wizard.\n"
        "Before starting coding work, recommend that the user run `/gtr:setup`.\n"
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
