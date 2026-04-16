import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THROTTLE,
  isInPeakWindow,
  computeNextTransition,
  getPeakThrottleStatus,
} from '../src/shared/peak-throttle.js';

const T = DEFAULT_THROTTLE;

describe('isInPeakWindow', () => {
  it('returns true for a weekday 13:00 UTC inside the peak window', () => {
    const t = Date.UTC(2026, 2, 16, 13, 0, 0);
    expect(isInPeakWindow(t, T)).toBe(true);
  });
  it('returns false exactly at the end boundary (18:00 UTC)', () => {
    const t = Date.UTC(2026, 2, 16, 18, 0, 0);
    expect(isInPeakWindow(t, T)).toBe(false);
  });
  it('returns false on a weekend during the peak hours', () => {
    const t = Date.UTC(2026, 2, 14, 13, 0, 0);
    expect(isInPeakWindow(t, T)).toBe(false);
  });
  it('returns false for a weekday outside the hours', () => {
    const t = Date.UTC(2026, 2, 16, 8, 0, 0);
    expect(isInPeakWindow(t, T)).toBe(false);
  });
});

describe('computeNextTransition', () => {
  it('during peak: next transition is today 18:00 UTC', () => {
    const now = Date.UTC(2026, 2, 16, 14, 30, 0);
    expect(computeNextTransition(now, T)).toBe(Date.UTC(2026, 2, 16, 18, 0, 0));
  });
  it('before peak on a weekday: next transition is today 12:00 UTC', () => {
    const now = Date.UTC(2026, 2, 16, 8, 0, 0);
    expect(computeNextTransition(now, T)).toBe(Date.UTC(2026, 2, 16, 12, 0, 0));
  });
  it('after peak on a weekday: next transition is next weekday 12:00 UTC', () => {
    const now = Date.UTC(2026, 2, 16, 20, 0, 0);
    expect(computeNextTransition(now, T)).toBe(Date.UTC(2026, 2, 17, 12, 0, 0));
  });
  it('friday evening skips the weekend to monday 12:00 UTC', () => {
    const now = Date.UTC(2026, 2, 20, 20, 0, 0);
    expect(computeNextTransition(now, T)).toBe(Date.UTC(2026, 2, 23, 12, 0, 0));
  });
  it('saturday mid-day: next transition is monday 12:00 UTC', () => {
    const now = Date.UTC(2026, 2, 21, 15, 0, 0);
    expect(computeNextTransition(now, T)).toBe(Date.UTC(2026, 2, 23, 12, 0, 0));
  });
});

describe('getPeakThrottleStatus', () => {
  it('reports throttled during the peak window on a weekday', () => {
    const s = getPeakThrottleStatus(Date.UTC(2026, 3, 16, 14, 0, 0), T);
    expect(s.isThrottled).toBe(true);
    expect(s.nextTransitionAt).toBe(Date.UTC(2026, 3, 16, 18, 0, 0));
  });
  it('reports normal outside peak on a weekday', () => {
    const s = getPeakThrottleStatus(Date.UTC(2026, 3, 16, 8, 0, 0), T);
    expect(s.isThrottled).toBe(false);
    expect(s.nextTransitionAt).toBe(Date.UTC(2026, 3, 16, 12, 0, 0));
  });
  it('reports normal on a weekend', () => {
    const s = getPeakThrottleStatus(Date.UTC(2026, 3, 18, 14, 0, 0), T);
    expect(s.isThrottled).toBe(false);
    expect(s.nextTransitionAt).toBe(Date.UTC(2026, 3, 20, 12, 0, 0));
  });
  it('exposes the peak window and days for the renderer', () => {
    const s = getPeakThrottleStatus(Date.UTC(2026, 3, 16, 14, 0, 0), T);
    expect(s.peakWindowUTC).toEqual({ startHour: 12, endHour: 18 });
    expect(s.peakDaysUTC).toEqual([1, 2, 3, 4, 5]);
  });
});
