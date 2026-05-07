// Auto-fire dispatcher.
//
// Listens to the scheduler's `'expired'` event and routes it through:
//   1. settings gate   (autoFireEnabled must be true)
//   2. single-flight   (drop concurrent triggers while one is in flight)
//   3. debounce window (ignore events that arrive within DEBOUNCE_MS of the
//                       last fire — protects against scheduler re-entry on
//                       slow networks)
//   4. credential load (skip if no sessionKey / organizationId)
//   5. channel routing (settings.autoFireChannel selects which fn to call)
//
// State is held in a closure so each dispatcher instance is isolated, which
// keeps unit tests independent and avoids any module-level mutation.

'use strict';

const DEBOUNCE_MS = 60_000;

function createAutoFireDispatcher({
  scheduler,
  getSettings,
  getCredentials,
  channels,
  now = Date.now,
  debugLog = () => {},
} = {}) {
  const state = {
    inFlight: false,
    lastTriggerAt: null,
    lastFiredAt: null,
    lastResult: null,
    successCount: 0,
    errorCount: 0,
  };

  let listener = null;

  async function handle(payload) {
    const settings = getSettings();
    if (!settings || settings.autoFireEnabled !== true) {
      debugLog('[AutoFire] disabled — skipping');
      return;
    }
    if (state.inFlight) {
      debugLog('[AutoFire] already firing — skipping');
      return;
    }
    if (state.lastFiredAt !== null && now() - state.lastFiredAt < DEBOUNCE_MS) {
      debugLog('[AutoFire] debounce window active — skipping');
      return;
    }

    state.inFlight = true;
    state.lastTriggerAt = now();

    try {
      const creds = await getCredentials();
      if (!creds) {
        const result = { status: 'error', reason: 'missing-credentials' };
        state.lastResult = result;
        state.lastFiredAt = now();
        state.errorCount += 1;
        debugLog('[AutoFire] result', result);
        return;
      }

      const channelName = (settings && settings.autoFireChannel) || 'webSession';
      const channel = channels && channels[channelName];
      if (typeof channel !== 'function') {
        const result = { status: 'error', reason: 'unknown-channel' };
        state.lastResult = result;
        state.lastFiredAt = now();
        state.errorCount += 1;
        debugLog('[AutoFire] result', result);
        return;
      }

      const result = await channel({
        sessionKey: creds.sessionKey,
        organizationId: creds.organizationId,
        apiKey: creds.apiKey,
      });
      state.lastResult = result;
      state.lastFiredAt = now();
      if (result && result.status === 'ok') {
        state.successCount += 1;
      } else {
        state.errorCount += 1;
      }
      debugLog('[AutoFire] result', result, 'channel', channelName, 'trigger', payload);
    } finally {
      state.inFlight = false;
    }
  }

  function start() {
    if (listener !== null) return;
    listener = (payload) => { handle(payload); };
    scheduler.on('expired', listener);
  }

  function stop() {
    if (listener !== null) {
      scheduler.off('expired', listener);
      listener = null;
    }
    if (typeof scheduler.disarm === 'function') {
      scheduler.disarm();
    }
  }

  function getStats() {
    return {
      inFlight: state.inFlight,
      lastTriggerAt: state.lastTriggerAt,
      lastFiredAt: state.lastFiredAt,
      lastResult: state.lastResult,
      successCount: state.successCount,
      errorCount: state.errorCount,
    };
  }

  return { start, stop, getStats };
}

module.exports = { createAutoFireDispatcher, DEBOUNCE_MS };
