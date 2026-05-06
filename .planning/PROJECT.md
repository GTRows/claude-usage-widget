# claude-usage-widget (GTRows fork)

## What This Is

Cross-platform Electron desktop widget that monitors Claude.ai usage in real time. Always-on overlay polls the user's Claude.ai usage endpoints, plots windowed throughput and session burn-rate, and surfaces rate-limit and quota signals. The GTRows fork extends the upstream widget with workflow features that maximize the user's own 5-hour rate-limit windows.

## Core Value

Make sure the user's 5-hour Claude usage window never starts late: when the previous window expires, the new one starts immediately so the user gets the full runway every cycle.

## Requirements

### Validated

<!-- Inferred from existing codebase (see .planning/codebase/). -->

- ✓ Frameless transparent always-on-top tray widget (Electron 28, vanilla JS) — existing
- ✓ Hidden-BrowserWindow Cloudflare bypass for Claude.ai usage JSON — existing
- ✓ Renderer UI with metric cards, circular timers, Chart.js history graph, settings drawer, login panel, compact mode — existing
- ✓ electron-store persistence for settings, usage history (30-day + 10k-sample rotation), window position — existing
- ✓ Credential encryption via Electron `safeStorage` (plain-text fallback on keychain-less Linux) — existing
- ✓ Tray frame cycling rendered by renderer and pushed to main — existing
- ✓ Headless CLI (`claude-usage` bin) reusing shared modules: `status`, `json`, `watch`, `prompt`, `login`, `organizations`, `history`, `doctor`, `config`, `version`, `help` — existing
- ✓ Peak-throttle detector (weekday 12:00–18:00 UTC) used by renderer + CLI — existing (slated for soft-deprecation)
- ✓ Cross-platform packaging via electron-builder: Windows NSIS + portable, macOS DMG arm64/x64 notarized, Linux AppImage/deb/rpm/pacman/tar.gz — existing
- ✓ Auto-refresh polling (default 5 min) with single-flight guard — existing
- ✓ History export to CSV / JSON via system save dialog — existing
- ✓ vitest unit-test suite over shared utilities — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Auto-fire mini request the moment the active 5-hour usage window expires, so the next window starts immediately instead of waiting for the user's first manual prompt
- [ ] Settings-driven channel selection for the auto-fire request: `claude.ai web session` (consumes 1 message from the new window, no dollar cost) OR `Anthropic API key` (separate paid channel, no quota burn, no bot-flag risk)
- [ ] Minimal-cost request payload: smallest available model, single-character prompt, `max_tokens: 1`, no streaming
- [ ] Background trigger that fires regardless of widget focus state, as long as the app is running
- [ ] Soft-deprecate the peak-throttle feature: default off, hide banner and settings toggle from the UI, keep `src/shared/peak-throttle.js` and tests in place for potential future re-use

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- OS notifications / sounds / tray flash when auto-fire happens — keep v1 silent; notifications are a separate roadmap item that spans more than just this feature
- Manual "fire now" button in the UI — auto-fire is the whole point; a manual button is the existing user behavior, no new value
- Per-organization / multi-account auto-fire — single active organization only in v1; multi-account is a larger cross-cutting concern
- Removing peak-throttle code entirely — soft-deprecate retains optionality if a different rate-limit-window indicator is wanted later
- Auto-fire when the app is closed (background daemon) — only fires while the Electron app process is running
- Channel auto-switching / fallback (e.g., API key fails → fall back to web) — keep it explicit, user picks one

## Context

