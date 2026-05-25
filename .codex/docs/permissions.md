# Permissions

Three layers in `.codex/settings.json#permissions`:

- `allow` â€” pre-approve a call, no prompt shown
- `ask` â€” prompt the user even if the call would normally be silent
- `deny` â€” block outright, no way to approve in-session

## Defense in depth

Combine `deny` (the cheapest layer â€” just pattern matching) with Python hooks (the strictest layer â€” full content inspection). Hooks can catch things the pattern matcher misses (hardcoded secrets inside code), but pattern matching in `deny` is faster and catches the blatant cases early.

```json
{
  "permissions": {
    "allow": [
      "Bash(python:*)",
      "Bash(git:*)",
      "Edit(src/**)"
    ],
    "ask": [
      "Bash(git push:*)",
      "Write(.github/workflows/**)"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(git push --force:*)",
      "Bash(git reset --hard:*)",
      "Read(**/.env)",
      "Read(**/*.pem)",
      "Write(**/.env)"
    ]
  }
}
```

## Pattern syntax

- `Bash(npm:*)` â€” any command starting with `npm`
- `Edit(src/**)` â€” edits under `src/`
- `Bash` â€” all Bash (no restriction)

## Anti-patterns

- **Never hardcode absolute paths** like `D:/Workspace/...` in `settings.local.json`. Use `${CLAUDE_PROJECT_DIR}` or glob patterns. Hardcoded paths are not portable across machines and break for teammates.
- `settings.local.json` is personal and gitignored. Don't push it.
- Project-wide rules go in `settings.json` (tracked). Personal allowlists go in `settings.local.json` (not tracked).
