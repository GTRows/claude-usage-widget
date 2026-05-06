# Codebase Structure

**Analysis Date:** 2026-05-07

## Directory Layout

```
claude-usage-widget/
├── .claude/                 # Template state (commands, hooks, agents, settings) - template-managed
├── .planning/               # GSD project state (this file lives here) - GSD-managed
├── .github/                 # Issue / PR templates, CODEOWNERS, dependabot, build workflows
│   └── workflows/           # build-windows.yml, build-macos.yml, build-linux.yml, test.yml
├── assets/                  # Icons, logos, fonts, screenshots
├── bin/                     # CLI entry point
│   └── cli.js               # `claude-usage` headless CLI
├── build/                   # Platform build assets
│   └── entitlements.mac.plist
├── docs/                    # User-facing docs (shell-prompt examples)
├── src/
│   ├── renderer/            # Electron renderer
│   │   ├── index.html
│   │   ├── app.js           # State machine + render functions + listeners
│   │   └── styles.css
│   ├── cli/                 # CLI modules
│   │   ├── api.js           # Node fetch path
│   │   ├── config.js        # Config-file IO + credential loading
│   │   ├── render.js        # ANSI rendering helpers
│   │   └── widget-store.js  # Read widget's electron-store from CLI
│   ├── shared/              # Pure cross-layer utilities
│   │   ├── history.js
│   │   ├── peak-throttle.js
│   │   ├── settings-schema.js
│   │   ├── thresholds.js
│   │   ├── format.js
│   │   └── version.js
│   └── fetch-via-window.js  # Cloudflare bypass via hidden BrowserWindow
├── tests/                   # vitest unit tests (no e2e)
├── main.js                  # Electron main process
├── preload.js               # Context-isolated IPC bridge
├── index.html               # (referenced from CLAUDE.md; actual entry is src/renderer/index.html)
├── package.json             # Dependencies + scripts + electron-builder config
├── vitest.config.js         # Test runner config
├── IDENTITY.yaml            # Single source of truth for name / version / icon / release config
├── CLAUDE.md                # Project rules for Claude Code
├── CHANGELOG.md             # Keep a Changelog
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
└── README.md
```

## Directory Purposes

**`.claude/`:**
- Purpose: Template-managed Claude Code configuration (hooks, slash commands, settings, manifest)
- Contains: `agents/`, `commands/gtr/`, `docs/`, `hooks/`, `scripts/`, `skills/`, `settings.json`, `.template-manifest.json`, `plugin-pin.json`, `setup-followups.md` (gitignored)
- Owner: template auto-update via `/gtr:update`; only `settings.json` and `setup-followups.md` are user-edited

**`.planning/`:**
- Purpose: GSD project state and codebase map
- Contains: `codebase/` (this directory), eventually `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `phases/`
- Owner: `/gsd:*` commands

**`.github/`:**
- Purpose: GitHub-side metadata
- Contains: issue + PR templates, CODEOWNERS (`@GTRows`), dependabot config, four build / test workflows
- Owner: user

**`assets/`:**
- Purpose: Application icons, logos, fonts, marketing screenshots
- Contains: `icon.ico` (Windows), `icon.icns` (macOS), `logo.png` (Linux), `tray-icon-*.png`, fonts/, screenshot-*.png
- Note: `IDENTITY.yaml#identity.icon` references `assets/icon.png` which is missing - see `CONCERNS.md`

**`bin/`:**
- Purpose: CLI entry point registered as `claude-usage` in `package.json#bin`
- Key files: `cli.js`

**`build/`:**
- Purpose: Platform-specific build assets consumed by electron-builder
- Key files: `entitlements.mac.plist`

**`docs/`:**
- Purpose: User-facing supplementary documentation (e.g. shell prompt integration recipes)

**`src/renderer/`:**
- Purpose: Electron renderer process - DOM, styles, application state machine, render functions
- Key files: `index.html`, `app.js`, `styles.css`
- Loading: `<script>` tag (no module bundler; vanilla JS)

**`src/cli/`:**
- Purpose: CLI-specific modules used only from `bin/cli.js`
- Key files: `api.js`, `config.js`, `render.js`, `widget-store.js`
- Module style: CommonJS (matches CLI / main side)

**`src/shared/`:**
- Purpose: Pure utilities shared between main, renderer, CLI, and tests. No Electron / DOM dependencies.
- Key files: `history.js`, `peak-throttle.js`, `settings-schema.js`, `thresholds.js`, `format.js`, `version.js`
- Module style: CommonJS

**`tests/`:**
- Purpose: vitest unit specs
- Pattern: One spec per shared / CLI module; main + preload + renderer are not currently covered (see `CONCERNS.md`)

## Key File Locations

