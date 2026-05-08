# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** Make sure the user's 5-hour Claude usage window never starts late: when the previous window expires, the new one starts immediately so the user gets the full runway every cycle.
**Current focus:** v1.15 milestone closeout - all phases (4-7) shipped, awaiting release decision

## Current Position

Phase: 7 of 7 (Localization tr+en)
Plan: 07-01, 07-02, 07-03 all complete
Status: Milestone v1.15 closeout - awaiting release decision
Last activity: 2026-05-08 - Phase 7 (i18n) shipped: 07-01 skeleton (5 commits), 07-02 string migration (8 commits, 243 keys/locale), 07-03 Language selector + UAT (4 commits); all verifier pass

Progress: [##########] 100% (7 of 7 phases complete; v1.15 ready to release)

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (3 phases x 1-3 plans)
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Auto-fire MVP (web session) | 3 | - | - |
| 2. API channel + selector | 2 | - | - |
| 3. Peak-throttle soft-deprecate | 1 | - | - |

**Recent Trend:**
- Last 6 plans: all green (verifier pass)
- Trend: Stable

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.0 shipped as v1.14.0-gtrows.1 on 2026-05-07 (commit 26ff346, tag pushed)
- Auto-fire architecture: scheduler -> dispatcher -> channel (web-session OR Anthropic API key); single-flight, 60s debounce; idempotent re-arm
- API key stored encrypted via Electron `safeStorage` (mirroring sessionKey policy)
- Peak-throttle UI removed; shared module retained
- v1.15 milestone scope: hard-remove auto-fire feature (decision 2026-05-08; chose deletion over researching the billable claude.ai endpoint), drag-fix, manual update check, full tr/en localization

### Deferred Issues

See .planning/ISSUES.md.
- Phase 4 obviates the deferred "replace placeholder auto-fire endpoint and payload" issue (hard removal moots it)
- Phase 7 absorbs the deferred "i18n library decision" issue
- CHANGELOG-Unreleased issue resolved (committed in v1.14.0-gtrows.1 release commit 26ff346)

### Blockers/Concerns

- v1.14.0-gtrows.1 ships an auto-fire feature that does NOT actually start the next 5-hour window (placeholder payload). Phase 4 removes the feature; ship v1.15 before users discover the no-op.

## Session Continuity

Last session: 2026-05-08
Stopped at: Phase 4 pivoted to hard-remove auto-fire; ready to plan
Resume file: None
