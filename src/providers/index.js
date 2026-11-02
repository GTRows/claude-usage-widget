const nativeFs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { readMacKeychain } = require('./keychain');
const { readCredentials } = require('./credentials');
const { requestUsage } = require('./request');
const { normalizeClaudeUsage, normalizeCodexUsage } = require('./usage');
const { providerError } = require('./errors');

function createLocalProviderAdapters(options = {}) {
  const dependencies = {
    fs: nativeFs,
    homeDir: os.homedir(),
    env: process.env,
    platform: process.platform,
    fetch: (...args) => globalThis.fetch(...args),
    readKeychain: readMacKeychain,
    now: Date.now,
    timeoutMs: 15000,
    ...options,
  };
  const { fs, homeDir, env } = dependencies;

  function metadata(provider, directory) {
    if (!['claude', 'codex'].includes(provider) || typeof directory !== 'string'
      || !path.isAbsolute(directory) || directory.includes('\0')) {
      throw providerError('LOCAL_PROFILE_INVALID');
    }
    // This identifies the linked profile, not its account owner or shared settings.
    const configDir = path.normalize(directory);
    const id = `local-${provider}-${createHash('sha256').update(configDir).digest('hex').slice(0, 24)}`;
    return { id, provider, authType: 'local', configDir, label: `${provider === 'claude' ? 'Claude' : 'Codex'} (${path.basename(configDir)})` };
  }

  async function discoverLocalProfiles() {
    const candidates = [['claude', path.join(homeDir, '.claude')], ['codex', path.join(homeDir, '.codex')]];
    for (const [provider, variable] of [['claude', 'CLAUDE_CONFIG_DIR'], ['codex', 'CODEX_HOME']]) {
      if (typeof env[variable] === 'string' && path.isAbsolute(env[variable])) candidates.push([provider, env[variable]]);
    }
    try {
      for (const name of (await fs.readdir(homeDir)).sort()) {
        if (name.startsWith('.claude-')) candidates.push(['claude', path.join(homeDir, name)]);
      }
    } catch {
      // An unreadable home does not prevent explicitly linking another directory.
    }
    const found = new Map();
    for (const [provider, directory] of candidates) {
      try {
        const account = metadata(provider, directory);
        if ((await fs.stat(account.configDir)).isDirectory()) found.set(account.id, account);
      } catch {
        // Discovery is a best-effort directory inventory; it never opens credentials.
      }
    }
    return [...found.values()];
  }

  async function linkLocalProfile(provider, directory) {
    const account = metadata(provider, directory);
    try {
      if (!(await fs.stat(account.configDir)).isDirectory()) throw new Error();
    } catch {
      throw providerError('LOCAL_PROFILE_INVALID');
    }
    try {
      await readCredentials(account, dependencies);
    } catch (error) {
      // Keep a valid expired profile link so it can recover after the CLI signs in.
      if (error.code !== 'LOCAL_AUTH_EXPIRED') throw error;
    }
    return account;
  }

  async function fetchLocalUsage(account) {
    if (account?.authType !== 'local') throw providerError('LOCAL_PROFILE_INVALID');
    const profile = metadata(account.provider, account.configDir);
    const credentials = await readCredentials(profile, dependencies);
    const data = await requestUsage(profile.provider, credentials, dependencies);
    return profile.provider === 'claude' ? normalizeClaudeUsage(data) : normalizeCodexUsage(data);
  }

  return { discoverLocalProfiles, linkLocalProfile, fetchLocalUsage };
}

module.exports = { createLocalProviderAdapters, ...createLocalProviderAdapters() };
