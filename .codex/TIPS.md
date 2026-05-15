# Tips index

This file is a thin index. The long-form reference lives under `.codex/docs/`.

| Topic | File |
|-------|------|
| Hooks (active, optional, exit codes, events, env vars) | [.codex/docs/hooks.md](docs/hooks.md) |
| MCP servers (install, scopes) | [.codex/docs/mcp.md](docs/mcp.md) |
| Custom slash commands and recommended plugins | [.codex/docs/commands.md](docs/commands.md) |
| Permissions (`allow` / `ask` / `deny` layers) | [.codex/docs/permissions.md](docs/permissions.md) |
| Releases (tag pipeline, IDENTITY.yaml, CHANGELOG) | [.codex/docs/releases.md](docs/releases.md) |
| First-time setup flow | [.codex/docs/setup-flow.md](docs/setup-flow.md) |
| Deferred work (GSD ISSUES.md) | [.codex/docs/deferred-work.md](docs/deferred-work.md) |
| AGENTS.md best practices | [.codex/docs/agents-md-best-practices.md](docs/agents-md-best-practices.md) |
| Workflow tips (Plan Mode, sub-agents, Windows) | [.codex/docs/workflow.md](docs/workflow.md) |

For per-command help see `/gtr:help <command>`. For per-topic guides see `/gtr:help <topic>` (planning, release, hooks, manifest, migration, onboarding, permissions).

## Configuration files at a glance

```
~/.codex/settings.json          # Personal settings (all projects)
~/.codex/AGENTS.md              # Personal instructions (all projects)
.codex/settings.json            # Project settings (tracked in git)
.codex/settings.local.json      # Local overrides (gitignored)
.codex/hooks/                   # Hook scripts (registered by default)
.codex/hooks/optional/          # Optional hooks (opt-in, not registered)
.codex/commands/                # Custom slash commands (root namespace)
.codex/commands/gtr/            # Template's `/gtr:*` commands
.codex/scripts/                 # Helper scripts (manifest, migrations)
.codex/docs/                    # Long-form reference (this directory)
.codex/rules/                   # Optional topic-split AGENTS.md rules
AGENTS.md                        # Project instructions (tracked in git)
IDENTITY.yaml                    # Identity and release config (tracked)
.planning/                       # GSD planning artifacts (optional, opt-in)
```
