import { describe, it, expect } from 'vitest';
import { filterSavedHistory } from '../src/renderer/saved-history.js';
describe('saved history range', () => {
  const rows = [{ timestamp: 10 }, { timestamp: 100 }, { timestamp: 150 }];
  it('uses the selected relative window for archived samples', () => {
    expect(filterSavedHistory(rows, { rangeMs: 60, now: 155 })).toEqual([rows[1], rows[2]]);
  });
  it('uses inclusive custom bounds and preserves an empty result', () => {
    expect(filterSavedHistory(rows, { custom: true, from: 11, to: 100 })).toEqual([rows[1]]);
    expect(filterSavedHistory(rows, { custom: true, from: 101, to: 120 })).toEqual([]);
  });
});
