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
- **Why deferred:** The exact Claude.ai endpoint and JSON shape that count
  as a billable interaction (and therefore start the next 5-hour bucket)
  are listed as a research item in `.planning/ROADMAP.md` Phase 1. The
  dispatcher, single-flight, debounce, and channel scaffolding can be
  built and tested without that knowledge; locking in the wrong payload
  now would force a rewrite later.
- **Trigger:** ROADMAP Phase 1 research item "claude.ai web-session
  message-send endpoint + payload shape" resolves with a concrete
  endpoint URL and minimal billable JSON body.
- **Owner:** Phase 1 follow-up (Plan 01-02 or a new plan after the
  research lands).

### Add v1.x CHANGELOG entry for auto-fire MVP

- **What:** `CHANGELOG.md` lacks an `## [Unreleased]` section, and Phase 1
  (auto-fire MVP, plans 01-01 through 01-03) has shipped without an entry.
  The release flow (`/gtr:release`) extracts notes from the matching
  `## [x.y.z]` section, so an Unreleased entry is needed before the next
  bump.
- **Why deferred:** `CHANGELOG.md` is protected by
  `pre_guard_release_files.py` and Plan 01-03 Task 5 requires explicit
  user confirmation before editing. The executor running 01-03 had no
  interactive channel to obtain that confirmation.
- **Suggested entry (under `## [Unreleased]` → `### Added`):**
  `Auto-fire: when the active 5-hour usage window expires, the app sends a
  minimal claude.ai web-session request so the next window starts
  immediately. New "Auto-renew 5-hour window" toggle in Settings (default
  off).`
- **Trigger:** User confirms the CHANGELOG edit, or `/gtr:release` runs
  and surfaces the missing Unreleased section.
- **Owner:** Maintainer (manual edit) or `/gtr:release` flow.

### i18n library decision

- **What:** `CLAUDE.md#Localization` and `CONCERNS.md` mark the i18n
  library choice as TBD. Plan 01-03 Task 4 added a tiny inline strings
  table for the auto-fire toggle (`_AUTO_FIRE_STRINGS`, `_autoFireT`,
  `_applyAutoFireStrings`) in `src/renderer/app.js` as a temporary seam.
- **Why deferred:** Picking an i18n library (gettext, JSON, ICU, ...) is
  out of scope for the auto-fire MVP. The inline fallback is intentionally
  narrow (two keys, two languages, no generic loader) so the eventual
  migration touches only the strings table and the lookup helper, not
  the HTML attributes or the toggle wiring.
- **Trigger:** Project picks an i18n library and lands a `t(key)` helper.
- **Owner:** Whoever drives the i18n adoption phase.
