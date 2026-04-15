# Shell prompt integration snippets

Drop-in snippets that add a compact `5h:42% 7d:88%` Claude usage
segment to your shell prompt by calling the `claude-usage` CLI shipped
with this fork.

| Shell      | File             |
| ---------- | ---------------- |
| Bash       | [bash.md](./bash.md) |
| Zsh        | [zsh.md](./zsh.md)   |
| Fish       | [fish.md](./fish.md) |
| PowerShell | [powershell.md](./powershell.md) |

## Prerequisites

- The CLI must be on your `$PATH`. Install via:
  - `npm link` from the project root (dev), or
  - download a release and add `bin/cli.js` to a directory in `PATH`,
    or
  - `npm i -g .` from a checkout
- Credentials: either set `CLAUDE_SESSION_KEY` and
  `CLAUDE_ORGANIZATION_ID` env vars, or run `claude-usage login --key
  <key> --org <org-uuid>` once.
- Verify with `claude-usage status`.

## Performance notes

By default the CLI hits Claude.ai's API on every invocation. The
recommended snippets pass `--cache 60`, which reuses the last
response for up to 60 seconds from a small file under the CLI's
config directory — most prompt redraws are then served locally.

For very slow accounts, a fully background-refreshed file cache is
also documented in each shell's snippet.
