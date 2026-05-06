# External Integrations

**Analysis Date:** 2026-05-07

## APIs & External Services

**Claude.ai Usage API:**
- Service: Claude.ai (`https://claude.ai/api/...`) - usage telemetry the user is already authenticated to
- Endpoints used:
  - `GET /api/organizations/{organizationId}/usage` - 5-hour and 7-day usage utilization, model breakdown
  - `GET /api/organizations/{organizationId}/overage_spend_limit` - extra-spend / overage credit balance
  - `GET /api/organizations/{organizationId}/prepaid/credits` - prepaid credit balance
  - `GET /api/organizations` - list organizations accessible to the session
- Auth: Cookie-based (`sessionKey` HTTP cookie)
- Headers sent: `cookie: sessionKey={value}`, `accept: application/json`, spoofed Chrome `user-agent` (`CHROME_USER_AGENT` constant in `main.js`)
- Cloudflare bypass: Electron path uses a hidden `BrowserWindow` (`src/fetch-via-window.js`) to render the page and pull JSON from `document.body.innerText`. CLI path (`src/cli/api.js`) uses plain Node `fetch` and detects HTML responses (`startsWith('<')`) as `CloudflareBlocked`.
- Error handling: typed error codes - `SESSION_EXPIRED`, `CLOUDFLARE`, `UnexpectedHTML` - returned through main process to the renderer or CLI.

**GitHub Releases API (update check):**
- Service: GitHub - `GET https://api.github.com/repos/GTRows/claude-usage-widget/releases?per_page=20`
- Auth: None (public repo)
- Headers: `User-Agent: claude-usage-widget`, `Accept: application/vnd.github+json`
- Timeout: 5s
- Caller: `main.js` `check-for-update` IPC handler

**Login browser window:**
- Opens `https://claude.ai/login` in a visible `BrowserWindow` (see `main.js` `detect-session-key` handler)
- Listens for the `sessionKey` cookie being set after the user logs in normally
- Why: Cloudflare blocks embedded Electron logins; browser-based login is the only reliable path

## Data Storage

**electron-store (primary, on the user's machine):**
- macOS: `~/Library/Application Support/claude-usage-widget/config.json`
- Windows: `%APPDATA%\claude-usage-widget\config.json`
- Linux: `$XDG_CONFIG_HOME/claude-usage-widget/config.json` (fallback `~/.config/claude-usage-widget/config.json`)
- Stores:
  - `sessionKey_encrypted` - base64-encoded ciphertext via Electron `safeStorage` (OS keychain / DPAPI)
  - `sessionKey` - legacy plain-text fallback when keychain unavailable
  - `organizationId`
  - `usageHistory` - rotated array of timestamped samples (30-day cutoff + 10k-sample cap)
  - `settings.*` - all user preferences (`SETTINGS_DEFAULTS` in `src/shared/settings-schema.js`)
  - `windowPosition` - `{x, y}` for widget placement

**CLI config (separate from widget):**
- macOS: `~/Library/Application Support/claude-usage-cli/config.json`
- Windows: `%APPDATA%\claude-usage-cli\config.json`
- Linux: `$XDG_CONFIG_HOME/claude-usage/config.json`
- Stores: `sessionKey`, `organizationId`
- File mode: `0o600` (user read/write only)

**Widget store read by CLI:**
- The CLI's `history` command reads the widget's `usageHistory` array from the same `config.json` location used by the widget
- Override via `CLAUDE_USAGE_WIDGET_DIR` env var (`src/cli/widget-store.js`)

## Authentication & Identity

**Session key (cookie-based):**
- Captured during the login flow and persisted via `safeStorage.encryptString()` (OS keychain) when available
- Linux frequently has no keychain; in that case the session key falls back to plain text in `config.json` (documented downgrade)
- Sent as `cookie: sessionKey={value}` on every Claude.ai API call; also installed into Electron's `session.defaultSession` cookie jar for the hidden fetch BrowserWindow

**Organization ID:**
- Auto-detected via `GET /api/organizations` after a successful login; can also be entered manually
- Required path component for all usage endpoints

**CLI authentication precedence:**
1. `CLAUDE_SESSION_KEY` + `CLAUDE_ORGANIZATION_ID` env vars (override everything)
2. `~/.config/claude-usage/config.json` (or platform equivalent)
3. Otherwise `loadCredentials()` returns nulls and the CLI prints a friendly error

## Monitoring & Observability

**No telemetry. No analytics. No remote logging.** Explicitly stated in `CLAUDE.md`. The only outbound traffic is to Claude.ai (usage data the user owns) and GitHub Releases (update check, unauthenticated).

**Local debug logging:**
- Main process: `DEBUG_LOG=1` env var or `--debug` flag enables `[Debug]` console output
- Renderer: `?debug` query param enables verbose logs in DevTools
- Production users see only critical errors

## CI/CD & Deployment

**GitHub Actions workflows (`.github/workflows/`):**
- `test.yml` - matrix `{macos, windows, ubuntu} x {node 18, 20}` running `npm install --no-audit --no-fund` then `npm test` plus CLI smoke tests, on push/PR/manual
- `build-windows.yml` - manual `workflow_dispatch`, produces NSIS + portable artifacts
- `build-macos.yml` - manual `workflow_dispatch`, produces notarized DMG (arm64 + x64), uses `@electron/notarize` and the Apple / CSC secrets
- `build-linux.yml` - manual `workflow_dispatch`, produces AppImage / deb / rpm / pacman / tar.gz (x64 + arm64)

**electron-builder (inline in `package.json#build`):**
- App ID: `com.gtrows.claudewidget`
- Product Name: `Claude-Usage-Widget`
- Publish: `null` - no auto-update channel; releases are uploaded manually to GitHub Releases
- macOS hardened runtime + notarization via `build/entitlements.mac.plist`

**Release governance:**
- `IDENTITY.yaml` is the single source of truth for name, version, license, icon, platforms
- `CHANGELOG.md` follows Keep a Changelog
- `/gtr:release <version>` performs the mechanical bump; push is always manual

## Environment Configuration

**Development:**
- Optional: `DEBUG_LOG=1`, `NODE_ENV=development`
- No `.env` file is required; the app launches with no env vars set

**Staging:**
- Not used. Releases go directly to GitHub.

**Production:**
- Secrets management: GitHub Actions repository secrets (Apple notarization + CSC + GH_TOKEN)
- No server-side state; nothing to fail over

## Webhooks & Callbacks

**None.** The app does not run an HTTP server, does not expose any callback URL, and does not receive incoming webhooks. All external HTTP is outbound (Claude.ai API + GitHub Releases polling).

---

*Integration audit: 2026-05-07*
*Update when adding/removing external services or changing the Cloudflare-bypass strategy.*
