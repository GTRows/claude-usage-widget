export function accountProviderLabel(account) {
  return account.provider === 'codex' ? (account.authType === 'local' || account.hasApiKey === false ? 'Codex' : 'OpenAI API') : 'Claude';
}

export function isApiUsage(data) {
  return Number.isFinite(data?.codex_usage?.num_model_requests);
}

export function quotaText(window) {
  return Number.isFinite(window?.utilization) ? `${Math.round(window.utilization)}%` : '—';
}
