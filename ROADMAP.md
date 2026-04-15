# Roadmap

GTRows fork of claude-usage-widget. Tracks planned work beyond the
current Windows-focused desktop build.

## Now (in progress)

- [x] Fork rebrand and MIT-compliant licensing
- [x] Frameless transparent window with rounded corners
- [x] Compact mode polish (instant exit, taskbar hiding, position restore)
- [x] Animated mascot tray with per-status expressions
- [x] Login screen redesign
- [x] Additional theme styles (nord, sunset, mono)
- [x] Independent hide-from-taskbar setting
- [x] Auto-prune history settings

## Next (short term)

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

## Later (medium term)

- [ ] CLI companion `claude-usage`
  - `claude-usage status` prints current 5-hour and weekly usage to stdout
  - `claude-usage watch` streams updates suitable for tmux/zsh prompt
  - `claude-usage json` machine-readable output for scripting
  - Shared session-key store with the desktop widget
  - Optional shell prompt integration snippets (bash, zsh, fish, pwsh)
- [ ] Headless mode: run the data-fetch loop without showing a window,
      for users who only want the tray icon or CLI
- [ ] Configurable thresholds for warn / danger / dead mascot states
- [ ] Per-account multi-profile support (switch between work/personal
      Claude accounts)
- [ ] Export usage history as CSV / JSON
- [ ] Optional desktop notifications when crossing thresholds

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
