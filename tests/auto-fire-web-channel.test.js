import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CHANNEL_PATH = '../src/main/auto-fire/web-channel';

let mod;

beforeEach(() => {
  delete require.cache[require.resolve(CHANNEL_PATH)];
  mod = require(CHANNEL_PATH);
});

describe('fireViaWebSession', () => {
  it('returns skipped when sessionKey or organizationId missing', async () => {
    const post = vi.fn();
    expect(await mod.fireViaWebSession({ sessionKey: '', organizationId: 'o', post }))
      .toEqual({ status: 'skipped', reason: 'missing-credentials' });
    expect(await mod.fireViaWebSession({ sessionKey: 'k', organizationId: '', post }))
      .toEqual({ status: 'skipped', reason: 'missing-credentials' });
    expect(await mod.fireViaWebSession({ post })).toEqual({
      status: 'skipped',
      reason: 'missing-credentials',
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('returns ok with latencyMs on a 2xx response from the injected post', async () => {
    const post = vi.fn().mockResolvedValue({ ok: true, status: 201, text: '{}' });
    let t = 1_000;
    const now = () => {
      const v = t;
      t += 17;
      return v;
    };
    const result = await mod.fireViaWebSession({
      sessionKey: 'sk',
      organizationId: 'org-1',
      post,
      now,
    });
    expect(result.status).toBe('ok');
    expect(result.latencyMs).toBe(17);
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, opts] = post.mock.calls[0];
    expect(url).toContain('org-1');
    expect(body).toEqual(mod.AUTO_FIRE_PAYLOAD);
    expect(opts.headers.cookie).toBe('sessionKey=sk');
  });

  it("returns error reason 'session-expired' when post rejects with CloudflareBlocked", async () => {
    const post = vi.fn().mockRejectedValue(new Error('CloudflareBlocked: Just a moment'));
    const result = await mod.fireViaWebSession({
      sessionKey: 'sk',
      organizationId: 'org',
      post,
    });
    expect(result.status).toBe('error');
    expect(result.reason).toBe('session-expired');
    expect(typeof result.latencyMs).toBe('number');
  });

  it("returns error reason starting 'transport:' on generic rejection", async () => {
    const post = vi.fn().mockRejectedValue(new Error('ECONNRESET socket hang up'));
    const result = await mod.fireViaWebSession({
      sessionKey: 'sk',
      organizationId: 'org',
      post,
    });
    expect(result.status).toBe('error');
    expect(result.reason.startsWith('transport:')).toBe(true);
    expect(result.reason).toContain('ECONNRESET');
  });

  it('passes the URL containing organizationId and a sessionKey cookie header to post', async () => {
    const post = vi.fn().mockResolvedValue({ ok: true, status: 200, text: '' });
    await mod.fireViaWebSession({ sessionKey: 'abc123', organizationId: 'orgX', post });
    const [url, , opts] = post.mock.calls[0];
    expect(url).toBe(mod.AUTO_FIRE_ENDPOINT('orgX'));
    expect(url).toContain('orgX');
    expect(opts.headers.cookie).toContain('sessionKey=abc123');
  });
});
