# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## First-time setup check

Before doing any coding work, check for `.claude/.setup-complete`.
- If missing: recommend `/gtr:setup` to the user and wait for confirmation before starting implementation. Read-only questions and template maintenance are fine without it.
- If present: proceed normally.

## Available commands

- `/gtr:menu` - interactive entry point. Pick what to do, Claude routes to the right command.
- `/gtr:help` - list every template command, hook, and file in this repo.
- `/gtr:setup` - first-time wizard (only needed once per clone).
- `/gtr:set-language [lang]` - set or change the conversation language.
- `/gtr:onboard` - interactive runbook to merge the template into an existing project.
- `/gtr:update` - pull template updates from upstream and merge them non-destructively.
- `/gtr:doctor` - read-only health check (also reports template version drift and manifest drift).
- `/gtr:orchestrate [scope]` - run phases end-to-end via planner/executor/verifier subagents.
- `/gtr:release <version>` - prepare a release (bump, rotate CHANGELOG, commit, tag). Never pushes.
- Plugin commands: `/commit`, `/commit-push-pr`, `/review-pr`, `/revise-claude-md`.

## Planning workflow (GSD)

Planning and execution are delegated to GSD - a plugin that produces durable, disk-backed phase plans and runs each plan in an isolated subagent.

Two layers:

1. GSD planning artifacts (persistent) - `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/phases/<N>-<name>/<N>-<P>-PLAN.md`. Survives sessions.
2. Built-in TaskCreate (ephemeral) - current-session subtask breakdown of the in-flight plan. Do not mirror plan content into it.

When starting work:
- Existing codebase: `/gsd:map-codebase` first if no `.planning/` exists, then `/gsd:new-project`.
- Plan a phase: `/gsd:plan-phase <N>`.
- Execute a plan: `/gsd:execute-plan <path>`.
- Resume after a break: `/gsd:resume-work` or `/gsd:progress`.
- Insert urgent work: `/gsd:insert-phase <after-N> "<description>"`.

Always finish the in-flight plan before starting another. Use `/gsd:pause-work` to capture context if you must stop mid-plan.

## Project Overview

**Name:** claude-usage-widget (GTRows fork)
**Description:** Desktop widget for Claude.ai usage monitoring. Lightweight always-on overlay that polls Claude usage data, plots windowed throughput and session burn-rate, and surfaces peak-throttle and quota notifications.
**Tech Stack:** Electron 28, vanilla JavaScript (ESM in renderer, CommonJS in main), Chart.js 4, electron-store, vitest. No TypeScript, no bundler.
**Platform:** Cross-platform desktop - Windows (NSIS + portable), macOS (DMG arm64/x64, notarized), Linux (AppImage, deb, rpm, pacman, tar.gz).

## Architecture

### Entry Flow

- `main.js` - Electron main process. Owns the BrowserWindow, the system tray, IPC handlers, electron-store persistence, and the global keyboard shortcuts.
- `bin/cli.js` - Standalone CLI entry registered as the `claude-usage` bin. Reuses the data-fetch and rendering code paths headlessly.
- `index.html` + `renderer/` - Renderer process. Loads the chart, the controls, and the settings drawer. Communicates with main via `preload.js`.

### Module Breakdown

- `main.js` - app lifecycle, window state, tray menu, IPC, settings persistence, shortcut registration.
- `preload.js` - context-isolated bridge (`contextBridge` exposes a narrow API surface).
- `renderer/` - UI: chart rendering (Chart.js), settings panel, drag-to-move, peak-throttle indicator.
- `bin/cli.js` - terminal-mode renderer for the same data.
- `assets/` - icons (.ico / .icns / .png) and packaging logos.
- `build/` - macOS notarization entitlements (`entitlements.mac.plist`).
- `test/` - vitest specs. Run with `npm test`.

### Data Storage

- User settings, window geometry, and cached samples live in electron-store under the OS user data directory (`%APPDATA%\Claude-Usage-Widget` on Windows, `~/Library/Application Support/Claude-Usage-Widget` on macOS, `~/.config/Claude-Usage-Widget` on Linux).
- No telemetry. No external API beyond Claude.ai usage endpoints the user is already authenticated to.

## Development Commands

```bash
# Install dependencies
npm install

# Run the Electron app
npm start

# Run with NODE_ENV=development (DevTools, verbose logs)
npm run dev

# Run vitest (unit tests)
npm test
npm run test:watch

# Run the CLI
npm run cli

# Build for current platform
npm run build

# Per-platform builds
npm run build:win
npm run build:mac
npm run build:linux
```

