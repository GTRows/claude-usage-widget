// Anthropic API-key auto-fire channel.
//
// Sibling of `web-channel.js`: where the web-session path drives a billable
// interaction through the user's claude.ai cookie, this path drives one
// through Anthropic's Messages API using a stored API key. The two channels
// deliberately do not share a generic helper — they have different auth
// headers and different error-classification rules, so factoring them now
// would be premature.
//
// The model id and payload constants are intentionally pinned: a deterministic
// auto-fire trigger needs the smallest billable shape, and a named snapshot
// avoids surprise behaviour shifts. Bump them when Anthropic deprecates the
// snapshot.

'use strict';

const ANTHROPIC_MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const AUTO_FIRE_API_MODEL = 'claude-haiku-4-5-20251001';
const AUTO_FIRE_API_PAYLOAD = {
  model: AUTO_FIRE_API_MODEL,
  max_tokens: 1,
  messages: [{ role: 'user', content: '.' }],
};

async function fireViaApiKey({
  apiKey,
  fetch: fetchImpl,
  now = Date.now,
} = {}) {
  if (!apiKey) {
    return { status: 'skipped', reason: 'missing-credentials' };
  }
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) {
    return { status: 'error', reason: 'transport: no-fetch', latencyMs: 0 };
  }
  const t0 = now();
  let signal;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    signal = AbortSignal.timeout(30000);
  }
  try {
    const init = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(AUTO_FIRE_API_PAYLOAD),
    };
    if (signal) init.signal = signal;
    const res = await f(ANTHROPIC_MESSAGES_ENDPOINT, init);
    if (res && res.ok) {
      return { status: 'ok', latencyMs: now() - t0 };
    }
    const status = res ? res.status : 0;
    if (status === 401 || status === 403) {
      return { status: 'error', reason: 'auth-failed', latencyMs: now() - t0 };
    }
    if (status === 429) {
      return { status: 'error', reason: 'rate-limited', latencyMs: now() - t0 };
    }
    return { status: 'error', reason: 'transport: http-' + status, latencyMs: now() - t0 };
  } catch (err) {
    const message = (err && err.message) || String(err);
    return { status: 'error', reason: 'transport: ' + message, latencyMs: now() - t0 };
  }
}

module.exports = {
  fireViaApiKey,
  ANTHROPIC_MESSAGES_ENDPOINT,
  ANTHROPIC_API_VERSION,
  AUTO_FIRE_API_MODEL,
  AUTO_FIRE_API_PAYLOAD,
};
