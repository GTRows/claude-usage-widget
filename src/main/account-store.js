const { randomUUID } = require('crypto');
const { normalizeAccount, normalizeAccounts, legacyClaudeAccount, hasUsableCredentials } = require('../shared/accounts');

function publicAccount(account) {
  if (!account) return null;
  const { sessionKey, apiKey, ...metadata } = account;
  return { ...metadata, hasSessionKey: Boolean(sessionKey), hasApiKey: Boolean(apiKey), connected: hasUsableCredentials(account) };
}

function createAccountStore(store, { encrypt, decrypt }) {
  function persist(account) {
    const metadata = { ...account };
    delete metadata.sessionKey;
    delete metadata.apiKey;
    const accounts = normalizeAccounts(store.get('accounts', []));
    const index = accounts.findIndex((item) => item.id === account.id);
    if (index < 0) accounts.push(metadata);
    else accounts[index] = metadata;
    const secrets = { ...store.get('accountSecrets', {}) };
    const entry = { ...secrets[account.id] };
    if (account.sessionKey) entry.sessionKey = encrypt(account.sessionKey);
    if (account.apiKey) entry.apiKey = encrypt(account.apiKey);
    secrets[account.id] = entry;
    store.set('accounts', accounts);
    store.set('accountSecrets', secrets);
  }

  function migrate() {
    const accounts = normalizeAccounts(store.get('accounts', []));
    if (!accounts.some((account) => account.id === 'default')) {
      const legacy = legacyClaudeAccount({ sessionKey: decrypt({ encrypted: store.get('sessionKey_encrypted') }) || store.get('sessionKey'), organizationId: store.get('organizationId') });
      if (legacy) persist(legacy);
    }
    // Re-save older account records so credentials cannot remain in metadata.
    for (const account of accounts) {
      if (account.sessionKey || account.apiKey) persist(account);
    }
    if (store.get('accounts', []).length) {
      store.delete('sessionKey');
      store.delete('sessionKey_encrypted');
      store.delete('organizationId');
    }
  }

  function load() {
    migrate();
    const secrets = store.get('accountSecrets', {});
    return normalizeAccounts(store.get('accounts', [])).map((account) => ({
      ...account,
      sessionKey: decrypt(secrets[account.id]?.sessionKey) || undefined,
      apiKey: decrypt(secrets[account.id]?.apiKey) || undefined,
    }));
  }

  function get(id) { return load().find((account) => account.id === id) || null; }
  function active() {
    const accounts = load();
    return accounts.find((account) => account.id === store.get('settings.activeProfile', 'default')) || accounts[0] || null;
  }
  function select(id) {
    if (!get(id)) throw new Error('Unknown account');
    store.set('settings.activeProfile', id);
    return publicAccount(get(id));
  }
  function save(input) {
    migrate();
    const id = input.id || randomUUID();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('Invalid account ID');
    const existing = get(id);
    const account = normalizeAccount({ ...existing, ...input, id });
    persist(account);
    store.set('settings.activeProfile', id);
    return account;
  }
  function rename(id, label) {
    const account = get(id);
    if (!account) throw new Error('Unknown account');
    if (typeof label !== 'string' || !label.trim() || label.length > 80) throw new Error('Invalid account label');
    persist({ ...account, label: label.trim() });
    return publicAccount(get(id));
  }
  function remove(id) {
    const current = active();
    const accounts = load().filter((account) => account.id !== id);
    store.set('accounts', accounts.map(({ sessionKey, apiKey, ...metadata }) => metadata));
    const secrets = { ...store.get('accountSecrets', {}) };
    delete secrets[id];
    store.set('accountSecrets', secrets);
    if (current?.id === id) store.set('settings.activeProfile', accounts[0]?.id || 'default');
  }
  return { load, get, active, select, save, rename, remove, list: () => load().map(publicAccount) };
}

module.exports = { createAccountStore, publicAccount };
