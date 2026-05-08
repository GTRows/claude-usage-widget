# Roadmap: claude-usage-widget

## Milestones

- **v1.0 auto-window-renewal** [shipped 2026-05-07 as v1.14.0-gtrows.1] — Phases 1-3
- **v1.15 polish + localization** [in progress] — Phases 4-7

## Phases

<details>
<summary>v1.0 auto-window-renewal (Phases 1-3) — SHIPPED 2026-05-07 as v1.14.0-gtrows.1</summary>

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

### v1.15 polish + localization (In Progress)

**Milestone Goal:** Drop the auto-fire feature shipped no-op in v1.14, fix the settings-drawer drag regression, expose a manual update check, and ship full tr/en localization.

#### Phase 4: Remove auto-fire feature (hard removal)
**Goal**: Remove the auto-fire 5-hour-window-renewal feature shipped in v1.14.0-gtrows.1. The feature is functionally a no-op (placeholder payload that never starts a real 5h window) and we have decided to drop it rather than research the billable claude.ai endpoint. After this phase the codebase contains zero auto-fire references; any user who toggled the setting on simply has the now-orphan key silently dropped on next save.
**Depends on**: Nothing
**Research**: Unlikely (deletion-only — touches files added in phases 1-2)
**Plans**: TBD (likely 1-2 plans, planner decides)

Removal targets:
- `src/main/auto-fire/{scheduler,dispatcher,web-channel,api-channel}.js`
- `tests/auto-fire-{scheduler,dispatcher,web-channel,api-channel}.test.js`
- `main.js`: require + scheduler arm/disarm wiring + before-quit + dispatcher start/stop + `save-api-key` / `clear-api-key` / `has-api-key` IPC handlers + apiKey wipe in `delete-credentials`
- `preload.js`: `saveApiKey` / `clearApiKey` / `hasApiKey` bridges
- `src/shared/settings-schema.js`: `autoFireEnabled`, `autoFireChannel` keys + their tests
- `src/renderer/index.html`: auto-renew toggle row, channel selector row, api-key input row
- `src/renderer/app.js`: `_AUTO_FIRE_STRINGS`, `_autoFireT`, `_applyAutoFireStrings`, hydration in `loadSettings`, `autoFireChannel` save path, change/click listeners, status helpers

Plans:
- [x] 04-01: Delete every auto-fire surface (modules, tests, IPC, schema, UI, i18n strings); ensure `npm test` is green after removal

#### Phase 5: Settings drawer drag fix
**Goal**: When the settings drawer is open and compact mode is off, the widget window must remain draggable from the existing drag region. Currently it isn't — the drawer either covers the drag region or the drag CSS rule drops out when the drawer opens.
**Depends on**: Nothing (independent UI fix)
**Research**: Unlikely (CSS / markup change in renderer)
**Plans**: 1 plan

Plans:
- [x] 05-01: Diagnose root cause in `src/renderer/index.html` + `styles.css` + `app.js`, restore `-webkit-app-region: drag` while drawer is open, manual UAT

#### Phase 6: Manual update-check button
**Goal**: Add a "Check for updates" button to the settings drawer that triggers the existing update-check flow on demand and surfaces the result inline.
**Depends on**: Phase 5 (drawer markup unblocked) — soft dependency, can also run independently
**Research**: Unlikely (existing update-check helper is in shared code)
**Plans**: 1 plan

Plans:
- [x] 06-01: Drawer button + inline status line + last-checked timestamp; reused existing `check-for-update` IPC and `checkForUpdate` preload bridge (no new IPC/preload); inline English literals to be migrated by Phase 7

#### Phase 7: Localization (tr + en, user-selectable)
**Goal**: Resolve the deferred i18n library decision, migrate every hardcoded UI string to a `t()` seam, ship tr + en source files (default tr per `CLAUDE.md`), add a Language selector to the settings drawer, persist the choice.
**Depends on**: Phase 4 (auto-fire UI is gone before string migration so the migration sweep isn't fighting code that's about to be deleted)
**Research**: Likely (library / format decision)
**Research topics**: i18next vs format-js vs minimal home-grown `t()`; JSON vs ICU vs gettext source format; renderer-only vs main+renderer reach; placeholder/plural handling
**Plans**: 3 plans

Plans:
- [x] 07-01: i18n library decision + skeleton + persistence (electron-store key, default tr)
- [x] 07-02: String migration across renderer, main, tray, CLI
- [x] 07-03: Settings drawer Language selector + UAT in tr and en

## Progress

**Execution Order:**
Phases execute in numeric order: 4 -> 5 -> 6 -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Auto-fire MVP (web session) | v1.0 | 3/3 | Complete | 2026-05-07 |
| 2. Anthropic API channel + selector | v1.0 | 2/2 | Complete | 2026-05-07 |
| 3. Peak-throttle soft-deprecate | v1.0 | 1/1 | Complete | 2026-05-07 |
| 4. Remove auto-fire feature | v1.15 | 1/1 | Complete | 2026-05-08 |
| 5. Settings drawer drag fix | v1.15 | 1/1 | Complete | 2026-05-08 |
| 6. Manual update-check button | v1.15 | 1/1 | Complete | 2026-05-08 |
| 7. Localization (tr + en) | v1.15 | 3/3 | Complete | 2026-05-08 |
