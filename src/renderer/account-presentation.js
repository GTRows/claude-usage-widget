export function accountProviderLabel(account) {
  return account.provider === 'codex' ? (account.authType === 'local' ? 'Codex' : 'OpenAI API') : 'Claude';
}

export function quotaText(window) {
  return Number.isFinite(window?.utilization) ? `${Math.round(window.utilization)}%` : '—';
}
