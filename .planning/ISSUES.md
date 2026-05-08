# Deferred Issues

Issues that are known, scoped, and intentionally not fixed in the current
plan. Each entry must list: what, why deferred, concrete trigger that
unblocks it, owner.

## Open

(none)

## Closed

### Replace placeholder auto-fire endpoint and payload — OBVIATED 2026-05-08

- Resolved by decision to hard-remove the auto-fire feature instead of
  researching the billable claude.ai endpoint. v1.15 Phase 4 deletes
  every auto-fire surface (modules, tests, IPC, schema, UI, i18n
  strings); the placeholder payload becomes a non-issue because the
  code that uses it ceases to exist.

### Add v1.x CHANGELOG entry for auto-fire MVP — RESOLVED 2026-05-07

- Resolved by `chore(release): v1.14.0-gtrows.1` (commit 26ff346) which
  added the full release block to `CHANGELOG.md` covering Phase 1, 2, 3
  scope (auto-window-renewal feature + peak-throttle soft-deprecate).

### i18n library decision — MOVED 2026-05-08

- Moved into v1.15 Phase 7 Localization. Plan 07-01 owns the decision
  gate (i18next vs format-js vs minimal home-grown `t()`; JSON vs ICU vs
  gettext) and the skeleton + persistence work. The inline
  `_AUTO_FIRE_STRINGS` seam in `src/renderer/app.js` will be replaced
  during plan 07-02 string migration.
