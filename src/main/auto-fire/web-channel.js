// Web-session auto-fire channel.
//
// Sends a single write request to claude.ai using the user's existing
// sessionKey cookie so the freshly-rolled 5-hour window starts immediately.
//
// IMPORTANT — placeholder endpoint:
// The exact Claude.ai endpoint and JSON shape that count as a billable
// interaction (and therefore start the next 5-hour bucket) are listed as a
// research item in `.planning/ROADMAP.md` (Phase 1). The constants below are
// PLACEHOLDERS — the empty-conversation create call most likely does NOT
// charge against the window, so the dispatcher must remain default-OFF until
// the message-send shape is confirmed. Flipping the user setting on without
// finalising these constants is intentional dead code: the dispatcher gates
// on the feature flag and we want the dead-code path exercised by tests
// before the real payload lands.

'use strict';

const path = require('path');

const AUTO_FIRE_ENDPOINT = (orgId) =>
  `https://claude.ai/api/organizations/${orgId}/chat_conversations`;

const AUTO_FIRE_PAYLOAD = {
  // Smallest plausible "create empty conversation" body; replaced with the
  // real minimal message-send shape once research confirms the endpoint.
  // Reset-window trigger only requires that a billable interaction be charged
  // to the freshly-rolled 5-hour bucket; creating an empty conversation does
  // not count, so this constant is a placeholder until the message-send
  // endpoint is confirmed.
  name: '',
  uuid: null,
};

// Default network helper. Resolved lazily so unit tests can run without
// importing Electron — tests inject a stub `post` instead.
function defaultPost(...args) {
  // eslint-disable-next-line global-require
  const { postViaWindow } = require(path.resolve(__dirname, '..', '..', 'fetch-via-window'));
  return postViaWindow(...args);
}

async function fireViaWebSession({
  sessionKey,
  organizationId,
  post = defaultPost,
  now = Date.now,
} = {}) {
  if (!sessionKey || !organizationId) {
    return { status: 'skipped', reason: 'missing-credentials' };
  }
  const t0 = now();
  try {
    const res = await post(
      AUTO_FIRE_ENDPOINT(organizationId),
      AUTO_FIRE_PAYLOAD,
      { headers: { cookie: 'sessionKey=' + sessionKey } },
    );
    if (res && res.ok) {
      return { status: 'ok', latencyMs: now() - t0 };
    }
    const code = res ? `http-${res.status || 0}` : 'no-response';
    return { status: 'error', reason: 'transport: ' + code, latencyMs: now() - t0 };
  } catch (err) {
    const message = (err && err.message) || String(err);
    if (
      message.startsWith('CloudflareBlocked')
      || message.startsWith('CloudflareChallenge')
      || message.startsWith('UnexpectedHTML')
    ) {
      return { status: 'error', reason: 'session-expired', latencyMs: now() - t0 };
    }
    return { status: 'error', reason: 'transport: ' + message, latencyMs: now() - t0 };
  }
}

module.exports = { fireViaWebSession, AUTO_FIRE_ENDPOINT, AUTO_FIRE_PAYLOAD };
