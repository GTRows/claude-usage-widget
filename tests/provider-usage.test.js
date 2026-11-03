import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { createLocalProviderAdapters } = require('../src/providers');
const { normalizeClaudeUsage, normalizeCodexUsage } = require('../src/providers/usage');
const { readMacKeychain } = require('../src/providers/keychain');
const RESET = '2026-11-02T13:00:00.000Z';
const window = (utilization) => ({ utilization, resets_at: RESET });
const response = (data, options = {}) => ({ ok: true, status: 200, redirected: false, json: async () => data, ...options });
const FIXTURE_HOME = path.resolve('provider-fixture');
function setup(provider = 'claude', fetch = vi.fn(async () => response({ five_hour: window(25) })), extra = {}) {
  const readFile = vi.fn(async () => JSON.stringify(provider === 'claude'
    ? { claudeAiOauth: { accessToken: 'fixture-secret' } }
    : { tokens: { access_token: 'fixture-secret', account_id: 'fixture-account' } }));
  const adapters = createLocalProviderAdapters({ fs: { readFile, stat: async () => ({ isDirectory: () => true }) }, homeDir: FIXTURE_HOME, env: {}, platform: process.platform, fetch, ...extra });
  const account = { id: 'local-test', provider, authType: 'local', configDir: path.join(FIXTURE_HOME, `.${provider}`) };
  return { adapters, account, fetch, readFile };
}

describe('subscription quota normalization', () => {
  it('normalizes only valid Claude windows and drops any unrecognized provider content', () => {
    expect(normalizeClaudeUsage({ five_hour: window(25.5), seven_day: window(67), seven_day_sonnet: window(12), secret: 'echo' })).toEqual({
      provider: 'claude', usageType: 'subscription', five_hour: window(25.5), seven_day: window(67), seven_day_sonnet: window(12),
    });
    expect(normalizeClaudeUsage({ five_hour: null, seven_day: { utilization: '0' }, seven_day_opus: window(NaN) })).toEqual({ provider: 'claude', usageType: 'subscription' });
    expect(normalizeClaudeUsage({ five_hour: { utilization: 0, resets_at: 'bad' } }).five_hour).toEqual({ utilization: 0, resets_at: null });
  });

  it('maps Codex windows using their actual duration, including primary weekly limits', () => {
    expect(normalizeCodexUsage({ rate_limit: {
      primary_window: { used_percent: 31, reset_at: 1793624400, limit_window_seconds: 18000 },
      secondary_window: { used_percent: 82, reset_at: 1793624400, limit_window_seconds: 604800 },
    } })).toEqual({ provider: 'codex', usageType: 'subscription', five_hour: window(31), seven_day: window(82) });
    expect(normalizeCodexUsage({ rate_limit: { primary_window: { used_percent: 18, reset_at: 1793624400, limit_window_seconds: 604800 } } })).toEqual({ provider: 'codex', usageType: 'subscription', seven_day: window(18) });
    expect(normalizeCodexUsage({ rate_limit: { primary_window: { used_percent: null, reset_at: 1, limit_window_seconds: 18000 } } })).toEqual({ provider: 'codex', usageType: 'subscription' });
    expect(normalizeCodexUsage({ rate_limit: { primary_window: { used_percent: 20, reset_at: 1, limit_window_seconds: 60 } } }).five_hour).toBeUndefined();
  });

  it('retains a valid Claude cowork window without admitting invalid values', () => {
    expect(normalizeClaudeUsage({ seven_day_cowork: window(42) }).seven_day_cowork).toEqual(window(42));
    expect(normalizeClaudeUsage({ seven_day_cowork: window(101) }).seven_day_cowork).toBeUndefined();
  });
});

