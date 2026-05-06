# Codebase Concerns

**Analysis Date:** 2026-05-07

## Tech Debt

**`src/renderer/app.js` is far over the file-size guideline.**
- Roughly 2,600 lines in a single file mixing login flow, settings drawer, chart init, history table, keyboard shortcuts, tray-icon frame generation, and event listeners.
- `CLAUDE.md` mandates ~200 lines per module. This is the standing violation.
- Fix approach: extract into per-feature modules in `src/renderer/` (`auth.js`, `settings.js`, `chart.js`, `history.js`, `compact-mode.js`, `tray-frames.js`) and a small bootstrap that wires them together.

**No i18n library wired despite the tr+en commitment.**
- `CLAUDE.md` (`## Localization`) and `.claude/setup-followups.md` capture the intent. UI strings remain hard-coded across `src/renderer/app.js` and `bin/cli.js`.
- Fix approach: pick a runtime (i18next or a small custom JSON loader), thread a `t(key)` helper through the renderer, gate on `pick-i18n-lib` follow-up.

**Settings management split across main and renderer with a renderer-side cache.**
- `main.js` exposes `get-settings` / `save-settings`; `src/renderer/app.js` keeps a `_cachedSettings` module variable plus partial-save helpers (`_saveCompactSetting`, `_saveViewState`).
- Risk: cache drift when main mutates settings as a side effect of another IPC call.
- Fix approach: single read on app start + an `electronAPI.onSettingsChanged` event from main when settings are mutated outside of `save-settings`.

**Allowlist for external URLs is duplicated.**
- `preload.js` and `main.js` `open-external` both validate against the same domain list.
- Fix approach: extract to `src/shared/allowed-domains.js` and import from both sides.

**History retention logic appears in three places in `main.js`.**
- `storeUsageHistory()`, the `save-settings` handler, and the startup pruning all enforce 30-day cutoff + 10k-sample cap.
- Fix approach: single helper in `src/shared/history-retention.js` (`pruneHistory(rows)`).

## Known Bugs

**`IDENTITY.yaml#identity.icon` points at a missing file.**
- Path: `assets/icon.png` does not exist; only `assets/icon.ico`, `assets/icon.icns`, and `assets/logo.png`.
- Symptom: cosmetic only today (`main.js` chooses platform-specific icons directly), but the next consumer of the IDENTITY field will fail.
- Fix: add `assets/icon.png` or change `IDENTITY.yaml#identity.icon` to an existing path. `IDENTITY.yaml` is protected - edit requires confirmation.

**`CHANGELOG.md` is missing the `## [Unreleased]` section.**
- The release flow (`/gtr:release`) extracts notes from that block; without it the next release will fail or produce empty notes.
- Fix: add an empty `## [Unreleased]` block above `## [1.13.0-gtrows.1]`. `CHANGELOG.md` is protected.

**Possible promise-leak in the GitHub release-check path in `main.js`.**
- `https.request` sets `timeout: 5000` but only `req.on('timeout', ...)` reliably resolves the promise; if the request `'end'` fires after `req.destroy()` the promise can still settle late.
- Fix: wrap the request in a single Promise that explicitly settles once and clear the timer in both branches.

**Cloudflare-block detection is inconsistent across paths.**
- `src/cli/api.js` checks `text.startsWith('<')`. `src/fetch-via-window.js` looks for known signatures (`'Just a moment'`, `'Enable JavaScript'`, `'<html'`). `main.js` `check-for-update` uses substring match.
- Risk: Claude.ai changes the HTML and only one path notices; users get confusing errors.
- Fix: extract a `detectCloudflareBlock(html)` helper in `src/shared/cloudflare.js` and call it from all three call-sites.

## Security Considerations

**Context isolation is correctly enforced.** Every BrowserWindow (`main.js` main window, login window, `src/fetch-via-window.js`) sets `contextIsolation: true` and `nodeIntegration: false`. Preload bridge enforces a fixed `electronAPI` surface.

**Session key is partially logged in debug mode.**
- `main.js` debug-logs the first 20 characters of the sessionKey when validating.
- Risk: low (only `DEBUG_LOG=1` triggers it), but credential material in logs is unnecessary.
- Fix: log only a length and a hash prefix, never the raw substring.

**Plain-text fallback for sessionKey on Linux.**
- `main.js` uses `safeStorage.encryptString()` when available; otherwise stores the cookie verbatim in `config.json`.
- Risk: on Linux without a keychain, anyone with read access to `~/.config/claude-usage-widget/config.json` can lift the session.
- Fix: warn the user on first run if `safeStorage.isEncryptionAvailable()` is false; document `chmod 600` requirement.

**`fs.writeFileSync` in the export-history IPC has no error guard.**
- A bad path or full disk crashes the IPC handler.
- Fix: wrap in `try/catch`, return `{success: false, error}` to the renderer.

