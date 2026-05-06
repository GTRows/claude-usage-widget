// Auto-fire scheduler: emits a single 'expired' event when the active
// 5-hour window's resets_at boundary passes. Owns one armed timestamp at
// a time. Re-arming with the same epoch ms is a no-op so the usage poll
// can call arm() on every refresh without stacking timers (arm-before-fire,
// idempotent re-arm). Pure Node — no Electron imports — so unit tests run
// without an Electron runtime.

'use strict';

const { EventEmitter } = require('events');

const MIN_DELAY_MS = 5_000;
const JITTER_MS = 2_000;
const SAME_EPOCH_TOLERANCE_MS = 1_000;

function createAutoFireScheduler({
  now = Date.now,
  setTimeout: setT = setTimeout,
  clearTimeout: clearT = clearTimeout,
} = {}) {
  const emitter = new EventEmitter();
  let timer = null;
  let armedAt = null;
  let armedIso = null;

  function fire(resetsAtIso) {
    timer = null;
    armedAt = null;
    armedIso = null;
    emitter.emit('expired', { resetsAtIso, firedAt: now() });
  }

  function arm(resetsAtIso) {
    const boundary = Date.parse(resetsAtIso);
    if (!Number.isFinite(boundary)) return;
    const target = boundary + JITTER_MS;
    if (armedAt !== null && Math.abs(target - armedAt) <= SAME_EPOCH_TOLERANCE_MS) {
      return;
    }
    if (timer !== null) {
      clearT(timer);
      timer = null;
    }
    armedAt = target;
    armedIso = resetsAtIso;
    const delay = target - now();
    if (delay <= MIN_DELAY_MS) {
      const isoForFire = resetsAtIso;
      process.nextTick(() => {
        if (armedIso !== isoForFire) return;
        fire(isoForFire);
      });
      return;
    }
    timer = setT(() => {
      fire(resetsAtIso);
    }, delay);
  }

  function disarm() {
    if (timer !== null) {
      clearT(timer);
      timer = null;
    }
    armedAt = null;
    armedIso = null;
  }

  function getArmedAt() {
    return armedAt;
  }

  function on(event, listener) {
    emitter.on(event, listener);
  }

  function off(event, listener) {
    emitter.off(event, listener);
  }

  return { arm, disarm, getArmedAt, on, off };
}

module.exports = { createAutoFireScheduler, MIN_DELAY_MS, JITTER_MS };
