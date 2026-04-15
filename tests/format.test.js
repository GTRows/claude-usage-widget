import { describe, it, expect } from 'vitest';
import {
  formatPercent,
  formatBytes,
  formatDuration,
  formatTime12h,
  formatTime24h,
  formatCurrency,
} from '../src/shared/format.js';

describe('formatPercent', () => {
  it('formats with the requested digits', () => {
    expect(formatPercent(42)).toBe('42%');
    expect(formatPercent(42.567, 1)).toBe('42.6%');
  });
  it('returns -- for non-numeric input', () => {
    expect(formatPercent('abc')).toBe('--');
  });
});

describe('formatBytes', () => {
  it('uses the right unit at each boundary', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(formatBytes(3.5 * 1024 * 1024 * 1024)).toBe('3.5 GB');
  });
  it('drops the decimal once the value is two digits', () => {
    expect(formatBytes(15 * 1024)).toBe('15 KB');
  });
});

describe('formatDuration', () => {
  it('formats hours, minutes, seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45 * 1000)).toBe('45s');
    expect(formatDuration(75 * 1000)).toBe('1m 15s');
    expect(formatDuration(3 * 3600 * 1000 + 12 * 60 * 1000)).toBe('3h 12m');
  });
});

describe('formatTime12h / formatTime24h', () => {
  const noon = new Date('2026-04-15T12:00:00');
  const morning = new Date('2026-04-15T09:05:00');
  const evening = new Date('2026-04-15T21:30:00');
  it('uses 12h with am/pm marker', () => {
    expect(formatTime12h(noon)).toBe('12:00 PM');
    expect(formatTime12h(morning)).toBe('9:05 AM');
    expect(formatTime12h(evening)).toBe('9:30 PM');
  });
  it('uses zero-padded 24h', () => {
    expect(formatTime24h(noon)).toBe('12:00');
    expect(formatTime24h(morning)).toBe('09:05');
    expect(formatTime24h(evening)).toBe('21:30');
  });
});

describe('formatCurrency', () => {
  it('formats USD cents', () => {
    expect(formatCurrency(1234, 'USD')).toBe('$12.34');
  });
  it('returns -- for non-numeric input', () => {
    expect(formatCurrency('abc')).toBe('--');
  });
});
