# Technology Stack

**Analysis Date:** 2026-05-07

## Languages

**Primary:**
- JavaScript - All application code (Electron main, renderer, preload, CLI, shared utilities)

**No TypeScript.** Pure ES2022+ JavaScript. File extensions: `.js` throughout.

## Runtime

**Environment:**
- Node.js `>=18.0.0` (per `package.json#engines`); CI matrix covers Node 18 and 20
- Electron `^28.0.0` as the desktop runtime

**Package Manager:**
- npm `>=9.0.0` (per `package.json#engines`)
- Lockfile: `package-lock.json` is **gitignored on purpose** in this fork (see `.gitignore`); reproducibility is a known risk — see `CONCERNS.md`

## Frameworks

**Core:**
- Electron `^28.0.0` - main desktop application framework
- electron-store `^8.1.0` - persistent JSON-based configuration and usage history (no encryption at the file layer; encryption handled via Electron `safeStorage` API for credentials)
- Chart.js `^4.5.1` - usage trend visualization in the renderer

**Testing:**
- vitest `^1.6.0` - unit-test runner (`npm test`, `npm run test:watch`)

**Build/Dev:**
- electron-builder `^24.9.1` - cross-platform packaging
- @electron/notarize `^3.1.1` - macOS code signing / notarization
- cross-env `^7.0.3` - cross-platform env-var setting (used by `npm run dev`)

## Key Dependencies

**Critical:**
- `electron-store` - Persistent settings, usage history, window position, credentials fallback
- `chart.js` - Renders usage cards and history graph
- `@electron/notarize` - Required for macOS App Store / Gatekeeper compliance via electron-builder

**Infrastructure:**
- `cross-env` - Ensures `NODE_ENV=development` works on Windows + macOS + Linux
- `electron-builder` - Generates platform-specific installers (NSIS, DMG, AppImage, deb, rpm, pacman, tar.gz)

## Configuration

**Environment (build-time, GitHub Actions secrets):**
- `GH_TOKEN` - Release upload
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` - macOS notarization
- `CSC_LINK`, `CSC_KEY_PASSWORD`, `CSC_KEYCHAIN` - macOS code-signing certificate

**Environment (runtime, optional):**
- `DEBUG_LOG=1` - Verbose console logging in main process; equivalent to launching with `--debug`
- `NODE_ENV=development` - Opens DevTools, disables some packaging optimizations
- `CLAUDE_SESSION_KEY`, `CLAUDE_ORGANIZATION_ID` - CLI credentials (override config file)
- `CLAUDE_USAGE_CONFIG_DIR` - Override CLI config directory
- `CLAUDE_USAGE_WIDGET_DIR` - Override widget data directory used by CLI for history access
- `APPDATA` (Windows), `XDG_CONFIG_HOME` (Linux) - Platform fallback bases

**Build:**
- `package.json#build` - Inline electron-builder configuration (Windows NSIS + portable, macOS DMG arm64+x64 with notarization, Linux AppImage / deb / rpm / pacman / tar.gz on x64+arm64)
- `build/entitlements.mac.plist` - macOS hardened runtime entitlements

## Platform Requirements

**Development:**
- Node.js 18 or 20 + npm 9+
- macOS: Xcode command-line tools + Apple Developer account for notarization
- Windows: Visual Studio Build Tools (only if native modules need compilation)
- Linux: GCC / build-essential / libx11-dev / libxext-dev (Electron native modules)

**Production:**
- Windows: NSIS installer + portable EXE
- macOS: Notarized DMG (arm64 + x64), Team ID `X84UXCNLPX`
- Linux: AppImage, deb, rpm, pacman, tar.gz on x64 + arm64
- Distributed via GitHub Releases (no auto-updater channel; `package.json#build.publish` is `null`)

---

*Stack analysis: 2026-05-07*
*Update after major dependency changes (especially when bumping Electron major).*
