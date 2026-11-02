import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createAccountStore } = require('../src/main/account-store');

function fixture(initial = {}, options = {}) {
  let values = structuredClone(initial);
  const write = (next) => { options.beforeWrite?.(next); values = structuredClone(next); };
  const store = {
    get: (key, fallback) => values[key] ?? fallback,
    set: (key, value) => write({ ...values, [key]: value }),
    delete: (key) => { const next = { ...values }; delete next[key]; write(next); },
    get store() { return structuredClone(values); },
    set store(next) { write(next); },
  };
  const codecs = {
    encrypt: (value) => ({ encrypted: Buffer.from(value).toString('base64') }),
    decrypt: (value) => value?.encrypted ? Buffer.from(value.encrypted, 'base64').toString() : value?.plain,
    ...options.codecs,
  };
  const accounts = createAccountStore(store, codecs);
  return { accounts, get values() { return values; }, restart: () => createAccountStore(store, codecs) };
}

describe('account persistence', () => {
  it('migrates the legacy account before another account is added', () => {
    const f = fixture({ sessionKey: 'legacy-secret', organizationId: 'org-a' });
    const { accounts } = f;
    accounts.save({ id: 'second', provider: 'codex', apiKey: 'api-secret' });
    expect(accounts.list().map((account) => account.id)).toEqual(['default', 'second']);
    expect(accounts.get('default').sessionKey).toBe('legacy-secret');
    expect(JSON.stringify(f.values.accounts)).not.toContain('secret');
    expect(f.values.sessionKey).toBeUndefined();
  });

  it('recovers opaque legacy ciphertext after a locked-store launch and restart', () => {
    let locked = true;
    const encrypted = Buffer.from('recoverable-secret').toString('base64');
    const f = fixture({ sessionKey_encrypted: encrypted, organizationId: 'org-a' }, {
      codecs: { decrypt: (value) => locked ? null : value?.encrypted && Buffer.from(value.encrypted, 'base64').toString() },
    });
    expect(f.accounts.list()[0]).toMatchObject({ id: 'default', connected: false, hasSessionKey: false });
    expect(f.values.accountSecrets.default.sessionKey).toEqual({ encrypted });
    expect(JSON.stringify(f.values.accounts)).not.toContain(encrypted);
    locked = false;
    expect(f.restart().get('default')).toMatchObject({ sessionKey: 'recoverable-secret', organizationId: 'org-a' });
  });

  it('fills a partial default metadata row from the remaining legacy credential', () => {
    const f = fixture({ accounts: [{ id: 'default', provider: 'claude', label: 'Personal' }], sessionKey: 'legacy-secret', organizationId: 'org-a' });
    expect(f.accounts.get('default')).toMatchObject({ label: 'Personal', sessionKey: 'legacy-secret', organizationId: 'org-a' });
    expect(f.restart().get('default').sessionKey).toBe('legacy-secret');
  });

  it('uses legacy fallback while a modern secret is unavailable without overwriting it', () => {
    let unavailable = true;
    const modern = { encrypted: Buffer.from('modern-secret').toString('base64') };
    const f = fixture({
      accounts: [{ id: 'default', provider: 'claude', organizationId: 'org-a' }],
      accountSecrets: { default: { sessionKey: modern } }, sessionKey: 'legacy-secret', organizationId: 'org-a',
    }, { codecs: { decrypt: (value) => unavailable ? null : value?.encrypted && Buffer.from(value.encrypted, 'base64').toString() } });
    expect(f.accounts.get('default').sessionKey).toBe('legacy-secret');
    expect(f.values.accountSecrets.default.sessionKey).toEqual(modern);
    expect(f.values.sessionKey).toBe('legacy-secret');
    unavailable = false;
    expect(f.restart().get('default').sessionKey).toBe('modern-secret');
    expect(f.values.sessionKey).toBeUndefined();
  });

  it('does not replace an unavailable modern credential when renaming its fallback account', () => {
    let unavailable = true;
    const modern = { encrypted: Buffer.from('modern-secret').toString('base64') };
    const f = fixture({
      accounts: [{ id: 'default', provider: 'claude', organizationId: 'modern-org' }],
      accountSecrets: { default: { sessionKey: modern } }, sessionKey: 'legacy-secret', organizationId: 'legacy-org',
    }, { codecs: { decrypt: (value) => unavailable ? null : value?.encrypted && Buffer.from(value.encrypted, 'base64').toString() } });
    expect(f.accounts.get('default')).toMatchObject({ sessionKey: 'legacy-secret', organizationId: 'legacy-org' });
    f.accounts.rename('default', 'Personal');
    unavailable = false;
    expect(f.restart().get('default')).toMatchObject({ label: 'Personal', sessionKey: 'modern-secret', organizationId: 'modern-org' });
  });

  it('does not replace an unavailable modern credential when saving metadata changes', () => {
    let unavailable = true;
    const modern = { encrypted: Buffer.from('modern-secret').toString('base64') };
    const f = fixture({
      accounts: [{ id: 'default', provider: 'claude', organizationId: 'modern-org' }],
      accountSecrets: { default: { sessionKey: modern } }, sessionKey: 'legacy-secret', organizationId: 'legacy-org',
    }, { codecs: { decrypt: (value) => unavailable ? null : value?.encrypted && Buffer.from(value.encrypted, 'base64').toString() } });
    f.accounts.save({ id: 'default', label: 'Work' });
    unavailable = false;
    expect(f.restart().get('default')).toMatchObject({ label: 'Work', sessionKey: 'modern-secret', organizationId: 'modern-org' });
  });

  it('does not recreate a logged-out default account from retained legacy fallback credentials', () => {
    const f = fixture({
      accounts: [{ id: 'default', provider: 'claude', organizationId: 'org-a' }, { id: 'work', provider: 'codex' }],
      accountSecrets: { default: { sessionKey: { encrypted: 'temporarily-unavailable' } }, work: { apiKey: { plain: 'work-key' } } },
      sessionKey: 'legacy-secret', organizationId: 'org-a',
    }, { codecs: { decrypt: (value) => value?.plain || null } });
    expect(f.accounts.get('default').sessionKey).toBe('legacy-secret');
    f.accounts.remove('default');
    expect(f.accounts.get('default')).toBeNull();
    expect(f.restart().get('default')).toBeNull();
    expect(f.values.sessionKey).toBeUndefined();
    expect(f.values.sessionKey_encrypted).toBeUndefined();
    expect(f.values.organizationId).toBeUndefined();
    expect(f.values.accountSecrets.default).toBeUndefined();
    expect(f.accounts.get('work').apiKey).toBe('work-key');
  });

  it('prefers a valid modern credential over a legacy copy', () => {
    const f = fixture({
      accounts: [{ id: 'default', provider: 'claude', organizationId: 'modern-org' }],
      accountSecrets: { default: { sessionKey: { plain: 'modern-secret' } } },
      sessionKey: 'legacy-secret', organizationId: 'legacy-org',
    });
    expect(f.accounts.get('default')).toMatchObject({ sessionKey: 'modern-secret', organizationId: 'modern-org' });
    expect(f.restart().get('default').sessionKey).toBe('modern-secret');
  });

  it('keeps inline credentials recoverable if a migration write fails', () => {
    let fail = true;
    const f = fixture({ accounts: [{ id: 'default', provider: 'claude', sessionKey: 'inline-secret', organizationId: 'org-a' }] }, {
      beforeWrite: (next) => { if (fail && next.accountSecrets) throw new Error('disk unavailable'); },
    });
    expect(() => f.accounts.load()).toThrow('disk unavailable');
    fail = false;
    expect(f.restart().get('default').sessionKey).toBe('inline-secret');
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
