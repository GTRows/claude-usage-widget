# Testing Patterns

**Analysis Date:** 2026-05-07

## Test Framework

**Runner:**
- vitest `^1.6.0`
- Config: `vitest.config.js` at repo root (`include: ['tests/**/*.test.js']`, `environment: 'node'`, `globals: false`, default reporter)

**Assertion Library:**
- vitest built-in `expect`
- Common matchers: `toBe`, `toEqual`, `toBeNull`, `toBeUndefined`, `toThrow`, `rejects.toThrow`, `resolves.toEqual`, `toMatchObject`, `toContain`, `toHaveLength`, `toHaveProperty`, `toBeGreaterThan`

**Run Commands:**
```bash
npm test                   # vitest run (one-shot)
npm run test:watch         # vitest (watch mode)
```

Tests run in a Node environment. There is no jsdom / electron / browser environment.

## Test File Organization

**Location:**
- `tests/` at repo root - **not** co-located with source
- Pattern: `tests/<module>.test.js` matches `src/.../<module>.js`

**Naming:**
- Test descriptions are human-readable (`'uses the override env var'`, `'merges patches without dropping existing keys'`)
- One spec file per shared / CLI module

**Structure:**
```
tests/
  cli-api.test.js
  cli-config.test.js
  cli-render.test.js
  cli-widget-store.test.js
  format.test.js
  history.test.js
  peak-throttle.test.js
  settings-schema.test.js
  thresholds.test.js
  version.test.js
```

## Test Structure

**Suite organisation (vitest globals are off, so each test file imports what it needs):**
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseVersion, compareVersions, isNewerVersion } from '../src/shared/version.js';

describe('parseVersion', () => {
  it('parses a plain semver', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, preRelease: null });
  });
  it('rejects malformed input', () => {
    expect(parseVersion('not-a-version')).toBeNull();
  });
});
```

**Patterns:**
- `beforeEach` creates the temp dir / sets env vars; `afterEach` cleans up - never `beforeAll`
- One assertion focus per `it`, but multiple `expect` calls per test are fine
- Tests for CommonJS modules from ESM specs use:
  ```js
  import { createRequire } from 'module';
  const require = createRequire(import.meta.url);
  beforeEach(() => {
    delete require.cache[require.resolve(configPath)];
    configMod = require(configPath);
  });
  ```
  to force fresh module state when env vars change.

## Mocking

**Framework:** vitest `vi` (`import { vi } from 'vitest'`).

**Patterns:**

*Mock global `fetch`:*
```js
global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
```

*Inspect call arguments:*
```js
expect(spy.mock.calls[0][1].headers).toMatchObject({ cookie: 'sessionKey=sk' });
```

*Reject path:*
```js
await expect(api.fetchJSON('https://x', 'sk')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
```

**What to mock:**
- `global.fetch` for HTTP-touching code
- Environment variables (`process.env.CLAUDE_*`) - clear / set in `beforeEach` / `afterEach`

**What NOT to mock:**
- Local modules - import the real implementation and test actual behaviour
- File system reads / writes - use a real temp dir instead (clearer, safer)
- Pure utilities (`format.js`, `version.js`) - test as-is

## Fixtures and Factories

**Temp directories** for any test that touches the file system:
```js
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-usage-test-'));
  process.env.CLAUDE_USAGE_CONFIG_DIR = tmp;
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.CLAUDE_USAGE_CONFIG_DIR;
});
```

**Mock-response factories** (e.g. in `tests/cli-api.test.js`):
```js
const okJson = (body) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const fail = (status, body) => ({ ok: false, status, text: async () => body });
```

**Inline sample data** for tests on shared utilities:
```js
const sample = [
  { timestamp: 1000, session: 10, weekly: 20, sonnet: 5, opus: 1, extraUsage: 0 },
  { timestamp: 2000, session: 30, weekly: 40, sonnet: 15, opus: 3, extraUsage: 2 },
];
```

No `tests/fixtures/` directory; data lives in the spec that uses it.

## Coverage

- No coverage tool configured. `package.json` has no coverage script; `vitest.config.js` does not enable `coverage`.
- Coverage is **not** enforced in CI. CI runs `npm test` (run-only) plus a CLI smoke test.
- Adding coverage later: enable vitest's built-in `coverage.provider: 'v8'` in `vitest.config.js`.

## Test Types

**Unit tests:**
- All current specs are unit tests against pure functions in `src/shared/*` and CLI modules in `src/cli/*`.
- No Electron, no DOM, no IPC.

**Integration tests:**
- None. Main process, preload bridge, renderer behaviour, and IPC contracts are not tested. Flagged in `CONCERNS.md`.

**E2E tests:**
- None. The Electron app and the CLI's full network path are exercised manually.

## Common Patterns

**Async / await:**
```js
it('throws when credentials are missing', async () => {
  await expect(api.fetchUsage({ sessionKey: '', organizationId: 'o' }))
    .rejects.toThrow(/Missing credentials/);
});
```

**Error matching:**
```js
await expect(api.fetchJSON('https://x', 'sk'))
  .rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
```

**Snapshot testing:** not used - explicit assertions only.

**Parameterized / table-driven testing:** not used - one `it` per case.

---

*Testing analysis: 2026-05-07*
*Update when adding integration / e2e harness, enabling coverage, or splitting `app.js` into testable units.*
