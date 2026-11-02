import { describe, it, expect } from 'vitest';
import { chartPoints } from '../src/renderer/usage-chart.js';

describe('time-proportional usage chart', () => {
  it('keeps irregular timestamps and unknown quotas without turning them into zero', () => {
    expect(chartPoints([{ timestamp: 100, session: 12 }, { timestamp: 200, session: null }, { timestamp: 900, session: 35 }], 'session')).toEqual([{ x: 100, y: 12 }, { x: 200, y: null }, { x: 900, y: 35 }]);
  });
  it('does not silently relabel invalid samples as usable points', () => {
    expect(chartPoints([{ timestamp: 'invalid', weekly: 10 }, { timestamp: 200, weekly: NaN }], 'weekly')).toEqual([{ x: 200, y: null }]);
  });
});
