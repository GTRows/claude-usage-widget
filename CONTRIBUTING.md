# Contributing to claude-usage-widget

Thanks for considering a contribution. This document captures the
conventions enforced by `CLAUDE.md`. Read it before opening a PR.

## Branching

This is a fork. `main` tracks upstream.

- Never commit directly to `main`.
- Use `feature/<name>` or `fix/<name>` branches.
- One PR per feature. Rebase onto upstream before opening.

## Commit messages

Conventional commits, English, imperative mood.

```
type(scope): short description
```

- Types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`,
  `build`, `revert`.
- Common scopes: `electron`, `renderer`, `cli`, `tray`, `chart`,
  `settings`, `shortcuts`, `build`, `release`, `docs`.
- One logical change per commit. Do not bundle unrelated changes.
- Commits are authored by your local git config. Do **not** add
  `Co-Authored-By: Claude` trailers.

Examples:

```
feat(shortcuts): add window-focused keyboard shortcuts
fix(chart): clamp y-axis when sample buffer is empty
docs(readme): document peak-throttle indicator
```

## Code standards

- All code, comments, and identifiers must be in English.
- No emojis in code, comments, file names, or commit messages.
- 2-space indent, LF line endings (see `.editorconfig`).
- ES2022+, `const` by default, camelCase for variables and functions,
  PascalCase for classes. Keep semicolons consistent with surrounding files.
- Main process and CLI use CommonJS. Renderer modules use ESM and load
  via `<script type="module">`.
- Never disable `contextIsolation`. Never enable `nodeIntegration` in
  the renderer. All renderer-to-main calls go through `preload.js` over
  `contextBridge`.

## File organization

- Keep modules under ~200 lines. Split by responsibility above that.
- One module = one responsibility. Do not put unrelated logic in the
  same file.
- Renderer modules live under `renderer/`. Main-process modules live at
  repo root or in dedicated subfolders.
- Do not create `utils.js` dump files. Keep feature-specific helpers in
  that feature's module.

## Tests

- Run `npm test` before opening a PR.
- Add tests for new behavior. `vitest` is the test runner.
- Tests live under `test/`. Follow the existing file naming pattern.

## Pull requests

- Reference the issue in the PR description if one exists.
- Describe what changed and why. Link to the relevant `CHANGELOG.md`
  entry under `## [Unreleased]`.
- Make sure CI passes on Windows, macOS, and Linux.
- Keep PRs small and focused. Reviewers will ask for a split if a PR
  touches unrelated areas.

## Releases

Release mechanics live in `RELEASE.md` and `IDENTITY.yaml`. Contributors
do not cut releases — only the maintainer does, via `/gtr:release`.

## Reporting bugs

Use GitHub issues. Include:
- Operating system and version.
- App version (visible in the tray menu).
- Reproduction steps.
- Expected vs. observed behavior.
- Logs from `--debug` if relevant.
