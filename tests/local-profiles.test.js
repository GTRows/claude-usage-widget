import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const { createLocalProviderAdapters } = require('../src/providers');
const { hasUsableCredentials, normalizeAccount } = require('../src/shared/accounts');
const roots = [];
async function fixture(platform = 'linux') {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'widget-profiles-'));
  roots.push(homeDir);
  const readFile = vi.fn((...args) => fs.readFile(...args));
  const readKeychain = vi.fn();
  const adapters = createLocalProviderAdapters({ fs: { ...fs, readFile }, homeDir, env: {}, platform, readKeychain });
  return { homeDir, adapters, readFile, readKeychain };
}
async function profile(home, name, body, provider = 'claude') {
  const dir = path.join(home, name);
  await fs.mkdir(dir, { recursive: true });
  if (body !== undefined) await fs.writeFile(path.join(dir, provider === 'claude' ? '.credentials.json' : 'auth.json'), JSON.stringify(body));
  return dir;
}
const claude = (token = 'fixture-secret') => ({ claudeAiOauth: { accessToken: token, refreshToken: 'fixture-refresh' } });
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))); });

describe('local profile boundaries', () => {
  it('discovers metadata only from defaults, environment and obvious Claude directories', async () => {
    const f = await fixture();
    const primary = await profile(f.homeDir, '.claude', claude());
    const personal = await profile(f.homeDir, '.claude-personal', claude('personal-secret'));
    const codex = await profile(f.homeDir, '.codex', { tokens: { access_token: 'codex-secret', account_id: 'a' } }, 'codex');
    const custom = await profile(f.homeDir, 'custom-code', undefined);
    const adapters = createLocalProviderAdapters({ fs: { ...fs, readFile: f.readFile }, homeDir: f.homeDir, env: { CODEX_HOME: custom }, readKeychain: f.readKeychain });
    const found = await adapters.discoverLocalProfiles();
    expect(found.map((p) => p.configDir)).toEqual(expect.arrayContaining([primary, personal, codex, custom]));
    expect(found.every((p) => p.authType === 'local')).toBe(true);
    expect(Object.keys(found[0]).sort()).toEqual(['authType', 'configDir', 'id', 'label', 'provider']);
    expect(f.readFile).not.toHaveBeenCalled();
    expect(f.readKeychain).not.toHaveBeenCalled();
    expect(JSON.stringify(found)).not.toContain('secret');
  });

  it('links exact files and re-reads them without copying credentials to metadata', async () => {
    const f = await fixture();
    const directory = await profile(f.homeDir, '.claude-personal', claude());
    const account = await f.adapters.linkLocalProfile('claude', directory);
    expect(account).toMatchObject({ provider: 'claude', authType: 'local', configDir: directory });
    expect(normalizeAccount({ ...account, apiKey: 'must-drop', accessToken: 'must-drop' })).toEqual(account);
    expect(hasUsableCredentials(account)).toBe(true);
    expect(hasUsableCredentials({ provider: 'codex', authType: 'local', configDir: '' })).toBe(false);
    expect(JSON.stringify(account)).not.toContain('secret');
    expect(f.readFile.mock.calls.map(([file]) => file)).toEqual([path.join(directory, '.credentials.json')]);
  });

  it('never falls back from a missing custom profile to default credentials', async () => {
    const f = await fixture('darwin');
    await profile(f.homeDir, '.claude', claude('default-secret'));
    const directory = await profile(f.homeDir, '.claude-personal', undefined);
    f.readKeychain.mockRejectedValue(new Error('stdout=fixture-secret'));
    await expect(f.adapters.linkLocalProfile('claude', directory)).rejects.toMatchObject({ code: 'LOCAL_CREDENTIALS_UNAVAILABLE' });
    expect(f.readFile.mock.calls.map(([file]) => file)).toEqual([path.join(directory, '.credentials.json')]);
    expect(f.readKeychain).toHaveBeenCalledWith({ service: `Claude Code-credentials-${createHash('sha256').update(directory).digest('hex').slice(0, 8)}` });
  });

  it('reads the default scoped Keychain only for explicit linking', async () => {
    const f = await fixture('darwin');
    const directory = await profile(f.homeDir, '.claude', undefined);
    await f.adapters.discoverLocalProfiles();
    expect(f.readKeychain).not.toHaveBeenCalled();
    f.readKeychain.mockResolvedValue(JSON.stringify(claude()));
    const account = await f.adapters.linkLocalProfile('claude', directory);
    expect(f.readKeychain).toHaveBeenCalledWith({ service: 'Claude Code-credentials' });
    expect(JSON.stringify(account)).not.toContain('fixture-secret');
  });

  it('keeps lexical profile boundaries when unrelated configuration files share symlinks', async () => {
    const f = await fixture();
    const first = await profile(f.homeDir, '.claude', claude('first'));
    const second = await profile(f.homeDir, '.claude-personal', claude('second'));
    const shared = path.join(first, 'shared-settings');
    await fs.mkdir(shared);
    await fs.writeFile(path.join(shared, 'settings.json'), '{}');
    await fs.symlink(shared, path.join(second, 'shared-settings'), process.platform === 'win32' ? 'junction' : 'dir');
    const a = await f.adapters.linkLocalProfile('claude', first);
    const b = await f.adapters.linkLocalProfile('claude', second);
    expect(a.id).not.toBe(b.id);
    expect((await f.adapters.linkLocalProfile('claude', second)).id).toBe(b.id);
  });

  it('rejects unknown, malformed, and API-key-only credential shapes safely', async () => {
    const f = await fixture('darwin');
    const directory = await profile(f.homeDir, '.claude-personal', { error: 'fixture-secret' });
    await expect(f.adapters.linkLocalProfile('claude', directory)).rejects.toMatchObject({ code: 'LOCAL_CREDENTIALS_INVALID' });
    expect(f.readKeychain).not.toHaveBeenCalled();
    await profile(f.homeDir, '.claude-personal', { claudeAiOauth: { accessToken: 'fixture-secret', expiresAt: 1 } });
    const expired = await f.adapters.linkLocalProfile('claude', directory);
    expect(expired.authType).toBe('local');
    await expect(f.adapters.fetchLocalUsage(expired)).rejects.toMatchObject({ code: 'LOCAL_AUTH_EXPIRED' });
    const codexDir = await profile(f.homeDir, '.codex', { OPENAI_API_KEY: 'fixture-secret' }, 'codex');
    await expect(f.adapters.linkLocalProfile('codex', codexDir)).rejects.toMatchObject({ code: 'LOCAL_CREDENTIALS_INVALID' });
    await expect(f.adapters.linkLocalProfile('unknown', directory)).rejects.toMatchObject({ code: 'LOCAL_PROFILE_INVALID' });
  });
});