**No input validation on a few IPC payloads.**
- `resize-window` and `set-settings-window` accept arbitrary heights / booleans.
- Fix: clamp height with `Math.max/Math.min`.

## Performance Bottlenecks

**Renderer redraws Chart.js even when the data is unchanged.**
- After every `fetchUsageData()`, `loadChart()` runs unconditionally.
- Fix: hash the dataset before rendering; bail out if identical.

**Polling cadence is hardcoded in the renderer at 5 minutes.**
- `UPDATE_INTERVAL = 5 * 60 * 1000` in `src/renderer/app.js`. Settings expose `refreshInterval` but it is not wired in.
- Fix: read `refreshInterval` from settings and reset the timer when settings change.

**Tray icon cycle timer can stack on rapid `set-tray-frames` calls.**
- `startTrayCycle()` clears `trayIconTimer` but a race between renderer pushes can briefly leave two timers active.
- Fix: guard with a sequence number; only the latest push wins.

## Fragile Areas

**Cloudflare bypass via `document.body.innerText`.**
- `src/fetch-via-window.js` extracts the response by reading the rendered text. Any wrapping HTML / shell-frame from Claude.ai breaks this.
- Mitigation today: signature detection raises typed errors. Fragility remains - any non-text envelope is fatal.

**Login BrowserWindow has no absolute timeout.**
- If the user navigates away inside the login window and never returns, the promise never resolves.
- Fix: 15-minute timeout around the cookie listener; resolve with an error if it expires.

**Renderer state lives in module-level `let` variables.**
- ~25 module-level variables in `src/renderer/app.js`. Any future contributor can mutate them in a stale handler. Symptom under stress: stale references after async paths.
- Fix: encapsulate in a single state object exposed only via reducers.

## Scaling Limits

**Not applicable.** Single-user, single-machine desktop widget. No database, no horizontal scaling axis. The 10k-sample / 30-day caps on history are the only practical bounds and are well below the limits of electron-store.

## Dependencies at Risk

**Electron 28 is two majors behind upstream.**
- `package.json#devDependencies.electron: ^28.0.0`. Electron 28 is on extended-support, but Chromium 120 is well past its security-patch window for everything but critical CVEs.
- Plan: stage to 29 -> 30 -> 31 etc. with a small renderer-smoke check after each bump. Pair with `electron-builder` 25 (currently on 24.9).

**`package-lock.json` is gitignored.**
- Reproducibility risk for electron-builder packaging - transitive versions can shift between developer machines and CI.
- Fix options: commit `package-lock.json` (preferred for build reproducibility) and document `npm ci` for installs; or check `npm shrinkwrap`.

**No vulnerability scanning in CI.**
- `.github/workflows/test.yml` runs `npm install --no-audit --no-fund`. Switching to a periodic `npm audit --omit=dev` job would surface new advisories without blocking PRs.

## Missing Critical Features

**No retry / backoff on transient fetch failures.**
- Renderer surfaces "Failed to fetch usage data" on a single failed call and waits the full poll interval before trying again.
- Fix: small in-memory backoff (e.g. 30s -> 60s -> 120s capped) before falling back to the next scheduled poll.

**No offline / last-known fallback.**
- When the API is unreachable, the UI shows an error rather than the most recent buffered sample.
- Fix: render the last sample with a "stale" badge and a relative timestamp.

**CLI has no end-to-end smoke test against a fixture API.**
- Unit tests cover modules; nothing exercises argument parsing -> fetch -> render against a mocked HTTP layer.
- Fix: add a single `tests/cli-e2e.test.js` that boots `bin/cli.js` via `child_process` against a `vi`-mocked endpoint.

## Test Coverage Gaps

**`main.js` has zero unit tests.**
- IPC handlers, history retention, settings side effects, credential encryption round-trip all run untested.
- Priority: high. Even pure helpers from `main.js` (e.g. `applyCompactWindowMode`, settings-side-effects) should be lifted to `src/shared/` and tested.

**`preload.js` is untested.**
- The trust boundary has no spec. A regression in the URL allowlist or in IPC name strings would not be caught.
- Priority: high. Test the preload module in isolation (mock `contextBridge` + `ipcRenderer`).

**Renderer logic is untested.**
- ~2,600 lines of behaviour, none of it covered. Priority: medium - blocked on the `app.js` split (otherwise tests would have to load a giant module).

**No stress test for the history buffer.**
- 10k-cap is asserted in code but never exercised against a 100k-sample input to confirm rotation does not grow memory unboundedly.
- Priority: low. Add a vitest benchmark.

---

*Concerns audit: 2026-05-07*
*Update as items are fixed or new ones surface. Items in the `setup-followups.md` are also tracked here when they affect runtime behaviour.*
