const path = require('node:path');
const { createHash } = require('node:crypto');
const { providerError } = require('./errors');

function nonempty(value) {
  return typeof value === 'string' && value.trim() && !/[\r\n\0]/.test(value);
}

function decodeCredentials(raw, provider, now) {
  let data;
  try {
    if (raw.length > 1024 * 1024) throw new Error();
    data = JSON.parse(raw);
  } catch {
    throw providerError('LOCAL_CREDENTIALS_INVALID');
  }
  const token = provider === 'claude' ? data?.claudeAiOauth?.accessToken : data?.tokens?.access_token;
  const accountId = provider === 'codex' ? data?.tokens?.account_id : undefined;
  if (!nonempty(token) || (provider === 'codex' && !nonempty(accountId))) {
    throw providerError('LOCAL_CREDENTIALS_INVALID');
  }
  if (provider === 'claude') {
    const expiresAt = data.claudeAiOauth.expiresAt;
    if (typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt <= now()) {
      throw providerError('LOCAL_AUTH_EXPIRED');
    }
  }
  return { accessToken: token, ...(accountId ? { accountId } : {}) };
}

async function readCredentials(account, { fs, platform, homeDir, readKeychain, now }) {
  const filename = account.provider === 'claude' ? '.credentials.json' : 'auth.json';
  let raw;
  try {
    raw = await fs.readFile(path.join(account.configDir, filename), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT' || platform !== 'darwin' || account.provider !== 'claude') {
      throw providerError('LOCAL_CREDENTIALS_UNAVAILABLE');
    }
    // A custom profile can only read its own scoped service, never the default service.
    const suffix = account.configDir === path.join(homeDir, '.claude') ? ''
      : `-${createHash('sha256').update(account.configDir).digest('hex').slice(0, 8)}`;
    try {
      raw = await readKeychain({ service: `Claude Code-credentials${suffix}` });
    } catch {
      throw providerError('LOCAL_CREDENTIALS_UNAVAILABLE');
    }
  }
  return decodeCredentials(raw, account.provider, now);
}

module.exports = { readCredentials };
