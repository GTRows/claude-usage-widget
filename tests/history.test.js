import { describe, it, expect } from 'vitest';
import {
  normalizeRow,
  filterByRange,
  pruneOlderThan,
  estimateSpanMs,
  toCSV,
  toJSON,
} from '../src/shared/history.js';

const sample = [
  { timestamp: 1000, session: 10, weekly: 20, sonnet: 5, opus: 1, extraUsage: 0 },
  { timestamp: 2000, session: 30, weekly: 40, sonnet: 15, opus: 3, extraUsage: 2 },
  { timestamp: 3000, session: 50, weekly: 60, sonnet: 25, opus: 5, extraUsage: 4 },
];

describe('normalizeRow', () => {
  it('coerces missing fields to null', () => {
    expect(normalizeRow({ timestamp: 1 })).toEqual({
      timestamp: 1, session: null, weekly: null, sonnet: null, opus: null, extraUsage: null,
    });
  });
  it('rejects rows without a numeric timestamp', () => {
    expect(normalizeRow({})).toBeNull();
    expect(normalizeRow(null)).toBeNull();
  });
});

describe('filterByRange', () => {
  it('inclusive on both ends', () => {
    expect(filterByRange(sample, 2000, 3000).length).toBe(2);
  });
  it('open ends with infinity defaults', () => {
    expect(filterByRange(sample).length).toBe(3);
  });
});

describe('pruneOlderThan', () => {
  it('drops rows with ts < cutoff', () => {
    expect(pruneOlderThan(sample, 2000).length).toBe(2);
  });
  it('returns the original when cutoff is invalid', () => {
    expect(pruneOlderThan(sample, NaN)).toEqual(sample);
  });
});

describe('estimateSpanMs', () => {
  it('returns max - min', () => {
    expect(estimateSpanMs(sample)).toBe(2000);
  });
  it('returns 0 for empty input', () => {
    expect(estimateSpanMs([])).toBe(0);
  });
});

describe('toCSV', () => {
  it('emits a header and one row per entry', () => {
    const csv = toCSV(sample);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('timestamp,iso,session,weekly,sonnet,opus,extraUsage');
    expect(lines.length).toBe(4);
    expect(lines[1]).toContain('1000,');
    expect(lines[1]).toContain('1970-01-01T00:00:01.000Z');
  });
});

describe('toJSON', () => {
  it('attaches an iso field to each row', () => {
    const out = toJSON(sample);
    expect(out).toHaveLength(3);
    expect(out[0].iso).toBe('1970-01-01T00:00:01.000Z');
    expect(out[0].session).toBe(10);
  });
});
