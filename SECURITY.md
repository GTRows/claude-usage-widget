# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.13.x  | yes       |
| < 1.13  | no        |

Only the latest minor release receives security fixes. Older versions
should upgrade.

## Reporting a Vulnerability

Please **do not** open public issues for security vulnerabilities.

Email: aciroglu.fatih@gmail.com

Include:
- A clear description of the issue and the impact you observed.
- Reproduction steps or a minimal proof of concept.
- The version of `claude-usage-widget` and the OS you tested on.

You should receive an acknowledgement within 5 business days. Fix
timelines depend on severity; we will keep you updated.

## Scope

This project is a desktop widget that talks to Claude.ai endpoints the
user is already authenticated to. It does not run a server, does not
collect telemetry, and does not store credentials beyond the
electron-store config used to remember session keys locally.

In-scope:
- Local privilege escalation via the Electron main process or preload bridge.
- Renderer-side XSS or remote code execution paths.
- Credential leakage (session key, organization id) outside the user's machine.
- Update-channel or installer integrity issues.

Out of scope:
- Issues in upstream Claude.ai endpoints (report those to Anthropic).
- Vulnerabilities that require physical access to an unlocked machine.
- Self-hosted forks running with `nodeIntegration` enabled or
  `contextIsolation` disabled.
