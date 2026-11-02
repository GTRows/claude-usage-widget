import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { selectAccountHistory, appendAccountSample, removeAccountHistory } = require('../src/shared/account-history');

describe('account history isolation', () => {
  const history = [{ timestamp: 10, session: 40 }, { timestamp: 20, accountId: 'work', session: 25 }, { timestamp: 30, accountId: 'personal', session: 75 }];
  it('keeps legacy unscoped samples only in the legacy account', () => {
    expect(selectAccountHistory(history, 'default')).toEqual([history[0]]);
    expect(selectAccountHistory(history, 'work')).toEqual([history[1]]);
    expect(selectAccountHistory(history, 'personal')).toEqual([history[2]]);
  });
  it('adds samples with explicit identity and does not invent an unknown quota', () => {
    const next = appendAccountSample([], { seven_day: { utilization: 17 } }, 'work', { now: 100 });
    expect(next[0]).toMatchObject({ accountId: 'work', weekly: 17, session: null });
  });
  it('removes only the selected account history', () => {
    expect(removeAccountHistory(history, 'work')).toEqual([history[0], history[2]]);
  });
});