**Entry Points:**
- `main.js` - Electron main process
- `src/renderer/index.html` - renderer root (loaded by main)
- `src/renderer/app.js` - renderer logic
- `preload.js` - context-isolated bridge
- `bin/cli.js` - CLI entry

**Configuration:**
- `package.json` - dependencies + scripts + electron-builder config (inline `build` section)
- `vitest.config.js` - test runner config
- `IDENTITY.yaml` - protected single source of truth
- `.editorconfig` - 2-space indent, LF
- `.env.example` - planned but currently blocked by `.claude/settings.json` deny rule (see `setup-followups.md`)

**Core Logic:**
- `main.js` - app lifecycle + IPC handlers + tray + electron-store wrappers
- `src/renderer/app.js` - all renderer behaviour (large file, see `CONCERNS.md`)
- `src/fetch-via-window.js` - Cloudflare bypass
- `src/cli/api.js` - Node fetch path for the CLI
- `src/shared/*` - pure utilities

**Testing:**
- `tests/*.test.js` - one spec per shared / CLI module

**Documentation:**
- `README.md` - public-facing
- `CONTRIBUTING.md` - contributor guide (PRs, branches, code style)
- `SECURITY.md` - vulnerability disclosure
- `CLAUDE.md` - rules for Claude Code working in this repo
- `CHANGELOG.md` - Keep a Changelog format

## Naming Conventions

**Files:**
- kebab-case for JS files (`fetch-via-window.js`, `peak-throttle.js`, `widget-store.js`)
- Test files: `<module>.test.js` (e.g. `cli-config.test.js`)
- Uppercase Markdown for repo-level docs (`README.md`, `CHANGELOG.md`, `CLAUDE.md`)
- HTML / CSS: `index.html`, `styles.css`

**Directories:**
- Lowercase, kebab-case where multi-word (e.g. `src/shared/`)
- Functional grouping: `src/{renderer,cli,shared}` rather than feature-based

**Special Patterns:**
- IPC channels named `{verb}-{noun}` in main (`get-credentials`, `save-settings`, `fetch-usage-data`)
- Settings keys nested via dot notation in store calls (`settings.compactMode`)
- Constants `UPPER_SNAKE_CASE` (`SETTINGS_DEFAULTS`, `BLOCKED_SIGNATURES`, `ALLOWED_EXTERNAL_DOMAINS`)

## Where to Add New Code

**New IPC channel:**
- Handler in `main.js` via `ipcMain.handle('new-feature', ...)`
- Bridge method in `preload.js` (`newFeature: (args) => ipcRenderer.invoke('new-feature', args)`)
- Renderer call: `await window.electronAPI.newFeature(args)`
- Test the underlying logic in `tests/` if it lives in `src/shared/`

**New renderer module:**
- New JS file under `src/renderer/` if it stands alone, otherwise extend `src/renderer/app.js` (note: app.js is already too large - prefer extracting a new module)
- Add DOM structure in `src/renderer/index.html`
- Add styles in `src/renderer/styles.css`

**New CLI subcommand:**
- Add `async function cmd<Name>(flags)` in `bin/cli.js`
- Wire into the routing switch and HELP string
- Use `src/cli/api.js` to fetch and `src/cli/render.js` to format

**New chart variant or graph metric:**
- Extend `HISTORY_FIELDS` in `src/shared/history.js`
- Extend the sample-build path in `main.js` `storeUsageHistory`
- Wire UI controls and Chart.js dataset in `src/renderer/app.js`

**New keyboard shortcut:**
- Add a `keydown` listener in `src/renderer/app.js`
- Document the shortcut in the settings drawer's shortcuts section

**New shared utility:**
- New file in `src/shared/<name>.js` exporting pure functions via `module.exports`
- Add a matching `tests/<name>.test.js`

**New settings option:**
- Add key + default to `SETTINGS_DEFAULTS` in `src/shared/settings-schema.js`
- Add enum entry to `ENUM_VALUES` if discrete
- Add UI control in `src/renderer/index.html` settings drawer
- Wire load / save in `src/renderer/app.js`
- Apply side effects in `main.js` `save-settings` if needed

## Special Directories

**`.claude/`:**
- Source: copied from the `claude-code-template` upstream + project modifications
- Committed: yes (most files); local-only files like `.setup-complete`, `setup-followups.md`, `usage-log.jsonl`, `hook-audit.log` are gitignored
- Notes: `pre_guard_release_files.py` enforces protected-file confirmation; the manifest in `.template-manifest.json` powers `/gtr:update`

**`.planning/`:**
- Source: created by `/gsd:*` commands
- Committed: yes (project state should be reproducible across machines)
- Notes: do not edit STATE.md / phase files manually - use the GSD commands

---

*Structure analysis: 2026-05-07*
*Update when directories are added or relocated.*
