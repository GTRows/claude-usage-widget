function normalizedDate(value) {
  const milliseconds = typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value * 1000 : (typeof value === 'string' && value.trim() ? Date.parse(value) : NaN);
  return Number.isFinite(milliseconds) && Number.isFinite(new Date(milliseconds).getTime())
    ? new Date(milliseconds).toISOString() : null;
}

function quotaWindow(percent, reset) {
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return { utilization: percent, resets_at: normalizedDate(reset) };
}

function normalizeClaudeUsage(data) {
  const result = { provider: 'claude', usageType: 'subscription' };
  for (const key of ['five_hour', 'seven_day', 'seven_day_sonnet', 'seven_day_opus', 'seven_day_oauth_apps']) {
    const window = quotaWindow(data?.[key]?.utilization, data?.[key]?.resets_at);
    if (window) result[key] = window;
  }
  return result;
}

function normalizeCodexUsage(data) {
  const result = { provider: 'codex', usageType: 'subscription' };
  for (const raw of [data?.rate_limit?.primary_window, data?.rate_limit?.secondary_window]) {
    const key = raw?.limit_window_seconds === 18000 ? 'five_hour'
      : raw?.limit_window_seconds === 604800 ? 'seven_day' : null;
    const window = quotaWindow(raw?.used_percent, raw?.reset_at);
    if (key && window) result[key] = window;
  }
  return result;
}

module.exports = { normalizeClaudeUsage, normalizeCodexUsage };
