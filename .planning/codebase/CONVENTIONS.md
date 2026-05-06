# Coding Conventions

**Analysis Date:** 2026-05-07

## Naming Patterns

**Files:**
- kebab-case for source files (`fetch-via-window.js`, `peak-throttle.js`, `widget-store.js`, `settings-schema.js`, `cli-config.js`)
- Test files: `<module>.test.js` (`tests/cli-config.test.js`, `tests/history.test.js`, `tests/version.test.js`)
- HTML / CSS: `index.html`, `styles.css`

**Functions:**
- camelCase (`fetchJSON`, `readConfig`, `loadCredentials`, `getConfigDir`, `normalizeSettings`, `getPeakThrottleStatus`)
- Verb-first (`fetch*`, `get*`, `load*`, `read*`, `write*`, `validate*`, `normalize*`, `format*`)

**Variables:**
- camelCase for locals and module-level state (`latestUsageData`, `isCompactMode`, `historyRangeMs`)

**Constants:**
- UPPER_SNAKE_CASE (`GITHUB_OWNER`, `GITHUB_REPO`, `DEBUG`, `CHROME_USER_AGENT`, `HISTORY_RETENTION_DAYS`, `MAX_HISTORY_SAMPLES`, `SETTINGS_DEFAULTS`, `ENUM_VALUES`, `HISTORY_FIELDS`, `BLOCKED_SIGNATURES`, `ALLOWED_EXTERNAL_DOMAINS`)

**Types:**
- Not applicable. Vanilla JS - no TypeScript, no JSDoc-typed interfaces. Validation happens at runtime through normalize functions in `src/shared/settings-schema.js` and `src/shared/history.js`.

## Code Style

**Formatting (`.editorconfig`):**
- Indent: 2 spaces
- Line endings: LF
- Final newline: required
- Trailing whitespace: trimmed
- Charset: UTF-8

**Quotes:** single quotes for string literals throughout main / renderer / CLI / tests.

**Semicolons:** always required at statement end.

**Linting:** No ESLint or Prettier configured. Style is enforced by `.editorconfig` plus convention; code review is the human check.

## Import Organization

**CommonJS (main, preload, CLI, shared):**
- `const { ... } = require('...')` style
- Grouped: external packages first (`electron`, `electron-store`), Node built-ins next (`path`, `fs`, `os`, `https`), local imports last (`./src/...`)
- Example from `main.js`:
  ```js
  const { app, BrowserWindow, ipcMain, ... } = require('electron');
  const path = require('path');
  const https = require('https');
  const Store = require('electron-store');
  const { fetchViaWindow } = require('./src/fetch-via-window');
  ```

**ESM (tests):**
- `import { ... } from '...'`
- vitest globals: `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'`
- Tests that load CommonJS modules use `createRequire(import.meta.url)` and clear `require.cache` per spec to force fresh state

**Renderer (`src/renderer/app.js`):**
- Loaded via `<script>` tag from `src/renderer/index.html`. No module system in the renderer; the file is one large script that touches `window.electronAPI` and `Chart`.

## Error Handling

**Strategy:**
- Defensive `try/catch` around optional operations (keychain decrypt, file IO)
- Fail-fast with thrown errors for required operations (missing credentials, mandatory usage endpoint)
- Typed error codes: `err.code = 'SESSION_EXPIRED'` / `'CLOUDFLARE'`, `err.status = 401|403|...`
- Error messages prefixed with category: `[Migration]`, `[Security]`, `[Keychain]`, `[Debug]`

**Promise patterns:**
- `Promise.allSettled` for the three usage endpoints in parallel - mandatory one (`five_hour`) re-throws on rejection, optional ones (`overage_spend_limit`, `prepaid/credits`) fall through silently if rejected

**Renderer:**
- Every `electronAPI.*` call is wrapped; auth-style errors flip back to the login panel; transient errors render an inline banner

**CLI:**
- Top-level `try/catch` per subcommand; on error: `console.error('Error:', message)` + `process.exit(1)`

## Logging

**Debug logging:**
- Main process: `DEBUG_LOG=1` env var or `--debug` CLI flag - the constant `DEBUG` in `main.js` toggles `debugLog(...)` which prints `[Debug] ...`
- Renderer: `?debug` query param (`new URLSearchParams(window.location.search).has('debug')`) toggles verbose `console.log`
- CLI: `--no-color` flag disables ANSI color, but no debug switch beyond shared `--debug`

**Console output policy:**
- No `console.log` for end users in production paths
- Categorized prefixes: `[Migration]`, `[Security]`, `[Keychain]`, `[Debug]`
- CLI: `process.stdout.write(...)` for normal output (no automatic newline); `process.stderr.write(...)` for errors

## Comments

- No docstrings on unchanged code (project rule, `CLAUDE.md`)
- No `TODO` comments (project rule - track in `.planning/ISSUES.md` once GSD is initialized)
- Inline comments only when the WHY is non-obvious (e.g. the Cloudflare-bypass header in `src/fetch-via-window.js` explaining why a hidden BrowserWindow is used instead of plain `fetch`)
- Block comments at the top of a complex module are acceptable when they explain a workaround

## Function Design

**Size:** keep modules under ~200 lines per `CLAUDE.md`. `src/renderer/app.js` is the standing violation (~2,600 lines) - flagged in `CONCERNS.md` for split.

**Parameters:**
- Destructure objects: `fetchUsage({ sessionKey, organizationId })`
- Default options: `fetchViaWindow(url, { timeoutMs = 30000 } = {})`

**Return values:**
- Early returns for guard clauses (`if (!sessionKey) return null;`)
- `null` for missing / not-found, `[]` for "no data", structured object for results
- Throw for mandatory failures, return `null` / `false` for optional failures

## Module Design

**Architecture: CommonJS main + CommonJS preload + script-tag renderer.**

**Main process (CommonJS):**
- `main.js` plus modules under `src/cli/*`, `src/shared/*`, and `src/fetch-via-window.js`
- Exports via `module.exports = { ... }`
- IPC handlers expose Electron APIs to the renderer

**Preload (CommonJS):**
- `preload.js` runs in the isolated preload world
- `contextBridge.exposeInMainWorld('electronAPI', { ... })` defines the entire trust boundary
- URL allowlist enforcement happens here AND in `main.js`'s `open-external` handler (duplication flagged in `CONCERNS.md`)

**Renderer (vanilla JS, no module system):**
- One large file `src/renderer/app.js` plus DOM and CSS
- Communicates with main only via `window.electronAPI.*`
- Module-level `let` variables hold all state

**Shared (CommonJS, pure):**
- `src/shared/*` is dependency-free and consumable by main + CLI + tests

**Hard rules (Electron security):**
- `contextIsolation: true` for every BrowserWindow
- `nodeIntegration: false` for every BrowserWindow
- `enableRemoteModule` not used
- `preload.js` is the only renderer-to-main path

---

*Convention analysis: 2026-05-07*
*Update when introducing a linter, splitting `app.js`, or adding new module styles.*
