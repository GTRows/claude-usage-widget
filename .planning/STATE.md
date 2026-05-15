# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07)

**Core value:** Give users a lightweight desktop view of Claude and Codex/OpenAI usage across multiple accounts, with quota, rate, and session context visible without opening each provider UI.
**Current focus:** v1.16 post-release maintenance - keep release metadata, planning state, and Codex template health aligned

## Current Position

Phase: Release maintenance
Plan: None active
Status: v1.16.0-gtrows.1 released, tagged, pushed, and published as a prerelease
Last activity: 2026-05-15 - Release commit f7c5c9a and tag v1.16.0-gtrows.1 shipped multi-account Claude/Codex support, Codex automation migration, README refresh, and changelog updates.

Progress: [##########] 100% (v1.16 release complete; maintenance cleanup in progress)

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
| 8. Multi-account and Codex support | 1 | - | - |

**Recent Trend:**
- Last 6 plans: all green (verifier pass)
- Trend: Stable

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.0 shipped as v1.14.0-gtrows.1 on 2026-05-07 (commit 26ff346, tag pushed)
- v1.15 shipped localization, manual update check, drag fixes, and removed the no-op auto-fire feature.
- v1.16 shipped as v1.16.0-gtrows.1 on 2026-05-15 (commit f7c5c9a, tag pushed) with multi-account Claude/Codex support and Codex-native project automation.
- Auto-fire architecture: scheduler -> dispatcher -> channel (web-session OR Anthropic API key); single-flight, 60s debounce; idempotent re-arm
- API key stored encrypted via Electron `safeStorage` (mirroring sessionKey policy)
- Peak-throttle UI removed; shared module retained
- v1.15 milestone scope: hard-remove auto-fire feature (decision 2026-05-08; chose deletion over researching the billable claude.ai endpoint), drag-fix, manual update check, full tr/en localization
- The checked-in project automation is Codex-native. Legacy Claude Code template files were removed after their rules were integrated into `.codex`, `.Codex`, `.agents`, and `AGENTS.md`.

### Deferred Issues

See .planning/ISSUES.md.
- Phase 4 obviates the deferred "replace placeholder auto-fire endpoint and payload" issue (hard removal moots it)
- Phase 7 absorbs the deferred "i18n library decision" issue
- CHANGELOG-Unreleased issue resolved (committed in v1.14.0-gtrows.1 release commit 26ff346)

### Blockers/Concerns

- No active release blocker. Keep GitHub release assets and the branch tip aligned if more doctor cleanup commits are needed after the v1.16 tag.

## Session Continuity

Last session: 2026-05-15
Stopped at: v1.16 release published; running post-release doctor cleanup
Resume file: None
