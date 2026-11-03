const { randomUUID } = require('crypto');
const { normalizeAccount, normalizeAccounts, legacyClaudeAccount, hasUsableCredentials } = require('../shared/accounts');

function publicAccount(account) {
  if (!account) return null;
  const { sessionKey, apiKey, ...metadata } = account;
  return { ...metadata, hasSessionKey: Boolean(sessionKey), hasApiKey: Boolean(apiKey), connected: hasUsableCredentials(account) };
}

function createAccountStore(store, { encrypt, decrypt }) {
  function commit(accounts, secrets, removeLegacy = false) {
    // electron-store replaces the complete document in one atomic write.
    if ('store' in store) {
      const next = { ...store.store, accounts, accountSecrets: secrets };
      if (removeLegacy) for (const key of ['sessionKey', 'sessionKey_encrypted', 'organizationId']) delete next[key];
      store.store = next;
      return;
    }
    // Minimal injected stores must save the recoverable secret before metadata.
    store.set('accountSecrets', secrets);
    store.set('accounts', accounts);
    if (removeLegacy) for (const key of ['sessionKey', 'sessionKey_encrypted', 'organizationId']) store.delete(key);
  }

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
    commit(accounts, secrets);
  }

  function migrate() {
    const previous = store.get('accounts', []);
    const accounts = normalizeAccounts(previous);
    const oldSecrets = store.get('accountSecrets', {});
    const secrets = { ...oldSecrets };
    // Re-save older account records so credentials cannot remain in metadata.
    for (const account of accounts) {
      if (account.sessionKey || account.apiKey) {
        const entry = { ...secrets[account.id] };
        if (account.sessionKey) entry.sessionKey = encrypt(account.sessionKey);
        if (account.apiKey) entry.apiKey = encrypt(account.apiKey);
        secrets[account.id] = entry;
        delete account.sessionKey;
        delete account.apiKey;
      }
    }
    const legacyEncrypted = store.get('sessionKey_encrypted');
    const legacyPlain = store.get('sessionKey');
    const legacyOrg = store.get('organizationId');
    const hasLegacy = Boolean(legacyEncrypted || legacyPlain || legacyOrg);
    let account = accounts.find((item) => item.id === 'default');
    if (!account && hasLegacy) {
      account = legacyClaudeAccount({ organizationId: legacyOrg, sessionKey: legacyPlain });
      // A locked encrypted key is still a recoverable account.
      if (!account) account = normalizeAccount({ id: 'default', provider: 'claude' });
      delete account.sessionKey;
      accounts.push(account);
    }
    let removeLegacy = false;
    if (account?.provider === 'claude' && account.authType !== 'local' && hasLegacy) {
      if (!account.organizationId && legacyOrg) account.organizationId = legacyOrg;
      const entry = { ...secrets.default };
      let copied = false;
      if (!entry.sessionKey && (legacyEncrypted || legacyPlain)) {
        // Preserve ciphertext without needing an unlocked OS credential store.
        entry.sessionKey = legacyEncrypted ? { encrypted: legacyEncrypted } : encrypt(legacyPlain);
        secrets.default = entry;
        copied = Boolean(entry.sessionKey);
      }
      // Keep the fallback when an existing modern ciphertext cannot be opened.
      removeLegacy = copied || Boolean(decrypt(entry.sessionKey) && account.organizationId)
        || (!legacyEncrypted && !legacyPlain && Boolean(account.organizationId));
    }
    if (removeLegacy || JSON.stringify(previous) !== JSON.stringify(accounts) || JSON.stringify(oldSecrets) !== JSON.stringify(secrets)) {
      commit(accounts, secrets, removeLegacy);
    }
  }

  function load() {
    migrate();
    const secrets = store.get('accountSecrets', {});
    return normalizeAccounts(store.get('accounts', [])).map((account) => {
      let sessionKey = decrypt(secrets[account.id]?.sessionKey) || undefined;
      if (!sessionKey && account.id === 'default' && account.provider === 'claude' && account.authType !== 'local') {
        sessionKey = decrypt({ encrypted: store.get('sessionKey_encrypted') }) || store.get('sessionKey') || undefined;
        if (sessionKey) account.organizationId = store.get('organizationId') || account.organizationId;
      }
      return { ...account, sessionKey, apiKey: decrypt(secrets[account.id]?.apiKey) || undefined };
    });
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
    const existing = normalizeAccounts(store.get('accounts', [])).find((account) => account.id === id);
    const account = normalizeAccount({ ...existing, ...input, id });
    persist(account);
    store.set('settings.activeProfile', id);
    return get(id);
  }
  function rename(id, label) {
    migrate();
    const account = normalizeAccounts(store.get('accounts', [])).find((item) => item.id === id);
    if (!account) throw new Error('Unknown account');
    if (typeof label !== 'string' || !label.trim() || label.length > 80) throw new Error('Invalid account label');
    persist({ ...account, label: label.trim() });
    return publicAccount(get(id));
  }
  function remove(id) {
    const current = active();
    const saved = load();
    const removed = saved.find((account) => account.id === id);
    const accounts = saved.filter((account) => account.id !== id);
    const secrets = { ...store.get('accountSecrets', {}) };
    delete secrets[id];
    const removeLegacy = id === 'default' && removed?.provider === 'claude' && removed.authType !== 'local';
    commit(accounts.map(({ sessionKey, apiKey, ...metadata }) => metadata), secrets, removeLegacy);
    if (current?.id === id) store.set('settings.activeProfile', accounts[0]?.id || 'default');
  }
  return { load, get, active, select, save, rename, remove, list: () => load().map(publicAccount) };
}

module.exports = { createAccountStore, publicAccount };
