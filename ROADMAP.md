# Roadmap

GTRows fork of claude-usage-widget. Tracks planned work beyond the
current Windows-focused desktop build.

## Shipped in 1.9.0-gtrows.1

- [x] Fork rebrand and MIT-compliant licensing
- [x] Frameless transparent window with rounded corners
- [x] Compact mode polish (instant exit, taskbar hiding, position restore)
- [x] Animated mascot tray with per-status expressions
- [x] Login screen redesign
- [x] Additional theme styles (nord, sunset, mono)
- [x] Independent hide-from-taskbar setting
- [x] Auto-prune history settings

## Shipped in 1.10.0-gtrows.1

- [x] CLI companion `claude-usage` (status / watch / json / prompt /
      login / organizations / config)
- [x] Shared `src/shared/` utility modules (version, thresholds,
      formatters, history, settings schema)
- [x] Headless start mode (launch hidden into the tray)
- [x] Export usage history as CSV or JSON (settings → Data)
- [x] Configurable warn / danger thresholds (already existed in
      settings; verified surfaced in UI)
- [x] CI matrix workflow (`.github/workflows/test.yml`) running
      vitest on Linux, macOS, Windows under Node 18 + 20
- [x] Unit test suite with 55+ cases (`npm test`)
- [x] Shell prompt integration snippets (bash / zsh / fish / pwsh)
      under `docs/prompts/`
- [x] CLI: `claude-usage history --since N --format csv|json` reading
      the widget's stored history (with `--output FILE` for piping)
- [x] Export filter by date range in the settings dialog (All / 24h /
      7d / 30d / 90d)

## Now (in progress / next short term)

- [ ] Refresh visual assets (carried over from upstream)
  - Replace app icon set (assets/icon.ico, icon.icns, logo.png) with
    GTRows-fork artwork
  - Update tray fallback images and any in-app screenshots in README
  - Re-export Windows installer banner / NSIS sidebar art
- [ ] Verify and polish macOS build
  - Test transparent window + rounded corners on macOS (vibrancy vs.
    plain transparency)
  - Validate tray icon rendering at Retina scale (template images,
    monochrome mode)
  - Confirm notarization pipeline still works under GTRows team ID
  - Fix menu bar positioning for compact popup mode
- [ ] Verify and polish Linux build
  - Test AppImage on GNOME and KDE
  - Validate AppIndicator / StatusNotifier tray support across distros
  - Handle Wayland transparency quirks (fall back to opaque if needed)
  - Document required system tray extensions for GNOME users
- [ ] Cross-platform settings storage path audit
- [ ] CI matrix builds for Windows / macOS (x64 + arm64) / Linux
      (build artifacts, not just tests)

## Later (medium term)

- [ ] Per-account multi-profile support (switch between work/personal
      Claude accounts) — sketch: profiles map in store, accessor
      indirection, per-profile sessionKey + organizationId + history
- [ ] Per-status configurable mascot expressions (let users override
      the default eye/mouth combos for warn/danger/dead)
- [ ] Configurable refresh interval per profile / per metric

## Exploration (not committed)

- [ ] Web/PWA build that talks to the same backend, for users on
      machines where they cannot install Electron
- [ ] Browser extension variant (popup + badge counter)
- [ ] Plugin API for custom mascot skins / sound effects
- [ ] Localization (en, tr, de, es, fr, ja)
- [ ] Auto-update channel separate from upstream
- [ ] Optional anonymized telemetry to compare quotas across users
      (opt-in only, never on by default)

## Non-goals

- Mobile native apps (Claude is primarily a desktop workflow)
- Reverse-engineering or scraping beyond what the official session
  cookie already permits
- Bundling third-party trackers or ads
