# Mac signing and the first automatic update

## Current prerequisites

The native Mac updater requires a signed application. The production release policy uses Developer ID Application signing, Apple notarization and a stapled ticket. A free Apple Account does not provide this distribution setup; use an active Apple Developer Program membership.

Choose one long-term signing owner for the project before issuing a certificate. Prefer the official release maintainer's personal or project-owned team. Future releases must satisfy the installed app's signing requirement; do not alternate unrelated Apple teams. The GitHub login used to submit a PR is independent of the Apple signing account.

Official references:

- [Apple Developer Program enrollment](https://developer.apple.com/programs/enroll/)
- [Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)
- [Electron code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)

## Maintainer setup

1. Confirm the selected Apple account has an active Developer Program membership. Complete enrollment, identity verification, agreements and payment directly with Apple if required.
2. The Account Holder creates a **Developer ID Application** certificate using Xcode or Certificates, Identifiers & Profiles. Keep its private key in the owner's keychain. A downloaded public `.cer` file by itself cannot sign an application.
3. Export the signing certificate together with its private key as a password-protected `.p12`. Base64-encode that file for the existing workflow's `CSC_LINK` input.
4. Generate an Apple app-specific password for notarization and obtain the selected team's Team ID.
5. An administrator of `GTRows/claude-usage-widget` installs the following Actions secrets. Keep private material out of repository files, PRs and chat messages.

| Secret | Value |
| --- | --- |
| `CSC_LINK` | Base64-encoded Developer ID Application `.p12`, including its private key |
| `CSC_KEY_PASSWORD` | Password protecting that `.p12` export |
| `APPLE_ID` | Apple account email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple app-specific password for that account |
| `APPLE_TEAM_ID` | Team ID corresponding to the signing certificate |

The tagged workflow overrides the legacy static notarization Team ID with `APPLE_TEAM_ID`. It stops before publication when inputs are absent, the bundle's signing Team ID differs, or signature/staple/Gatekeeper validation fails. Untagged verification builds intentionally remain unsigned and cannot demonstrate native Mac update installation.

For a signed local build with the same identity imported into the local keychain and the three `APPLE_*` values provided through the local environment, use:

```bash
npm run build:mac -- --publish never "-c.mac.notarize.teamId=$APPLE_TEAM_ID"
```

## First installation and acceptance

1. Merge the updater changes and configure the official release repository's secrets before publishing the first signed Mac release. Release versions remain controlled by the existing release procedure.
2. Verify both ARM64 and x64 bundles are Developer ID signed and notarized. Publish the existing DMGs plus `latest-mac.yml`, architecture ZIPs and blockmaps. The workflow verifies payload SHA-512 before upload.
3. Quit the old development bundle and install the signed app once in Applications. Keep the existing user-data directory: `~/Library/Application Support/claude-usage-widget`. Do not launch the old Downloads copy alongside it.
4. Reopen the signed app and confirm existing accounts/history, the displayed version and native-update availability.
5. Test an upgrade to a higher version signed by the same owner: check, download, verify progress, select **Restart and update**, and confirm the new process/version plus retained account/settings/history. Use an isolated signed fixture feed for pre-release acceptance or the next official signed release; never publish synthetic test versions into the production update channel.

A passing unsigned build, unit test, manual release check or simulated updater UI test is not proof that this final signed install/restart transition works. Record that transition separately once signing credentials are available.
