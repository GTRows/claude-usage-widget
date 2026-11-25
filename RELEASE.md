# Release Runbook

Source of truth for identity and release config: `IDENTITY.yaml`.
Automation: `.github/workflows/publish-desktop.yml`.
Notes source: `CHANGELOG.md`.

## Versioning rules

- Semantic versioning: `MAJOR.MINOR.PATCH`.
- Breaking change → bump `MAJOR`.
- New feature, no break → bump `MINOR`.
- Bugfix only → bump `PATCH`.
- Pre-release → append `-<tag>.<n>` (e.g. `1.2.0-rc.1`). Allowed tags come from `IDENTITY.yaml#release.prerelease_tags`.
- Git tag format: `v<version>` (e.g. `v1.2.0`). No other prefixes.

## Artifact naming contract

Defined by `IDENTITY.yaml#release.artifact_pattern`. Default:
```
{name}-v{version}-{platform}.{ext}
```
Examples:
- `tab-janitor-v1.2.0-windows-x64.exe`
- `tab-janitor-v1.2.0-linux-x64.tar.gz`

Every artifact is paired with a `SHA256SUMS` entry.

## Preflight checklist

Before cutting a release:

- [ ] All GSD plans included in this version are complete (`/gsd:progress` shows them done).
- [ ] `CHANGELOG.md` has an `## [Unreleased]` section with the actual changes — no stubs.
- [ ] `IDENTITY.yaml#version` matches the target version.
- [ ] Derived manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.) match `IDENTITY.yaml#version`. Run `/gtr:doctor` to verify.
- [ ] CI on `main` is green.
- [ ] Windows Authenticode and [Mac signing and notarization](MACOS_SIGNING.md) secrets are configured.
- [ ] Screenshots for any visual changes saved under `assets/release/v<version>/`.

## Cut the release

Use `/gtr:release` to do steps 1–4 mechanically, or do them by hand:

1. Bump `IDENTITY.yaml#version` to the new version.
2. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD`. Open a fresh `## [Unreleased]` above it with empty sections.
3. Update derived manifests to match.
4. Commit: `chore(release): v<version>`.
5. Tag: `git tag v<version> -m "Release v<version>"`.
6. Push: `git push && git push --tags`.

The tag push triggers `.github/workflows/publish-desktop.yml`.

## Workflow behavior

On tag pushes in the `vMAJOR.MINOR.PATCH-gtrows.N` format:

1. The Windows, macOS and Linux jobs build the triggering commit with release publication disabled. Windows and macOS verify their required signatures before uploading workflow artifacts.
2. After all three jobs pass, the publication job validates the full installer and updater asset set, checks manifest versions and payload hashes, and generates `SHA256SUMS`.
3. The publication job uploads the assets to a GitHub release draft. It checks each uploaded SHA-256 digest and confirms the tag still matches the build commit before making the draft public.

Rerun the failed publication job with the original build artifacts to resume a draft. Existing assets are reused when their digests match. Leave the draft unpublished while the workflow runs. A manual Linux dispatch can rebuild an exact existing tag as workflow artifacts. Public releases are updated by cutting a new version.

## Windows Authenticode signing

Set the `WINDOWS_UPDATE_PUBLISHER` Actions secret to the full certificate subject from `(Get-AuthenticodeSignature -LiteralPath $signedFile).SignerCertificate.Subject`. Choose one signing setup:

| Signing setup | Configuration |
| --- | --- |
| Certificate store | Provision a dedicated Windows runner with the `windows-signing` label and a signing provider that exposes its Authenticode certificate in the runner user's Windows certificate store. Set the `WINDOWS_SIGNING_CERTIFICATE_SHA1` Actions variable to its 40-digit thumbprint. The private key stays with the provider. Restrict the runner to trusted release jobs. |
| Exportable PFX/P12 | If you already have a trusted, exportable Authenticode certificate, set the `WIN_CSC_LINK` secret to the Base64 of the PFX/P12 and `WIN_CSC_KEY_PASSWORD` to its password. This mode uses the hosted Windows runner. |

Use a stable certificate subject for subsequent releases. Use a signed Setup package once to migrate from an unsigned installation. A change to the certificate subject requires another manual Setup installation before native updates can continue.

Before the first signed rollout, use an isolated Windows VM and two builds signed by the same publisher to verify the actual upgrade and relaunch. Also confirm that a candidate signed by a different publisher cannot be installed by the updater.

## Post-release

- [ ] Verify artifacts open/install/run on a clean machine for each platform.
- [ ] Verify checksums match.
- [ ] Attach screenshots from `assets/release/v<version>/` to the release body if relevant.
- [ ] Announce externally (if applicable).

## Rollback

A broken published release is never silently deleted. Choose one:

- **Patch-forward (preferred)**: cut a new PATCH release with the fix. Mark the broken version as deprecated in `CHANGELOG.md`.
- **Mark pre-release**: demote the broken release to "pre-release" in GitHub and add a notice at the top of the release notes pointing to the fix.
- **Yank** (only when the artifact is actively harmful): delete release assets (not the tag), add a prominent yank notice, and ship a fix.

Never delete a tag that has been pushed publicly.
