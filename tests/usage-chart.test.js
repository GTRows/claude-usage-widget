import { describe, it, expect } from 'vitest';
import { chartPoints, quotaHistory } from '../src/renderer/usage-chart.js';

describe('time-proportional usage chart', () => {
  it('compares mixed used and remaining samples in one display mode', () => {
    const rows = [{ timestamp: 1, provider: 'codex', session: 20, weekly: null, quotaDisplay: 'used' }, { timestamp: 2, provider: 'codex', session: 80, weekly: null, quotaDisplay: 'remaining' }];
    expect(quotaHistory(rows, 'remaining').map((row) => row.session)).toEqual([80, 80]);
    expect(quotaHistory(rows, 'used').map((row) => row.session)).toEqual([20, 20]);
    expect(quotaHistory(rows, 'remaining')[0].weekly).toBeNull();
    expect(rows[0].session).toBe(20);
  });
  it('keeps irregular timestamps and unknown quotas without turning them into zero', () => {
    expect(chartPoints([{ timestamp: 100, session: 12 }, { timestamp: 200, session: null }, { timestamp: 900, session: 35 }], 'session')).toEqual([{ x: 100, y: 12 }, { x: 200, y: null }, { x: 900, y: 35 }]);
  });
  it('does not silently relabel invalid samples as usable points', () => {
    expect(chartPoints([{ timestamp: 'invalid', weekly: 10 }, { timestamp: 200, weekly: NaN }], 'weekly')).toEqual([{ x: 200, y: null }]);
  });
});
