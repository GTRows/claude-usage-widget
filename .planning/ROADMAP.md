# Roadmap: claude-usage-widget (auto-window-renewal)

## Overview

Deliver the GTRows fork's headline feature: when the active 5-hour Claude usage window expires, automatically fire a minimal request so the next window starts immediately. Ship the web-session channel first as an MVP, then layer in the Anthropic API channel with a user-facing channel selector. Finish by soft-deprecating the peak-throttle UI now that the underlying Anthropic policy is no longer in effect.

## Domain Expertise

None.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Auto-fire MVP (web session)** - Detect window expiry, fire minimal request via existing claude.ai session, single on/off toggle
- [ ] **Phase 2: Anthropic API channel + selector** - Add API-key channel, settings UI to pick channel, encrypted API-key storage
- [ ] **Phase 3: Peak-throttle soft-deprecate** - Default off, hide banner and settings toggle, retain module

## Phase Details

### Phase 1: Auto-fire MVP (web session)
**Goal**: When the active 5-hour usage window expires, auto-fire a minimal claude.ai request via the existing web session so the next window starts immediately. Single on/off toggle in settings; no channel picker yet.
**Depends on**: Nothing (first phase)
**Research**: Likely (claude.ai prompt-send endpoint shape and smallest-cost payload not yet established in this codebase)
**Research topics**: claude.ai web-session message-send endpoint + payload shape, smallest available model id, single-flight semantics that avoid double-fire across renderer/main, exact reset-timestamp source already exposed by usage polling
**Plans**: 3 plans

Plans:
- [ ] 01-01: Window-expiry detector and background scheduler in main process (hook into existing usage poll, fire trigger event when reset timestamp passes)
- [ ] 01-02: Web-session auto-fire channel module (build minimal request: smallest model, 1-char prompt, max_tokens=1, no streaming; reuse existing sessionKey path)
- [ ] 01-03: Settings on/off toggle + IPC wiring + localized strings for the new control

### Phase 2: Anthropic API channel + selector
**Goal**: Add the Anthropic-API channel as an alternative to web session, surface a settings selector, and store the API key with the same `safeStorage` policy used for `sessionKey`. End-to-end auto-fire works on either channel based on user choice.
**Depends on**: Phase 1
**Research**: Likely (Anthropic Messages API minimal payload + current smallest model id; safeStorage already used in repo so storage pattern is known but the API shape is new to this fork)
**Research topics**: Anthropic Messages endpoint shape via Node `fetch` (no SDK), current smallest/cheapest model id, max_tokens=1 + 1-char input edge cases, error/auth-failure handling boundaries
**Plans**: 2 plans

Plans:
- [ ] 02-01: Anthropic-API auto-fire channel module + encrypted API-key storage via `safeStorage` (mirroring sessionKey policy)
- [ ] 02-02: Settings UI for channel selector and API-key field, localized strings, IPC handlers, channel dispatch in the trigger

### Phase 3: Peak-throttle soft-deprecate
**Goal**: Default the peak-throttle feature off, hide its banner and settings toggle from the UI, but keep `src/shared/peak-throttle.js` and its tests intact for potential future reuse.
**Depends on**: Phase 2
**Research**: Unlikely (internal UI/config change, established patterns)
**Plans**: 1 plan

Plans:
- [ ] 03-01: Flip default to off, remove peak-throttle banner and settings entry from renderer + CLI surfaces, leave shared module and tests untouched

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auto-fire MVP (web session) | 0/3 | Not started | - |
| 2. Anthropic API channel + selector | 0/2 | Not started | - |
| 3. Peak-throttle soft-deprecate | 0/1 | Not started | - |