describe('read-only local subscription fetch', () => {
  it('uses fixed Claude endpoint, no redirects, bounded timeout and re-reads the exact profile', async () => {
    const f = setup();
    const result = await f.adapters.fetchLocalUsage(f.account);
    expect(result.five_hour).toEqual(window(25));
    expect(f.fetch).toHaveBeenCalledWith('https://api.anthropic.com/api/oauth/usage', expect.objectContaining({
      redirect: 'error', signal: expect.any(AbortSignal), headers: expect.objectContaining({ Authorization: 'Bearer fixture-secret', 'anthropic-beta': 'oauth-2025-04-20' }),
    }));
    f.readFile.mockResolvedValue(JSON.stringify({ claudeAiOauth: { accessToken: 'new-fixture-secret' } }));
    await f.adapters.fetchLocalUsage(f.account);
    expect(f.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer new-fixture-secret');
    const credentialFile = path.join(FIXTURE_HOME, '.claude', '.credentials.json');
    expect(f.readFile.mock.calls.map(([file]) => file)).toEqual([credentialFile, credentialFile]);
  });

  it('uses Codex subscription tokens and account header, without calling API usage endpoints', async () => {
    const f = setup('codex', vi.fn(async () => response({ rate_limit: { primary_window: { used_percent: 7, reset_at: 1793624400, limit_window_seconds: 18000 } } })));
    expect((await f.adapters.fetchLocalUsage(f.account)).five_hour).toEqual(window(7));
    expect(f.fetch).toHaveBeenCalledWith('https://chatgpt.com/backend-api/wham/usage', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fixture-secret', 'ChatGPT-Account-Id': 'fixture-account' }) }));
    await expect(f.adapters.fetchLocalUsage({ provider: 'codex', apiKey: 'fixture-api' })).rejects.toMatchObject({ code: 'LOCAL_PROFILE_INVALID' });
  });

  it.each([301, 302, 307, 308])('rejects HTTP %i without reading or exposing response content', async (status) => {
    const json = vi.fn(async () => ({ token: 'fixture-secret' }));
    const f = setup('claude', vi.fn(async () => response({}, { ok: false, status, json })));
    await expect(f.adapters.fetchLocalUsage(f.account)).rejects.toMatchObject({ code: 'PROVIDER_REDIRECT' });
    expect(json).not.toHaveBeenCalled();
  });

  it.each([401, 403])('directs HTTP %i credentials back to CLI sign-in without refresh', async (status) => {
    const f = setup('claude', vi.fn(async () => response({}, { ok: false, status })));
    await expect(f.adapters.fetchLocalUsage(f.account)).rejects.toMatchObject({ code: 'LOCAL_AUTH_EXPIRED' });
    expect(f.fetch).toHaveBeenCalledTimes(1);
  });

  it('redacts network errors, malformed JSON and HTTP body content', async () => {
    const f = setup('claude', vi.fn(async () => { throw new Error('fixture-secret'); }));
    await expect(f.adapters.fetchLocalUsage(f.account)).rejects.toMatchObject({ message: 'Unable to fetch provider usage.', code: 'PROVIDER_NETWORK_ERROR' });
    f.fetch.mockResolvedValue(response({}, { json: async () => { throw new Error('fixture-secret'); } }));
    await expect(f.adapters.fetchLocalUsage(f.account)).rejects.toMatchObject({ code: 'PROVIDER_INVALID_RESPONSE' });
    f.fetch.mockResolvedValue(response({}, { status: 500, ok: false }));
    await expect(f.adapters.fetchLocalUsage(f.account)).rejects.toMatchObject({ code: 'PROVIDER_HTTP_ERROR', status: 500 });
  });

  it('reports rate limiting separately so polling can preserve the last successful sample', async () => {
    const f = setup('claude', vi.fn(async () => response({}, { ok: false, status: 429 })));
    await expect(f.adapters.fetchLocalUsage(f.account)).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED', status: 429 });
  });

  it('never returns provider response bodies or causes in public errors', async () => {
    const f = setup('claude', vi.fn(async () => { throw Object.assign(new Error('fixture-secret'), { stdout: 'fixture-secret', cause: 'fixture-secret' }); }));
    const error = await f.adapters.fetchLocalUsage(f.account).catch((failure) => failure);
    expect(String(error)).not.toContain('fixture-secret');
    expect(error.stdout).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  it('times out even a fetch boundary that never resolves', async () => {
    const f = setup('claude', vi.fn(() => new Promise(() => {})), { timeoutMs: 10 });
    await expect(f.adapters.fetchLocalUsage(f.account)).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
    expect(f.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('bounds the response body read as well as response headers', async () => {
    const f = setup('claude', vi.fn(async () => response({}, { json: () => new Promise(() => {}) })), { timeoutMs: 10 });
    await expect(f.adapters.fetchLocalUsage(f.account)).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
  });

  it('uses argument arrays for scoped Keychain reads and strips child-process failures', async () => {
    let command;
    const execFile = (file, args, options, callback) => { command = { file, args, options }; callback(null, 'fixture-keychain-secret\n'); };
    expect(await readMacKeychain({ service: 'Claude Code-credentials-test' }, { execFile })).toBe('fixture-keychain-secret');
    expect(command).toMatchObject({ file: '/usr/bin/security', args: ['find-generic-password', '-s', 'Claude Code-credentials-test', '-w'], options: { timeout: 2000 } });
    const fail = (_file, _args, _options, callback) => callback(Object.assign(new Error('fixture-secret'), { stdout: 'fixture-secret' }));
    await expect(readMacKeychain({ service: 'Claude Code-credentials-test' }, { execFile: fail })).rejects.toMatchObject({ code: 'LOCAL_CREDENTIALS_UNAVAILABLE' });
  });
});
