const BASE = 'https://claude.ai/api';

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

async function fetchUsage({ sessionKey, organizationId }) {
  if (!sessionKey || !organizationId) {
    throw new Error('Missing credentials. Set CLAUDE_SESSION_KEY and CLAUDE_ORGANIZATION_ID, or run `claude-usage login`.');
  }
  const usageUrl = `${BASE}/organizations/${organizationId}/usage`;
  const overageUrl = `${BASE}/organizations/${organizationId}/overage_spend_limit`;
  const prepaidUrl = `${BASE}/organizations/${organizationId}/prepaid/credits`;

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

async function fetchOrganizations(sessionKey) {
  return fetchJSON(`${BASE}/organizations`, sessionKey);
}

module.exports = { fetchJSON, fetchUsage, fetchOrganizations };
