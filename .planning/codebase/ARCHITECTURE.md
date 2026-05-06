# Architecture

**Analysis Date:** 2026-05-07

## Pattern Overview

**Overall:** Single-binary Electron desktop widget + companion headless CLI.

**Key Characteristics:**
- Electron main process (CommonJS) owns the window, tray, IPC, and electron-store
- Renderer (`src/renderer/`) is loaded over the file scheme; loads Chart.js + a context-isolated preload bridge
- Preload bridge (`preload.js`) exposes a narrow `electronAPI` surface via `contextBridge` - the only renderer-to-main path
- CLI (`bin/cli.js`) reuses the same shared modules (`src/shared/*`) for history filtering, formatting, peak-throttle, and version comparison
- No embedded server; no telemetry; all state lives in electron-store on the user's machine
- Cloudflare bypass: a hidden BrowserWindow renders Claude.ai responses and the main process pulls JSON out of `document.body.innerText`

## Layers

**Window / Lifecycle (Electron main):**
- Purpose: BrowserWindow + tray + lifecycle (single-instance lock, dock-hide, drag, position persistence, compact-mode resize)
- Contains: `main.js`
- Depends on: `electron`, `electron-store`, `src/fetch-via-window.js`, `src/shared/*`
- Used by: tray menu actions, IPC handlers, app-ready / second-instance hooks

**IPC / Preload Bridge:**
- Purpose: Context-isolated `electronAPI` surface; URL allowlist for `openExternal`
- Contains: `preload.js`
- Depends on: `contextBridge`, `ipcRenderer`
- Used by: every call from `src/renderer/app.js`

**Settings Persistence:**
- Purpose: Durable settings, usage history, window position, credentials (encrypted via `safeStorage` when available)
- Contains: electron-store wrapper calls in `main.js`; schema in `src/shared/settings-schema.js`
- Depends on: `electron-store`, `safeStorage`
- Used by: renderer settings drawer, main-process side effects (always-on-top, auto-start, compact mode), CLI fallback

**Data Fetcher (Cloudflare bypass):**
- Purpose: Fetch JSON from Claude.ai usage endpoints
- Contains: `src/fetch-via-window.js` (hidden BrowserWindow path), `src/cli/api.js` (Node fetch path)
- Depends on: `electron.BrowserWindow` (main path), Node `fetch` (CLI path)
- Used by: `main.js` `fetch-usage-data` IPC handler, `bin/cli.js` `cmdStatus` / `cmdWatch`

**Renderer UI:**
- Purpose: Metric cards, peak-throttle banner, Chart.js graph, history table, settings drawer, login panel, compact mode
- Contains: `src/renderer/index.html`, `src/renderer/app.js`, `src/renderer/styles.css`
- Depends on: `electronAPI`, Chart.js
- Used by: end user via mouse / keyboard / tray

**Shared Utilities (cross-layer, pure):**
- Purpose: Reusable logic with no Electron / DOM dependencies
- Contains: `src/shared/history.js`, `src/shared/peak-throttle.js`, `src/shared/settings-schema.js`, `src/shared/thresholds.js`, `src/shared/format.js`, `src/shared/version.js`
- Depends on: nothing (pure functions)
- Used by: `main.js`, `src/renderer/app.js`, `bin/cli.js`, `tests/*`

**CLI:**
- Purpose: Headless usage monitoring + shell-prompt integration
- Contains: `bin/cli.js`, `src/cli/api.js`, `src/cli/config.js`, `src/cli/render.js`, `src/cli/widget-store.js`
- Depends on: shared utilities, Node built-ins
- Used by: terminal / cron / shell prompts

## Data Flow

**Flow 1 - App startup -> first fetch:**
1. `app.whenReady()` restores session cookie + applies stored settings (theme, always-on-top, compact mode)
2. Renderer loads, calls `electronAPI.getCredentials()`
3. If sessionKey present, renderer calls `fetchUsageData()`; otherwise shows the login panel
4. Main calls `fetchViaWindow()` for the three endpoints in parallel via `Promise.allSettled` and merges overage / prepaid into the usage object
5. Main appends a sample to `usageHistory` (rotation: 30-day cutoff + 10k-sample cap)
6. Renderer renders metric cards, peak-throttle banner, circular timers
7. Renderer pushes pre-rendered tray frames to main, which cycles them via `setTrayFrames()`

**Flow 2 - User refresh (Ctrl/Cmd+R or tray "Refresh"):**
- Tray click -> IPC `refresh-usage` to renderer; renderer guards with an `isFetching` flag; otherwise identical to Flow 1 steps 4-7

**Flow 3 - Auto-refresh (polling):**
- Renderer maintains an interval timer (default 5 min); each tick calls `fetchUsageData()` and skips if a fetch is already in flight

**Flow 4 - Settings save:**
- Renderer -> `saveSettings(patch)` IPC -> main `normalizeSettings()` -> store
- Main applies side effects: `app.setLoginItemSettings()` (autoStart), `mainWindow.setAlwaysOnTop()`, `applyCompactWindowMode()`, immediate prune if `autoPrune` is on

**Flow 5 - Login (auto-detect via BrowserWindow):**
- Renderer -> `detectSessionKey()` IPC
- Main opens visible BrowserWindow at `https://claude.ai/login`, listens for the `sessionKey` cookie, closes the window, returns `{success, sessionKey}`
- Renderer calls `validateSessionKey()` -> `saveCredentials()`; main encrypts via `safeStorage` and installs the cookie

