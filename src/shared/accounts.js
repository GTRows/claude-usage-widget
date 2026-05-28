const PROVIDERS = {
  claude: {
    id: 'claude',
    label: 'Claude',
    loginUrl: 'https://claude.ai',
    cookieUrl: 'https://claude.ai',
    sessionCookieName: 'sessionKey',
  },
  codex: {
    id: 'codex',
    label: 'Codex',
    loginUrl: 'https://chatgpt.com/codex',
    cookieUrl: 'https://api.openai.com',
    sessionCookieName: null,
  },
};

const DEFAULT_ACCOUNT_ID = 'default';
const DEFAULT_PROVIDER = 'claude';

function normalizeProvider(provider) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, provider) ? provider : DEFAULT_PROVIDER;
}

function accountLabel(account) {
  if (account && typeof account.label === 'string' && account.label.trim()) {
    return account.label.trim();
  }
  const provider = PROVIDERS[normalizeProvider(account?.provider)];
  return `${provider.label} Account`;
}

function normalizeAccount(input = {}, fallbackId = DEFAULT_ACCOUNT_ID) {
  const provider = normalizeProvider(input.provider);
  const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : fallbackId;
  const out = {
    id,
    provider,
    label: accountLabel({ ...input, provider }),
  };

  if (typeof input.sessionKey === 'string' && input.sessionKey) out.sessionKey = input.sessionKey;
  if (typeof input.organizationId === 'string' && input.organizationId) out.organizationId = input.organizationId;
  if (typeof input.apiKey === 'string' && input.apiKey) out.apiKey = input.apiKey;
  if (typeof input.projectId === 'string' && input.projectId) out.projectId = input.projectId;
  if (typeof input.organizationHeader === 'string' && input.organizationHeader) {
    out.organizationHeader = input.organizationHeader;
  }

  return out;
}

function normalizeAccounts(input) {
  const seen = new Set();
  const accounts = [];
  if (Array.isArray(input)) {
    for (const raw of input) {
      if (!raw || typeof raw !== 'object') continue;
      const account = normalizeAccount(raw, `${DEFAULT_ACCOUNT_ID}-${accounts.length + 1}`);
      if (seen.has(account.id)) continue;
      seen.add(account.id);
      accounts.push(account);
    }
  }
  return accounts;
}

function legacyClaudeAccount({ sessionKey, organizationId } = {}) {
  if (!sessionKey && !organizationId) return null;
  return normalizeAccount({
    id: DEFAULT_ACCOUNT_ID,
    provider: 'claude',
    label: 'Claude Account',
    sessionKey,
    organizationId,
  });
}

function getActiveAccount(accounts, activeAccountId = DEFAULT_ACCOUNT_ID) {
  const normalized = normalizeAccounts(accounts);
  return normalized.find((account) => account.id === activeAccountId)
    || normalized[0]
    || null;
}

function hasUsableCredentials(account) {
  if (!account) return false;
  if (account.provider === 'claude') return Boolean(account.sessionKey && account.organizationId);
  if (account.provider === 'codex') return true;
  return false;
}

module.exports = {
  PROVIDERS,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_PROVIDER,
  normalizeProvider,
  normalizeAccount,
  normalizeAccounts,
  legacyClaudeAccount,
  getActiveAccount,
  hasUsableCredentials,
};
