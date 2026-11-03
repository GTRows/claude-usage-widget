const { providerError } = require('./errors');

const ENDPOINTS = {
  claude: 'https://api.anthropic.com/api/oauth/usage',
  codex: 'https://chatgpt.com/backend-api/wham/usage',
};

async function requestUsage(provider, credentials, { fetch, timeoutMs }) {
  const controller = new AbortController();
  const headers = { Authorization: `Bearer ${credentials.accessToken}`, Accept: 'application/json' };
  if (provider === 'claude') headers['anthropic-beta'] = 'oauth-2025-04-20';
  if (provider === 'codex') headers['ChatGPT-Account-Id'] = credentials.accountId;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(providerError('PROVIDER_TIMEOUT'));
      controller.abort();
    }, timeoutMs);
  });
  const request = (async () => {
    let response;
    try {
      response = await fetch(ENDPOINTS[provider], { method: 'GET', headers, redirect: 'error', signal: controller.signal });
    } catch {
      throw providerError('PROVIDER_NETWORK_ERROR');
    }
    if (response.redirected || (response.status >= 300 && response.status < 400)) {
      throw providerError('PROVIDER_REDIRECT');
    }
    if (response.status === 401 || response.status === 403) throw providerError('LOCAL_AUTH_EXPIRED');
    if (response.status === 429) throw providerError('PROVIDER_RATE_LIMITED', 429);
    if (!response.ok) throw providerError('PROVIDER_HTTP_ERROR', response.status);
    try {
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
      return data;
    } catch {
      throw providerError('PROVIDER_INVALID_RESPONSE');
    }
  })();
  try {
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { requestUsage };
