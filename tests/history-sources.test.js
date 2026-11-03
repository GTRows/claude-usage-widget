import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { historySources, historyForSource, applyHistoryPolicies, disconnectAccount } = require('../src/main/history-sources');

describe('retained account history', () => {
  const history = [{ timestamp: 1, session: 12 }, { timestamp: 2, accountId: 'claude-123', session: 21 }, { timestamp: 3, accountId: 'b', session: 50 }];
  it('exposes real pre-upgrade unassigned history separately from a dated login ID', () => {
    const sources = historySources(history, [{ id: 'claude-123' }], {});
    expect(sources).toEqual([{ id: 'legacy', label: null, legacy: true, count: 1 }]);
    expect(historyForSource(history, 'legacy')).toEqual([history[0]]);
  });
  it('retains history on logout and archives only public account identity', () => {
    const values = { usageHistory: history };
    const store = { get: (key, fallback) => values[key] ?? fallback, set: (key, value) => { values[key] = value; } };
    let active = 'claude-123';
    const accounts = { get: (id) => ({ id, provider: 'claude', label: 'Work', sessionKey: 'private-secret' }), remove: () => { active = 'b'; } };
    disconnectAccount({ store, accounts, invalidate: () => {} }, 'claude-123');
    expect(values.usageHistory).toEqual(history);
    expect(active).toBe('b');
    expect(values.historyArchives['claude-123']).toEqual({ id: 'claude-123', label: 'Work', provider: 'claude' });
    expect(JSON.stringify(values.historyArchives)).not.toContain('private-secret');
    expect(historySources(history, [{ id: 'b' }], values.historyArchives)).toHaveLength(2);
  });
  it('applies account-specific automatic policies without pruning another account', () => {
    expect(applyHistoryPolicies(history, { 'claude-123': { enabled: true, days: 1 } }, 86400002)).toEqual([history[0], history[2]]);
  });
});
