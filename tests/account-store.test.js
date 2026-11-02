import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createAccountStore } = require('../src/main/account-store');

function fixture(initial = {}) {
  const values = structuredClone(initial);
  const store = { get: (key, fallback) => values[key] ?? fallback, set: (key, value) => { values[key] = value; }, delete: (key) => { delete values[key]; } };
  const accounts = createAccountStore(store, {
    encrypt: (value) => ({ encrypted: Buffer.from(value).toString('base64') }),
    decrypt: (value) => value?.encrypted ? Buffer.from(value.encrypted, 'base64').toString() : value?.plain,
  });
  return { accounts, values };
}

describe('account persistence', () => {
  it('migrates the legacy account before another account is added', () => {
    const { accounts, values } = fixture({ sessionKey: 'legacy-secret', organizationId: 'org-a' });
    accounts.save({ id: 'second', provider: 'codex', apiKey: 'api-secret' });
    expect(accounts.list().map((account) => account.id)).toEqual(['default', 'second']);
    expect(accounts.get('default').sessionKey).toBe('legacy-secret');
    expect(JSON.stringify(values.accounts)).not.toContain('secret');
    expect(values.sessionKey).toBeUndefined();
  });

  it('returns public flags without exposing credentials', () => {
    const { accounts } = fixture();
    accounts.save({ id: 'work', provider: 'claude', sessionKey: 'private', organizationId: 'org' });
    expect(accounts.list()[0]).toMatchObject({ id: 'work', hasSessionKey: true });
    expect(JSON.stringify(accounts.list())).not.toContain('private');
    expect(accounts.list()[0].sessionKey).toBeUndefined();
  });

  it('recovers a legacy account even when newer accounts already exist', () => {
    const { accounts } = fixture({ accounts: [{ id: 'api', provider: 'codex' }], sessionKey: 'legacy-secret', organizationId: 'org' });
    expect(accounts.get('default')?.sessionKey).toBe('legacy-secret');
    expect(accounts.list().map((account) => account.id)).toEqual(['api', 'default']);
  });

  it('renames and deletes only the requested account and preserves the active account', () => {
    const { accounts } = fixture();
    accounts.save({ id: 'a', provider: 'codex', apiKey: 'secret-a' });
    accounts.save({ id: 'b', provider: 'codex', apiKey: 'secret-b' });
    accounts.rename('a', 'Personal');
    accounts.remove('a');
    expect(accounts.active().id).toBe('b');
    expect(accounts.get('b').apiKey).toBe('secret-b');
    expect(accounts.get('a')).toBeNull();
    expect(() => accounts.select('missing')).toThrow();
  });
});
