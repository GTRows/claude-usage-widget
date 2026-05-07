# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** Make sure the user's 5-hour Claude usage window never starts late: when the previous window expires, the new one starts immediately so the user gets the full runway every cycle.
**Current focus:** Phase 4 - Replace placeholder auto-fire payload (v1.15 milestone)

## Current Position

Phase: 4 of 7 (Replace placeholder auto-fire payload)
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-08 - v1.0 milestone closed (v1.14.0-gtrows.1 shipped); v1.15 roadmap added

Progress: [#####.....] 50% (3 of 7 phases complete; v1.15 not yet started)

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
- v1.15 milestone scope: payload fix (CRITICAL — v1.14 auto-fire is currently a no-op), drag-fix, manual update check, full tr/en localization

### Deferred Issues

See .planning/ISSUES.md.
- Phase 4 absorbs the deferred "replace placeholder auto-fire endpoint and payload" issue
- Phase 7 absorbs the deferred "i18n library decision" issue
- CHANGELOG-Unreleased issue resolved (committed in v1.14.0-gtrows.1 release commit 26ff346)

### Blockers/Concerns

- v1.14.0-gtrows.1 ships a feature that does NOT actually start the next 5-hour window because the web-channel payload is a placeholder. Phase 4 must land before users rely on the toggle.

## Session Continuity

Last session: 2026-05-08
Stopped at: v1.0 milestone closed; v1.15 roadmap defined; Phase 4 ready to plan
Resume file: None