**Flow 6 - History export:**
- Renderer picks a range, requests CSV / JSON via `exportHistory()` IPC
- Main filters via `historyShared.filterByRange()`, formats via `toCSV` / `toJSON`, opens system save dialog, writes file

**Flow 7 - CLI single command:**
- `claude-usage status` -> `loadCredentials()` (env vars first) -> `fetchUsage()` (Node path) -> `summary()` -> stdout

**Flow 8 - CLI watch:**
- `claude-usage watch --interval 60` polls in a loop until interrupted

**Flow 9 - Peak-throttle detection:**
- `getPeakThrottleStatus(now)` is pure; called from main / renderer / CLI; returns `{isThrottled, nextTransitionAt, peakWindowUTC, peakDaysUTC}`

**State Management:**
- Stateless main process plus durable electron-store; renderer holds module-level state in `app.js` (credentials, latestUsageData, isCompactMode, graphVisible, historyPage, etc.) - rebuilt from the store on each launch.

## Key Abstractions

**BrowserWindow lifecycle:**
- Single frameless transparent always-on-top main window; per-fetch hidden BrowserWindow for the Cloudflare bypass; visible login window during auth.
- Position save debounced 300 ms on `move`; restored on launch.

**ContextBridge `electronAPI`:**
- The trust boundary. Renderer can only call methods listed in `preload.js`. URLs go through a hardcoded allowlist (`claude.ai`, `github.com`) before `shell.openExternal`.

**History rotation:**
- Append-on-fetch + double rotation (time + count). Export scope = user-chosen window.

**Peak-throttle detector:**
- Stateless pure function over the current time. Hardcoded weekday 12:00 - 18:00 UTC peak window. Same function used in renderer and CLI.

**Settings schema:**
- Defaults-first merge in `normalizeSettings({patch})`. Type / range / enum / cross-field constraints enforced once; everything else trusts the result.

## Entry Points

**`main.js` (Electron main):**
- Triggered by `npm start` (dev) or the packaged binary
- Owns: app lifecycle, ~30 IPC handlers, tray, window lifecycle, periodic always-on-top reassertion, history pruning on launch

**`src/renderer/index.html`:**
- Triggered by `mainWindow.loadFile('src/renderer/index.html')`
- Owns: DOM structure, CSP, Chart.js + app.js script loads

**`src/renderer/app.js`:**
- Triggered by index.html
- Owns: state machine, event listeners, render functions, auto-refresh loop, compact mode, peak-throttle status polling

**`preload.js`:**
- Triggered by `webPreferences.preload`
- Owns: `electronAPI`, URL allowlist enforcement

**`bin/cli.js`:**
- Triggered by `npm run cli` or the global `claude-usage` bin
- Owns: argument parsing, subcommand routing (`status`, `json`, `watch`, `prompt`, `login`, `organizations`, `history`, `doctor`, `config`, `version`, `help`)

## Error Handling

**Strategy:**
- Detect known Cloudflare signatures and convert to typed errors (`CloudflareBlocked`, `SessionExpired`, `UnexpectedHTML`)
- Renderer guards UI with `isFetching` flag and graceful banners
- CLI fails fast with a clear stderr message and non-zero exit

**Patterns:**
- Main: `try/catch` around `fetchViaWindow`; on `CloudflareBlocked` / `SessionExpired` it sends a `session-expired` event to the renderer so the login panel re-appears
- Renderer: every `electronAPI.*` call is wrapped; auth-related errors trigger the login panel, transient errors render an inline banner
- CLI: top-level `try/catch` per command, `console.error` + `process.exit(1)` on failure
- `Promise.allSettled` on the three usage endpoints so optional ones (overage, prepaid) failing does not break the mandatory one

## Cross-Cutting Concerns

**Logging:**
- Main: `DEBUG` boolean (`DEBUG_LOG=1` or `--debug`); messages prefixed `[Debug]`, `[Migration]`, `[Security]`, `[Keychain]`
- Renderer: `?debug` query param enables verbose `console.log` in DevTools
- Production: silent unless something actually fails

**Validation:**
- `normalizeSettings(input)` enforces every settings invariant once
- `normalizeRow(row)` validates each history sample and returns `null` if malformed
- `validateSessionKey()` round-trips via `/api/organizations` to confirm a key works
- `isAllowedExternalUrl()` in `preload.js` checks domains before any `shell.openExternal`

**Authentication:**
- `safeStorage.encryptString()` when available; plain-text fallback when not (Linux without keychain)
- Logout clears stored keys, clears Electron session cookies, and wipes the BrowserWindow's localStorage / sessionStorage / cacheStorage

**Settings persistence:**
- electron-store JSON file under the OS user-data directory; recreated on first write
- CLI keeps a separate `claude-usage-cli/config.json` so the headless tool does not depend on Electron being installed

**Tray icon cycling:**
- Renderer pre-renders frames as data URLs; main calls `setTrayFrames([{dataURL, tooltip, duration}])` and rotates them with `setTimeout`. Existing timer is cleared on each new push.

**Drag-to-move:**
- CSS-driven (`-webkit-app-region: drag`) on the title-bar element; main persists the new position 300 ms after the last move event.

---

*Architecture analysis: 2026-05-07*
*Update when major patterns change (auth flow, fetch strategy, IPC surface).*