## Code Standards

- **Language:** All code, comments, variable names, and identifiers must be in English.
- **No emojis:** Do not use emojis anywhere in code, comments, or responses.
- **Module style:** main process + CLI use CommonJS (`require`/`module.exports`). Renderer modules use ESM (`import`/`export`) and load via `<script type="module">`.
- **Indent:** 2 spaces (see `.editorconfig`). LF line endings.
- **JS conventions:** ES2022+, `const` by default, camelCase, PascalCase for classes. No semicolons-off style - keep semicolons consistent with existing files.
- **Electron security:** never disable `contextIsolation`. Never enable `nodeIntegration` in the renderer. All renderer-to-main calls go through `preload.js` over `contextBridge`.

## File Organization

- Max ~200 lines per file. Split by responsibility if a module grows beyond that.
- One module = one responsibility. Do not put unrelated logic in the same file.
- Renderer modules live under `renderer/`. Main-process modules live at repo root or in dedicated subfolders.
- Do not create `utils.js` dump files. Keep feature-specific helpers in that feature's module.

## Protected Files

The following files are protected by the `pre_guard_release_files.py` hook and require explicit user confirmation to edit:

- `IDENTITY.yaml`
- `package.json` / `package-lock.json`
- `CHANGELOG.md`
- `electron-builder` config (currently inline in `package.json` under `build`)
- `.github/workflows/*.yml` (the existing per-platform build workflows)
- `build/entitlements.mac.plist`
- Code-signing material (`developer_id.*`, `developerID_application.cer`)

If you need to extend the protected set, update `PROTECTED_EXACT` in `.claude/hooks/pre_guard_release_files.py`.

## Git and Commits

- Use conventional commit format: `type(scope): description`
  - Types: feat, fix, refactor, style, docs, chore, test, build, revert
  - Common scopes: `electron`, `renderer`, `cli`, `tray`, `chart`, `settings`, `shortcuts`, `build`, `release`, `docs`
  - Example: `feat(shortcuts): add window-focused keyboard shortcuts`
- Keep commit messages in English, concise, imperative mood.
- One logical change per commit. Do not bundle unrelated changes.
- Commits are authored by the user via local git config. Do NOT add `Co-Authored-By: Claude` trailers.

## What NOT to Do

- Do not add `console.log` for debugging. Use the existing logging path.
- Do not add TODO comments. Track work in `.planning/` (via GSD) or the issue tracker.
- Do not write defensive code against impossible states.
- Do not add external dependencies without discussing first - this project deliberately keeps its dependency surface tiny (chart.js + electron-store only at runtime).
- Do not enable `nodeIntegration` or disable `contextIsolation` to "make it easier" - the IPC/preload layer is a hard requirement.
- Do not check in `package-lock.json` (it is gitignored on purpose for this fork).

## Deferred Work

Postponed work goes in GSD's `.planning/ISSUES.md` once GSD is initialized. Each entry must have: what, why deferred, concrete trigger that unblocks it, owner. Surface deferred items with `/gsd:consider-issues`. Do not leave TODO comments in code.

## Release

- **Identity:** `IDENTITY.yaml` is the single source of truth for `name`, `display_name`, `version`, `icon`, license, and release config. `package.json` (`name`, `version`, `build.productName`, `build.appId`) must stay in sync. `/gtr:doctor` reports drift.
- **Changelog:** `CHANGELOG.md` uses Keep a Changelog format. The release flow extracts notes from the matching `## [x.y.z]` section.
- **Existing build workflows:** `build-windows.yml`, `build-macos.yml`, `build-linux.yml`, `test.yml` already drive per-platform Electron builds. Do not replace them with the template's `release.yml.template` without explicit approval - the `.template` files are kept inactive on disk for reference only.
- **Versioning:** Use `/gtr:release <version>` for the mechanical bump (IDENTITY.yaml, CHANGELOG rotation, derived manifests, commit, tag). Push is always manual.
- **GTRows fork tags:** versions in this fork carry the `-gtrows.N` suffix. Keep the suffix in `IDENTITY.yaml#version` and `package.json#version` aligned.

## Communication

- Default conversation language: Turkish if the user writes in Turkish, otherwise English. Code, identifiers, and comments stay in English regardless.
- Be concise and direct. No filler, no end-of-response summaries.
