const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  DEFAULT_ACCOUNT_ID,
  getActiveAccount,
  legacyClaudeAccount,
  normalizeAccounts,
  normalizeProvider,
} = require('../shared/accounts');

function getConfigDir() {
  if (process.env.CLAUDE_USAGE_CONFIG_DIR) {
    return process.env.CLAUDE_USAGE_CONFIG_DIR;
  }
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'claude-usage-cli');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'claude-usage-cli');
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, 'claude-usage');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function readConfig() {
  const p = getConfigPath();
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  const current = readConfig();
  const next = { ...current, ...patch };
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  return next;
}

function loadCredentials(requestedProviderOverride = null) {
  const requestedProvider = requestedProviderOverride || process.env.CLAUDE_USAGE_PROVIDER || process.env.USAGE_PROVIDER;
  const provider = normalizeProvider(requestedProvider || ((process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_API_KEY) ? 'codex' : 'claude'));
  const fromEnv = {
    id: process.env.CLAUDE_USAGE_ACCOUNT || DEFAULT_ACCOUNT_ID,
    provider,
    sessionKey: process.env.CLAUDE_SESSION_KEY || null,
    organizationId: process.env.CLAUDE_ORGANIZATION_ID || null,
    apiKey: process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_API_KEY || null,
    organizationHeader: process.env.OPENAI_ORGANIZATION_ID || null,
    projectId: process.env.OPENAI_PROJECT_ID || null,
    codexQuotaDisplay: process.env.CODEX_QUOTA_DISPLAY || null,
  };
  if (provider === 'claude' && fromEnv.sessionKey && fromEnv.organizationId) return fromEnv;
  if (provider === 'codex' && fromEnv.apiKey) return fromEnv;

  const cfg = readConfig();
  const activeAccountId = cfg.activeAccountId || cfg.activeProfile || DEFAULT_ACCOUNT_ID;
  const accounts = normalizeAccounts(cfg.accounts);
  const legacy = legacyClaudeAccount(cfg);
  const active = getActiveAccount(accounts, activeAccountId) || legacy;
  if (requestedProvider) {
    if (active && active.provider === provider) return active;
    const matching = accounts.find((account) => account.provider === provider);
    if (matching) return matching;
    if (provider === 'codex') return fromEnv;
  }
  if (active) return active;

  return {
    id: DEFAULT_ACCOUNT_ID,
    provider: 'claude',
    sessionKey: null,
    organizationId: null,
  };
}

module.exports = {
  getConfigDir,
  getConfigPath,
  readConfig,
  writeConfig,
  loadCredentials,
};
