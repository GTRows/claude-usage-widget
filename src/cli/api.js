const { normalizeProvider } = require('../shared/accounts');

const CLAUDE_BASE = 'https://claude.ai/api';
const OPENAI_BASE = 'https://api.openai.com/v1';

async function fetchJSON(url, sessionKey) {
  const res = await fetch(url, {
    headers: {
      cookie: `sessionKey=${sessionKey}`,
      accept: 'application/json',
      'user-agent': 'claude-usage-cli/1.0 (+https://github.com/GTRows/claude-usage-widget)',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      const err = new Error('SessionExpired');
      err.code = 'SESSION_EXPIRED';
      throw err;
    }
    if (text.startsWith('<')) {
      const err = new Error('CloudflareBlocked');
      err.code = 'CLOUDFLARE';
      throw err;
    }
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('UnexpectedHTML');
    err.code = 'CLOUDFLARE';
    throw err;
  }
}

async function fetchOpenAIJSON(url, { apiKey, organizationHeader, projectId }) {
  const headers = {
    authorization: `Bearer ${apiKey}`,
    accept: 'application/json',
    'user-agent': 'claude-usage-cli/1.0 (+https://github.com/GTRows/claude-usage-widget)',
  };
  if (organizationHeader) headers['OpenAI-Organization'] = organizationHeader;
  if (projectId) headers['OpenAI-Project'] = projectId;

  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      const err = new Error('Unauthorized');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error('UnexpectedJSON');
    err.code = 'BAD_JSON';
    throw err;
  }
}

async function fetchClaudeUsage({ sessionKey, organizationId }) {
  if (!sessionKey || !organizationId) {
    throw new Error('Missing credentials. Set CLAUDE_SESSION_KEY and CLAUDE_ORGANIZATION_ID, or run `claude-usage login`.');
  }
  const usageUrl = `${CLAUDE_BASE}/organizations/${organizationId}/usage`;
  const overageUrl = `${CLAUDE_BASE}/organizations/${organizationId}/overage_spend_limit`;
  const prepaidUrl = `${CLAUDE_BASE}/organizations/${organizationId}/prepaid/credits`;

  const settle = (p) => p.then((value) => ({ status: 'fulfilled', value })).catch((reason) => ({ status: 'rejected', reason }));
  const [usageRes, overageRes, prepaidRes] = await Promise.all([
    settle(fetchJSON(usageUrl, sessionKey)),
    settle(fetchJSON(overageUrl, sessionKey)),
    settle(fetchJSON(prepaidUrl, sessionKey)),
  ]);

  if (usageRes.status === 'rejected') throw usageRes.reason;
  const data = usageRes.value;

  if (overageRes.status === 'fulfilled' && overageRes.value) {
    const overage = overageRes.value;
    const limit = overage.monthly_credit_limit ?? overage.spend_limit_amount_cents;
    const used = overage.used_credits ?? overage.balance_cents;
    const enabled = overage.is_enabled !== undefined ? overage.is_enabled : (limit != null);
    if (enabled && typeof limit === 'number' && limit > 0 && typeof used === 'number') {
      data.extra_usage = {
        utilization: (used / limit) * 100,
        used_cents: used,
        limit_cents: limit,
        is_enabled: true,
        currency: overage.currency || 'USD',
      };
    }
  }
  if (prepaidRes.status === 'fulfilled' && prepaidRes.value && typeof prepaidRes.value.amount === 'number') {
    if (!data.extra_usage) data.extra_usage = {};
    data.extra_usage.balance_cents = prepaidRes.value.amount;
    if (!data.extra_usage.currency && prepaidRes.value.currency) {
      data.extra_usage.currency = prepaidRes.value.currency;
    }
  }

  return data;
}

function sumBuckets(response, selector) {
  if (!response || !Array.isArray(response.data)) return 0;
  let total = 0;
  for (const bucket of response.data) {
    const results = Array.isArray(bucket.results) ? bucket.results : [];
    for (const result of results) {
      total += Number(selector(result) || 0);
    }
  }
  return total;
}

async function fetchCodexUsage(credentials) {
  const { apiKey } = credentials;
  if (!apiKey) {
    throw new Error('Missing Codex credentials. Set OPENAI_ADMIN_KEY or run `claude-usage login --provider codex --key K`.');
  }

  const end = Math.floor(Date.now() / 1000);
  const start = end - (7 * 24 * 60 * 60);
  const baseParams = new URLSearchParams({
    start_time: String(start),
    end_time: String(end),
    bucket_width: '1d',
    limit: '7',
  });
  const usageUrl = `${OPENAI_BASE}/organization/usage/completions?${baseParams.toString()}`;
  const costsUrl = `${OPENAI_BASE}/organization/costs?${baseParams.toString()}`;

  const [usage, costs] = await Promise.all([
    fetchOpenAIJSON(usageUrl, credentials),
    fetchOpenAIJSON(costsUrl, credentials),
  ]);

  const inputTokens = sumBuckets(usage, (row) => row.input_tokens);
  const outputTokens = sumBuckets(usage, (row) => row.output_tokens);
  const requests = sumBuckets(usage, (row) => row.num_model_requests);
  const costValue = sumBuckets(costs, (row) => row.amount?.value);
  const currency = costs?.data?.flatMap((bucket) => bucket.results || [])
    .find((row) => row.amount?.currency)?.amount.currency?.toUpperCase() || 'USD';

  return {
    provider: 'codex',
    five_hour: {
      utilization: 0,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      num_model_requests: requests,
      resets_at: null,
    },
    seven_day: {
      utilization: 0,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      num_model_requests: requests,
      resets_at: null,
    },
    extra_usage: {
      utilization: 0,
      used_cents: Math.round(costValue * 100),
      is_enabled: true,
      currency,
    },
    codex_usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      num_model_requests: requests,
      cost: costValue,
      currency,
    },
  };
}

async function fetchUsage(credentials = {}) {
  const provider = normalizeProvider(credentials.provider);
  if (provider === 'codex') return fetchCodexUsage(credentials);
  return fetchClaudeUsage(credentials);
}

async function fetchOrganizations(sessionKey) {
  return fetchJSON(`${CLAUDE_BASE}/organizations`, sessionKey);
}

module.exports = { fetchJSON, fetchOpenAIJSON, fetchUsage, fetchClaudeUsage, fetchCodexUsage, fetchOrganizations };
