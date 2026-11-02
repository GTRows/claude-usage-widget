function belongsTo(entry, accountId) {
  return (entry.accountId || 'default') === accountId;
}

function selectAccountHistory(history, accountId) {
  return history.filter((entry) => belongsTo(entry, accountId));
}

function removeAccountHistory(history, accountId) {
  return history.filter((entry) => !belongsTo(entry, accountId));
}

function pruneAccountHistory(history, accountId, cutoffMs) {
  return history.filter((entry) => !belongsTo(entry, accountId) || entry.timestamp > cutoffMs);
}

function appendAccountSample(history, data, accountId, { now = Date.now(), retentionDays = 30, maxSamples = 10000 } = {}) {
  const percentage = (window) => Number.isFinite(window?.utilization) ? window.utilization : null;
  const api = data.codex_usage;
  const entry = {
    accountId, timestamp: now, provider: data.provider || 'claude', quotaDisplay: data.quota_display || 'used',
    session: api ? null : percentage(data.five_hour), weekly: api ? null : percentage(data.seven_day),
    sonnet: percentage(data.seven_day_sonnet), opus: percentage(data.seven_day_opus),
    extraUsage: percentage(data.extra_usage),
  };
  if (api) Object.assign(entry, { apiRequests: api.num_model_requests, apiCost: api.cost, inputTokens: api.input_tokens, outputTokens: api.output_tokens, apiCurrency: api.currency });
  const cutoff = now - retentionDays * 86400000;
  const retained = pruneAccountHistory(history, accountId, cutoff);
  const scoped = [...selectAccountHistory(retained, accountId), entry].slice(-maxSamples);
  return [...removeAccountHistory(retained, accountId), ...scoped].sort((a, b) => a.timestamp - b.timestamp);
}

module.exports = { selectAccountHistory, appendAccountSample, removeAccountHistory, pruneAccountHistory };
