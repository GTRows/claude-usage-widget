import { describe, it, expect } from 'vitest';
import {
  clampThreshold,
  normalizeThresholds,
  statusForPercent,
  statusColor,
} from '../src/shared/thresholds.js';

describe('clampThreshold', () => {
  it('clamps to 0..100 and rounds', () => {
    expect(clampThreshold(50, 0)).toBe(50);
    expect(clampThreshold(150, 0)).toBe(100);
    expect(clampThreshold(-10, 0)).toBe(0);
    expect(clampThreshold(33.7, 0)).toBe(34);
  });
  it('falls back when value is not numeric', () => {
    expect(clampThreshold('abc', 42)).toBe(42);
    expect(clampThreshold(undefined, 42)).toBe(42);
  });
});

describe('normalizeThresholds', () => {
  it('lifts danger up to warn when danger < warn', () => {
    const t = normalizeThresholds({ warn: 80, danger: 50 });
    expect(t.danger).toBe(80);
  });
  it('uses defaults when input is empty', () => {
    expect(normalizeThresholds()).toEqual({ warn: 75, danger: 90, dead: 100 });
  });
});

describe('statusForPercent', () => {
  const t = { warn: 75, danger: 90 };
  it('returns zero for 0 or non-positive', () => {
    expect(statusForPercent(0, t)).toBe('zero');
    expect(statusForPercent(-5, t)).toBe('zero');
    expect(statusForPercent(null, t)).toBe('zero');
  });
  it('returns dead at or above 100', () => {
    expect(statusForPercent(100, t)).toBe('dead');
    expect(statusForPercent(120, t)).toBe('dead');
  });
  it('returns danger between danger threshold and 100', () => {
    expect(statusForPercent(95, t)).toBe('danger');
    expect(statusForPercent(90, t)).toBe('danger');
  });
  it('returns warn between warn and danger', () => {
    expect(statusForPercent(80, t)).toBe('warn');
    expect(statusForPercent(75, t)).toBe('warn');
  });
  it('returns low otherwise', () => {
    expect(statusForPercent(10, t)).toBe('low');
    expect(statusForPercent(74.99, t)).toBe('low');
  });
});

describe('statusColor', () => {
  it('returns a css color for every known status', () => {
    for (const s of ['zero', 'low', 'warn', 'danger', 'dead']) {
      expect(statusColor(s)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('falls back to the zero color for unknown status', () => {
    expect(statusColor('unknown')).toBe(statusColor('zero'));
  });
});
