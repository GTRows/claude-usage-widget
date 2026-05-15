# Roadmap: claude-usage-widget

## Milestones

- **v1.0 auto-window-renewal** [shipped 2026-05-07 as v1.14.0-gtrows.1] - Phases 1-3
- **v1.15 polish + localization** [shipped 2026-05-08] - Phases 4-7
- **v1.16 multi-account + Codex support** [shipped 2026-05-15 as v1.16.0-gtrows.1] - multiple Claude/Codex accounts, Codex-native automation, release docs

## Phases

<details>
<summary>v1.0 auto-window-renewal (Phases 1-3) - SHIPPED 2026-05-07 as v1.14.0-gtrows.1</summary>

### Phase 1: Auto-fire MVP (web session)
**Goal**: Detect window expiry, fire minimal request via existing claude.ai session, single on/off toggle.
**Plans**: 3 plans

Plans:
- [x] 01-01: Window-expiry detector and background scheduler in main process
- [x] 01-02: Web-session auto-fire channel module
- [x] 01-03: Settings on/off toggle + IPC wiring + localized strings

### Phase 2: Anthropic API channel + selector
**Goal**: Add the Anthropic-API channel as an alternative to web session, surface a settings selector, store the API key with the same `safeStorage` policy used for `sessionKey`.
**Plans**: 2 plans

Plans:
- [x] 02-01: Anthropic-API auto-fire channel module + encrypted API-key storage
- [x] 02-02: Settings UI for channel selector and API-key field, IPC handlers

### Phase 3: Peak-throttle soft-deprecate
**Goal**: Default the peak-throttle feature off, remove its banner and settings entry from renderer + CLI surfaces, retain `src/shared/peak-throttle.js` and tests.
**Plans**: 1 plan

Plans:
- [x] 03-01: Default off, hide UI, retain shared module

</details>

<details>
<summary>v1.15 polish + localization - SHIPPED 2026-05-08</summary>

**Milestone Goal:** Drop the auto-fire feature shipped no-op in v1.14, fix the settings-drawer drag regression, expose a manual update check, and ship full tr/en localization.

### Phase 4: Remove auto-fire feature (hard removal)
**Goal**: Remove the auto-fire 5-hour-window-renewal feature shipped in v1.14.0-gtrows.1. The feature was functionally a no-op, so the final implementation removed every auto-fire surface instead of keeping placeholder behavior.
**Plans**: 1 plan

Plans:
- [x] 04-01: Delete every auto-fire surface (modules, tests, IPC, schema, UI, i18n strings); ensure `npm test` is green after removal

### Phase 5: Settings drawer drag fix
**Goal**: When the settings drawer is open and compact mode is off, the widget window remains draggable from the existing drag region.
**Plans**: 1 plan

Plans:
- [x] 05-01: Diagnose root cause in `src/renderer/index.html` + `styles.css` + `app.js`, restore `-webkit-app-region: drag` while drawer is open, manual UAT

### Phase 6: Manual update-check button
**Goal**: Add a "Check for updates" button to the settings drawer that triggers the existing update-check flow on demand and surfaces the result inline.
**Plans**: 1 plan

Plans:
- [x] 06-01: Drawer button + inline status line + last-checked timestamp; reuse existing `check-for-update` IPC and `checkForUpdate` preload bridge

### Phase 7: Localization (tr + en, user-selectable)
**Goal**: Migrate user-facing strings to the project translation layer, ship tr + en source files, default to tr, and persist the user's language choice.
**Plans**: 3 plans

Plans:
- [x] 07-01: i18n library decision + skeleton + persistence (electron-store key, default tr)
- [x] 07-02: String migration across renderer, main, tray, CLI
- [x] 07-03: Settings drawer Language selector + UAT in tr and en

</details>

<details open>
<summary>v1.16 multi-account + Codex support - SHIPPED 2026-05-15 as v1.16.0-gtrows.1</summary>

### Phase 8: Multi-account and Codex support
**Goal**: Convert the app from a single Claude account widget into a multi-account usage monitor that supports Claude and Codex/OpenAI, while migrating the repository automation from Claude Code files to Codex-native files.
**Plans**: 1 plan

Plans:
- [x] 08-01: Add provider/account model, Codex/OpenAI usage fetch, renderer account controls, CLI provider flags, Codex automation migration, README/changelog release updates

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Auto-fire MVP (web session) | v1.0 | 3/3 | Complete | 2026-05-07 |
| 2. Anthropic API channel + selector | v1.0 | 2/2 | Complete | 2026-05-07 |
| 3. Peak-throttle soft-deprecate | v1.0 | 1/1 | Complete | 2026-05-07 |
| 4. Remove auto-fire feature | v1.15 | 1/1 | Complete | 2026-05-08 |
| 5. Settings drawer drag fix | v1.15 | 1/1 | Complete | 2026-05-08 |
| 6. Manual update-check button | v1.15 | 1/1 | Complete | 2026-05-08 |
| 7. Localization (tr + en) | v1.15 | 3/3 | Complete | 2026-05-08 |
| 8. Multi-account + Codex support | v1.16 | 1/1 | Complete | 2026-05-15 |
