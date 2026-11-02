const { selectAccountHistory, pruneAccountHistory } = require('../shared/account-history');

function historyForSource(history, id) {
  return id === 'legacy' ? history.filter((row) => !row.accountId) : selectAccountHistory(history, id);
}
function historySources(history, accounts, archives) {
  const sources = [];
  const legacy = historyForSource(history, 'legacy');
  if (legacy.length) sources.push({ id: 'legacy', label: null, legacy: true, count: legacy.length });
  for (const account of Object.values(archives)) {
    const count = historyForSource(history, account.id).length;
    if (count && !accounts.some((row) => row.id === account.id)) sources.push({ ...account, count });
  }
  return sources;
}
function applyHistoryPolicies(history, policies, now = Date.now()) {
  let retained = history;
  for (const [id, policy] of Object.entries(policies)) {
    if (policy.enabled) retained = pruneAccountHistory(retained, id, now - Math.max(1, policy.days || 30) * 86400000);
  }
  return retained;
}
function disconnectAccount({ store, accounts, invalidate }, id) {
  const account = accounts.get(id);
  if (account) {
    const { provider, label } = account;
    store.set('historyArchives', { ...store.get('historyArchives', {}), [id]: { id, provider, label } });
  }
  accounts.remove(id);
  invalidate(id);
}
module.exports = { historyForSource, historySources, applyHistoryPolicies, disconnectAccount };