- **Project type:** Brownfield. Codebase already mapped under `.planning/codebase/` (ARCHITECTURE, STACK, CONVENTIONS, STRUCTURE, INTEGRATIONS, CONCERNS, TESTING).
- **Fork status:** GTRows fork of the upstream `claude-usage-widget`. Current version `1.13.0-gtrows.1` (see `IDENTITY.yaml` and `package.json`). Fork tags carry the `-gtrows.N` suffix.
- **Existing fetch path:** Main process pulls Claude.ai usage JSON via a hidden BrowserWindow that reuses the user's session cookie. Same `sessionKey` is the natural credential for a web-channel auto-fire request.
- **Window detection:** The existing usage polling already exposes the active 5-hour window's reset timestamp (renderer drives circular timers from it). Auto-fire trigger can hook into the same data instead of inventing a new clock.
- **Trust boundary:** All renderer-to-main calls go through `preload.js` over `contextBridge`. New auto-fire IPC handlers and the API-key field must respect this boundary; never enable `nodeIntegration` or disable `contextIsolation`.
- **Localization:** UI strings must be wrapped in the project's translation function (tr/en supported, default tr). The translation library and source format are still TBD; new strings should be added in a way that survives the i18n decision.
- **Bot-flag risk:** A periodic programmatic request via the consumer claude.ai web session is plausibly bot-like behavior. Anthropic-API channel sidesteps this risk entirely. The API-key channel must store the key encrypted via `safeStorage` (with plain-text fallback only where `safeStorage.isEncryptionAvailable()` is false, mirroring the existing `sessionKey` policy).
- **Logging:** Use the existing `[Debug]` / `[Security]` / `[Keychain]` prefixes; no `console.log` for ad-hoc debugging.

## Constraints

- **Tech stack:** Electron 28, vanilla JavaScript only — no TypeScript, no bundler. Main + CLI are CommonJS; renderer is ESM. Indent 2 spaces, LF line endings, semicolons consistent with existing files.
- **Electron security:** `contextIsolation` must stay enabled; `nodeIntegration` must stay disabled. Every new renderer ↔ main call goes through `preload.js`.
- **Module size:** ~200 LOC max per file (per `CLAUDE.md`). Split by responsibility if a module grows past that.
- **Dependencies:** Runtime dependency surface is deliberately tiny (`chart.js` + `electron-store`). Adding a new dependency for the auto-fire feature requires explicit discussion. The Anthropic-API channel can be implemented with Node's built-in `fetch` instead of pulling the SDK.
- **Protected files:** `IDENTITY.yaml`, `package.json`, `package-lock.json`, `CHANGELOG.md`, `electron-builder` config, `.github/workflows/*.yml`, `build/entitlements.mac.plist`, code-signing material — all guarded by the `pre_guard_release_files.py` hook and require explicit user confirmation to edit.
- **Branch policy:** This is a fork. `main` tracks upstream. Never commit directly to `main`; use `feature/<name>` or `fix/<name>` branches and rebase before opening a PR.
- **Commit policy:** Conventional commits in English (`type(scope): description`). User authors all commits via local git config — do NOT add `Co-Authored-By: Claude` trailers (see global memory).
- **Localization:** All new user-facing strings go through the project's translation function (no hard-coded UI text).

## Key Decisions

<!-- Decisions logged during initialization. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Auto-fire trigger style: always-on background while app is running | Maximizes window utilization; fires even when widget is unfocused or in tray | — Pending |
| Auto-fire channel: user-selectable between `claude.ai web session` and `Anthropic API key` | Web channel is free-of-money but burns 1 quota message and carries bot-flag risk; API key avoids both at the cost of dollars. Letting the user pick keeps the trade-off explicit. | — Pending |
| Request shape: smallest model + 1-char prompt + `max_tokens: 1`, no streaming | Lowest possible token spend on either channel while still triggering the new 5h window | — Pending |
| Peak-throttle handling: soft-deprecate (default off, UI hidden, code retained) | Anthropic peak-throttle window is no longer in effect; full removal forecloses re-using the detector if a different rate-limit-window indicator is added later | — Pending |
| v1 boundaries: no notifications, no manual fire button, single-org only | Keeps the feature tightly scoped; each excluded item is a separately-justified follow-up rather than a hidden requirement | — Pending |
| Anthropic API key storage: same policy as `sessionKey` (`safeStorage` encrypted, plain-text only when `safeStorage.isEncryptionAvailable()` is false) | Re-uses the existing, already-audited credential pathway; avoids inventing a second secret-storage scheme | — Pending |

---
*Last updated: 2026-05-07 after initialization*
