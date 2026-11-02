function errorCode(error) {
  if (/401|403|unauthorized|sessionexpired|expired|credentials|auth_required/i.test(`${error?.code || ''} ${error?.message || ''}`)) return 'AUTH_REQUIRED';
  if (/429|rate[_ .-]?limit/i.test(`${error?.code || ''} ${error?.message || ''}`)) return 'RATE_LIMITED';
  return 'FETCH_FAILED';
}

function createAccountUsage({ getAccounts, fetchUsage, recordHistory, onUpdate = () => {}, now = Date.now }) {
  const cache = new Map();
  const pending = new Map();
  const generations = new Map();
  function invalidate(id) {
    generations.set(id, (generations.get(id) || 0) + 1);
    cache.delete(id);
    pending.delete(id);
  }
  function refreshAccount(id) {
    if (pending.has(id)) return pending.get(id);
    const account = getAccounts().find((item) => item.id === id);
    if (!account) return Promise.resolve(null);
    const generation = generations.get(id) || 0;
    const isCurrent = () => (generations.get(id) || 0) === generation && getAccounts().some((item) => item.id === id);
    const request = (async () => {
      let snapshot;
      try {
        const data = await fetchUsage(account);
        if (!isCurrent()) return null;
        snapshot = { accountId: id, data, updatedAt: now(), error: null };
        recordHistory(data, id);
      } catch (error) {
        if (!isCurrent()) return null;
        snapshot = { accountId: id, data: cache.get(id)?.data || null, updatedAt: cache.get(id)?.updatedAt || null, error: { code: errorCode(error) } };
      }
      cache.set(id, snapshot);
      onUpdate(snapshot);
      return snapshot;
    })();
    pending.set(id, request);
    request.finally(() => { if (pending.get(id) === request) pending.delete(id); });
    return request;
  }
  async function refreshAll() {
    const ids = getAccounts().map((account) => account.id);
    const results = [];
    for (let index = 0; index < ids.length; index += 4) {
      results.push(...await Promise.all(ids.slice(index, index + 4).map(refreshAccount)));
    }
    return results.filter(Boolean);
  }
  return { refreshAccount, refreshAll, invalidate, snapshots: () => getAccounts().map((account) => cache.get(account.id)).filter(Boolean) };
}

module.exports = { createAccountUsage };
