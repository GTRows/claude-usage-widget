import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SCHEDULER_PATH = '../src/main/auto-fire/scheduler';

let mod;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  delete require.cache[require.resolve(SCHEDULER_PATH)];
  mod = require(SCHEDULER_PATH);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createAutoFireScheduler.arm', () => {
  it('fires expired exactly once after time advances past resets_at + JITTER_MS', () => {
    const scheduler = mod.createAutoFireScheduler();
    const listener = vi.fn();
    scheduler.on('expired', listener);

    const resetsAt = new Date(Date.now() + 60_000).toISOString();
    scheduler.arm(resetsAt);

    vi.advanceTimersByTime(60_000 + mod.JITTER_MS - 1);
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ resetsAtIso: resetsAt, firedAt: expect.any(Number) }),
    );
  });

  it('fires on process.nextTick when resets_at is already in the past', async () => {
    const scheduler = mod.createAutoFireScheduler();
    const listener = vi.fn();
    scheduler.on('expired', listener);

    const pastIso = new Date(Date.now() - 10_000).toISOString();
    scheduler.arm(pastIso);

    await new Promise((resolve) => process.nextTick(resolve));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].resetsAtIso).toBe(pastIso);
  });

  it('is idempotent when re-armed with the same resets_at while pending', () => {
    const scheduler = mod.createAutoFireScheduler();
    const listener = vi.fn();
    scheduler.on('expired', listener);

    const resetsAt = new Date(Date.now() + 30_000).toISOString();
    scheduler.arm(resetsAt);
    scheduler.arm(resetsAt);
    scheduler.arm(resetsAt);

    vi.advanceTimersByTime(30_000 + mod.JITTER_MS + 50);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cancels the prior timer when re-armed with a later resets_at', () => {
    const scheduler = mod.createAutoFireScheduler();
    const listener = vi.fn();
    scheduler.on('expired', listener);

    const earlyIso = new Date(Date.now() + 30_000).toISOString();
    const lateIso = new Date(Date.now() + 90_000).toISOString();

    scheduler.arm(earlyIso);
    scheduler.arm(lateIso);

    vi.advanceTimersByTime(30_000 + mod.JITTER_MS + 50);
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].resetsAtIso).toBe(lateIso);
  });
});

describe('createAutoFireScheduler.disarm', () => {
  it('produces zero fires after disarm even when time advances past the boundary', () => {
    const scheduler = mod.createAutoFireScheduler();
    const listener = vi.fn();
    scheduler.on('expired', listener);

    const resetsAt = new Date(Date.now() + 30_000).toISOString();
    scheduler.arm(resetsAt);
    scheduler.disarm();

    vi.advanceTimersByTime(30_000 + mod.JITTER_MS + 1_000);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createAutoFireScheduler.getArmedAt', () => {
  it('returns null initially, the armed epoch ms after arm, and null after disarm/fire', () => {
    const scheduler = mod.createAutoFireScheduler();
    expect(scheduler.getArmedAt()).toBeNull();

    const boundary = Date.now() + 30_000;
    const resetsAt = new Date(boundary).toISOString();
    scheduler.arm(resetsAt);
    expect(scheduler.getArmedAt()).toBe(boundary + mod.JITTER_MS);

    scheduler.disarm();
    expect(scheduler.getArmedAt()).toBeNull();

    scheduler.arm(resetsAt);
    expect(scheduler.getArmedAt()).toBe(boundary + mod.JITTER_MS);
    vi.advanceTimersByTime(30_000 + mod.JITTER_MS + 50);
    expect(scheduler.getArmedAt()).toBeNull();
  });
});

describe('createAutoFireScheduler injected timer seam', () => {
  it('uses the injected setTimeout / clearTimeout', () => {
    const fakeTimer = Symbol('timer');
    const setT = vi.fn(() => fakeTimer);
    const clearT = vi.fn();
    const nowFn = vi.fn(() => 1_000_000);

    const scheduler = mod.createAutoFireScheduler({ now: nowFn, setTimeout: setT, clearTimeout: clearT });

    const resetsAt = new Date(1_000_000 + 60_000).toISOString();
    scheduler.arm(resetsAt);
    expect(setT).toHaveBeenCalledTimes(1);
    expect(setT.mock.calls[0][1]).toBe(60_000 + mod.JITTER_MS);

    scheduler.disarm();
    expect(clearT).toHaveBeenCalledTimes(1);
    expect(clearT).toHaveBeenCalledWith(fakeTimer);
  });
});
