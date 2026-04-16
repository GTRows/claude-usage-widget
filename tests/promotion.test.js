import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROMOTION,
  isInPeakWindow,
  computeNextTransition,
  getPromotionStatus,
} from '../src/shared/promotion.js';

const P = DEFAULT_PROMOTION;

describe('isInPeakWindow', () => {
  it('returns true for a weekday 13:00 UTC inside the peak window', () => {
    const t = Date.UTC(2026, 2, 16, 13, 0, 0);
    expect(isInPeakWindow(t, P)).toBe(true);
  });
  it('returns false exactly at the end boundary (18:00 UTC)', () => {
    const t = Date.UTC(2026, 2, 16, 18, 0, 0);
    expect(isInPeakWindow(t, P)).toBe(false);
  });
  it('returns false on a weekend during the peak hours', () => {
    const t = Date.UTC(2026, 2, 14, 13, 0, 0);
    expect(isInPeakWindow(t, P)).toBe(false);
  });
  it('returns false for a weekday outside the hours', () => {
    const t = Date.UTC(2026, 2, 16, 8, 0, 0);
    expect(isInPeakWindow(t, P)).toBe(false);
  });
});

describe('computeNextTransition', () => {
  it('during peak: next transition is today 18:00 UTC', () => {
    const now = Date.UTC(2026, 2, 16, 14, 30, 0);
    expect(computeNextTransition(now, P)).toBe(Date.UTC(2026, 2, 16, 18, 0, 0));
  });
  it('before peak on a weekday: next transition is today 12:00 UTC', () => {
    const now = Date.UTC(2026, 2, 16, 8, 0, 0);
    expect(computeNextTransition(now, P)).toBe(Date.UTC(2026, 2, 16, 12, 0, 0));
  });
  it('after peak on a weekday: next transition is next weekday 12:00 UTC', () => {
    const now = Date.UTC(2026, 2, 16, 20, 0, 0);
    expect(computeNextTransition(now, P)).toBe(Date.UTC(2026, 2, 17, 12, 0, 0));
  });
  it('friday evening skips the weekend to monday 12:00 UTC', () => {
    const now = Date.UTC(2026, 2, 20, 20, 0, 0);
    expect(computeNextTransition(now, P)).toBe(Date.UTC(2026, 2, 23, 12, 0, 0));
  });
});

describe('getPromotionStatus', () => {
  it('reports upcoming before the start date', () => {
    const s = getPromotionStatus(Date.UTC(2026, 2, 1, 0, 0, 0), P);
    expect(s.state).toBe('upcoming');
    expect(s.isBoost).toBe(false);
    expect(s.nextTransitionAt).toBe(P.startMs);
  });
  it('reports active and boost outside peak hours within window', () => {
    const s = getPromotionStatus(Date.UTC(2026, 2, 16, 8, 0, 0), P);
    expect(s.state).toBe('active');
    expect(s.isBoost).toBe(true);
  });
  it('reports active and NOT boost during peak hours', () => {
    const s = getPromotionStatus(Date.UTC(2026, 2, 16, 13, 0, 0), P);
    expect(s.state).toBe('active');
    expect(s.isBoost).toBe(false);
  });
  it('caps nextTransitionAt at promotion end', () => {
    const s = getPromotionStatus(Date.UTC(2026, 2, 28, 20, 0, 0), P);
    expect(s.state).toBe('active');
    expect(s.nextTransitionAt).toBe(P.endMs);
  });
  it('reports ended after the promotion closes', () => {
    const s = getPromotionStatus(Date.UTC(2026, 3, 1, 0, 0, 0), P);
    expect(s.state).toBe('ended');
    expect(s.isBoost).toBe(false);
    expect(s.nextTransitionAt).toBeNull();
  });
});
