# Security Hardening Batch 3 - Release Notes

**IMPORTANT: Breaking Change - Config Migration Required**

This release changes how session credentials are stored. Users upgrading from previous versions will need to re-enter their Claude session key after the update.

## What Changed

1. **Keychain Storage (#1)** — Session keys now stored in OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service) instead of electron-store with hardcoded encryption key
2. **Main-Process URL Validation (#2)** — URL allowlist enforced in main process, not just preload (defense-in-depth)
3. **DOM Methods Replace innerHTML (#5)** — All dynamic content rendering now uses createElement/textContent instead of innerHTML
4. **Usage History Rotation (#3)** — Added 10k sample cap to prevent unbounded disk growth

## User Impact

**First Launch After Update:**
- Old encrypted config file will be deleted automatically
- User must re-enter session key
- All settings (refresh interval, compact mode, etc.) will be reset to defaults

**Why This Matters:**

**Previous approach (v1.7.0 and earlier):**
- Session keys stored in electron-store with hardcoded encryption key: `'claude-widget-secure-key-2024'`
- This key was baked into the application code and visible to anyone reading `main.js`
- Any local process with file system access could read the encrypted config file, extract the hardcoded key from the app, and decrypt the session token
- **This was obfuscation, not real encryption** — it provided a false sense of security

**New approach (v1.8.0):**
- Session keys stored via Electron's `safeStorage` API, which uses:
  - **Windows:** DPAPI (Data Protection API) — encrypted with machine + user account credentials
  - **macOS:** Keychain Access — protected by system keychain with secure enclave integration
  - **Linux:** Secret Service API — protected by login keyring
- **No hardcoded keys** — encryption is handled by the OS using credentials tied to the current user
- Even with file system access, an attacker cannot decrypt the session key without:
  - Being logged in as the same user account
  - Having physical access to the machine
  - Or compromising OS-level credential storage (significantly harder than reading a text file)

**Real-world impact:**
- Protects against malware reading config files and extracting credentials
- Prevents session hijacking from backup files or cloud-synced config directories
- Aligns with industry best practices for credential storage in desktop applications
- Makes the app suitable for use in shared/multi-user environments

## Testing Checklist

- [ ] Fresh install works
- [ ] Credential save/load works
- [ ] External links open correctly (GitHub, PayPal, claude.ai only)
- [ ] UI renders properly (no broken layouts)
- [ ] 24-48hr soak test at 15s interval (verify no memory growth, history caps at 10k)