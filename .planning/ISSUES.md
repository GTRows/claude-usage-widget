# Deferred Issues

Issues that are known, scoped, and intentionally not fixed in the current
plan. Each entry must list: what, why deferred, concrete trigger that
unblocks it, owner.

## Open

### Replace placeholder auto-fire endpoint and payload

- **What:** `src/main/auto-fire/web-channel.js` posts a placeholder
  `{ name: '', uuid: null }` body to
  `https://claude.ai/api/organizations/{orgId}/chat_conversations`. This is
  almost certainly not a billable interaction, so flipping
  `autoFireEnabled = true` will not actually start the next 5-hour window.
  This means v1.14.0-gtrows.1 ships an auto-fire feature that is a no-op
  in practice.
- **Why deferred:** The exact Claude.ai endpoint and JSON shape that count
  as a billable interaction (and therefore start the next 5-hour bucket)
  are listed as a research item in `.planning/ROADMAP.md` Phase 1. The
  dispatcher, single-flight, debounce, and channel scaffolding can be
  built and tested without that knowledge; locking in the wrong payload
  now would force a rewrite later.
- **Trigger:** v1.15 Phase 4 absorbs this. Research the billable endpoint,
  update `web-channel.js`, add an integration-shaped test, manual UAT
  against a real 5-hour expiry.
- **Owner:** Phase 4 (v1.15).

## Closed

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
