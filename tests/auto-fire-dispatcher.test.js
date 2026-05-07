import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const DISPATCHER_PATH = '../src/main/auto-fire/dispatcher';

let mod;

function makeFakeScheduler() {
  const handlers = new Map();
  return {
    on: vi.fn((event, fn) => { handlers.set(event, fn); }),
    off: vi.fn((event, fn) => {
      if (handlers.get(event) === fn) handlers.delete(event);
    }),
    disarm: vi.fn(),
    emit(event, payload) {
      const fn = handlers.get(event);
      if (fn) fn(payload);
    },
    has(event) {
      return handlers.has(event);
    },
  };
}

function flush() {
  // Drain pending microtasks created by the async handler.
  return Promise.resolve().then(() => Promise.resolve()).then(() => Promise.resolve());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  delete require.cache[require.resolve(DISPATCHER_PATH)];
  mod = require(DISPATCHER_PATH);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createAutoFireDispatcher', () => {
  it('skips when autoFireEnabled is not true', async () => {
    const scheduler = makeFakeScheduler();
    const channel = vi.fn();
    const dispatcher = mod.createAutoFireDispatcher({
      scheduler,
      getSettings: () => ({ autoFireEnabled: false, autoFireChannel: 'webSession' }),
      getCredentials: async () => ({ sessionKey: 'sk', organizationId: 'org' }),
      channels: { webSession: channel },
    });
    dispatcher.start();
    scheduler.emit('expired', { resetsAtIso: 'x', firedAt: 1 });
    await flush();
    expect(channel).not.toHaveBeenCalled();
    const stats = dispatcher.getStats();
    expect(stats.successCount).toBe(0);
    expect(stats.errorCount).toBe(0);
  });

  it('routes to webSession channel and records ok result', async () => {
    const scheduler = makeFakeScheduler();
    const channel = vi.fn().mockResolvedValue({ status: 'ok', latencyMs: 5 });
    const dispatcher = mod.createAutoFireDispatcher({
      scheduler,
      getSettings: () => ({ autoFireEnabled: true, autoFireChannel: 'webSession' }),
      getCredentials: async () => ({ sessionKey: 'sk', organizationId: 'org' }),
      channels: { webSession: channel },
    });
    dispatcher.start();
    scheduler.emit('expired', { resetsAtIso: 'x', firedAt: 1 });
    await flush();
    expect(channel).toHaveBeenCalledTimes(1);
    expect(channel).toHaveBeenCalledWith(
      expect.objectContaining({ sessionKey: 'sk', organizationId: 'org' }),
    );
    const stats = dispatcher.getStats();
    expect(stats.successCount).toBe(1);
    expect(stats.errorCount).toBe(0);
    expect(stats.lastResult).toEqual({ status: 'ok', latencyMs: 5 });
  });

  it('drops re-entrant events while a previous fire is still in flight', async () => {
    const scheduler = makeFakeScheduler();
    let resolveChannel;
    const channel = vi.fn(
      () => new Promise((resolve) => { resolveChannel = resolve; }),
    );
    const dispatcher = mod.createAutoFireDispatcher({
      scheduler,
      getSettings: () => ({ autoFireEnabled: true, autoFireChannel: 'webSession' }),
      getCredentials: async () => ({ sessionKey: 'sk', organizationId: 'org' }),
      channels: { webSession: channel },
    });
    dispatcher.start();
    scheduler.emit('expired', { resetsAtIso: 'a', firedAt: 1 });
    await flush();
    // Second event arrives while first is still pending.
    scheduler.emit('expired', { resetsAtIso: 'b', firedAt: 2 });
    await flush();
    expect(channel).toHaveBeenCalledTimes(1);
    resolveChannel({ status: 'ok', latencyMs: 1 });
    await flush();
    expect(channel).toHaveBeenCalledTimes(1);
  });

  it('debounces a second event within DEBOUNCE_MS of the previous fire', async () => {
    const scheduler = makeFakeScheduler();
    const channel = vi.fn().mockResolvedValue({ status: 'ok', latencyMs: 1 });
    const dispatcher = mod.createAutoFireDispatcher({
      scheduler,
      getSettings: () => ({ autoFireEnabled: true, autoFireChannel: 'webSession' }),
      getCredentials: async () => ({ sessionKey: 'sk', organizationId: 'org' }),
      channels: { webSession: channel },
    });
    dispatcher.start();
    scheduler.emit('expired', { resetsAtIso: 'a', firedAt: 1 });
    await flush();
    expect(channel).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.now() + 30_000));
    scheduler.emit('expired', { resetsAtIso: 'b', firedAt: 2 });
    await flush();
    expect(channel).toHaveBeenCalledTimes(1);
  });

  it('fires a second event when more than DEBOUNCE_MS has elapsed', async () => {
    const scheduler = makeFakeScheduler();
    const channel = vi.fn().mockResolvedValue({ status: 'ok', latencyMs: 1 });
    const dispatcher = mod.createAutoFireDispatcher({
      scheduler,
      getSettings: () => ({ autoFireEnabled: true, autoFireChannel: 'webSession' }),
      getCredentials: async () => ({ sessionKey: 'sk', organizationId: 'org' }),
      channels: { webSession: channel },
    });
    dispatcher.start();
    scheduler.emit('expired', { resetsAtIso: 'a', firedAt: 1 });
    await flush();
    expect(channel).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.now() + 90_000));
    scheduler.emit('expired', { resetsAtIso: 'b', firedAt: 2 });
    await flush();
    expect(channel).toHaveBeenCalledTimes(2);
  });

  it('records missing-credentials error without calling the channel', async () => {
    const scheduler = makeFakeScheduler();
    const channel = vi.fn();
    const dispatcher = mod.createAutoFireDispatcher({
      scheduler,
      getSettings: () => ({ autoFireEnabled: true, autoFireChannel: 'webSession' }),
      getCredentials: async () => null,
      channels: { webSession: channel },
    });
    dispatcher.start();
    scheduler.emit('expired', { resetsAtIso: 'a', firedAt: 1 });
    await flush();
    expect(channel).not.toHaveBeenCalled();
    const stats = dispatcher.getStats();
    expect(stats.errorCount).toBe(1);
    expect(stats.lastResult.reason).toBe('missing-credentials');
  });

  it('records unknown-channel error when settings.autoFireChannel is unmapped', async () => {
    const scheduler = makeFakeScheduler();
    const channel = vi.fn();
    const dispatcher = mod.createAutoFireDispatcher({
      scheduler,
      getSettings: () => ({ autoFireEnabled: true, autoFireChannel: 'apiKey' }),
      getCredentials: async () => ({ sessionKey: 'sk', organizationId: 'org' }),
      channels: { webSession: channel },
    });
    dispatcher.start();
    scheduler.emit('expired', { resetsAtIso: 'a', firedAt: 1 });
    await flush();
    expect(channel).not.toHaveBeenCalled();
    const stats = dispatcher.getStats();
    expect(stats.errorCount).toBe(1);
    expect(stats.lastResult.reason).toBe('unknown-channel');
  });

  it("routes to the apiKey channel when settings.autoFireChannel === 'apiKey'", async () => {
    const scheduler = makeFakeScheduler();
    const webSessionChannel = vi.fn();
    const apiKeyChannel = vi.fn().mockResolvedValue({ status: 'ok', latencyMs: 12 });
    const dispatcher = mod.createAutoFireDispatcher({
      scheduler,
      getSettings: () => ({ autoFireEnabled: true, autoFireChannel: 'apiKey' }),
      getCredentials: async () => ({ apiKey: 'sk-ant-test' }),
      channels: { webSession: webSessionChannel, apiKey: apiKeyChannel },
    });
    dispatcher.start();
    scheduler.emit('expired', { resetsAtIso: 'a', firedAt: 1 });
    await flush();
    expect(apiKeyChannel).toHaveBeenCalledTimes(1);
    expect(apiKeyChannel).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-ant-test' }),
    );
    expect(webSessionChannel).not.toHaveBeenCalled();
    expect(dispatcher.getStats().lastResult.status).toBe('ok');
  });

  it('stop() removes the listener registered with the scheduler', async () => {
    const scheduler = makeFakeScheduler();
    const channel = vi.fn().mockResolvedValue({ status: 'ok', latencyMs: 1 });
    const dispatcher = mod.createAutoFireDispatcher({
      scheduler,
      getSettings: () => ({ autoFireEnabled: true, autoFireChannel: 'webSession' }),
      getCredentials: async () => ({ sessionKey: 'sk', organizationId: 'org' }),
      channels: { webSession: channel },
    });
    dispatcher.start();
    expect(scheduler.has('expired')).toBe(true);
    const registeredFn = scheduler.on.mock.calls[0][1];
    dispatcher.stop();
    expect(scheduler.off).toHaveBeenCalledWith('expired', registeredFn);
    expect(scheduler.has('expired')).toBe(false);
  });
});
