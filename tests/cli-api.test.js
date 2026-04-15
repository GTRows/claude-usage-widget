import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const apiPath = path.join(process.cwd(), 'src/cli/api.js');

let api;
let originalFetch;

beforeEach(() => {
  delete require.cache[require.resolve(apiPath)];
  api = require(apiPath);
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const okJson = (body) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
});
const fail = (status, body) => ({
  ok: false,
  status,
  text: async () => body,
});

describe('fetchJSON error mapping', () => {
  it('maps 401 to SESSION_EXPIRED', async () => {
    global.fetch = vi.fn().mockResolvedValue(fail(401, 'nope'));
    await expect(api.fetchJSON('https://x', 'sk')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });
  it('maps HTML body to CLOUDFLARE', async () => {
    global.fetch = vi.fn().mockResolvedValue(fail(503, '<html>blocked</html>'));
    await expect(api.fetchJSON('https://x', 'sk')).rejects.toMatchObject({ code: 'CLOUDFLARE' });
  });
  it('maps unparseable success body to CLOUDFLARE', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'not json' });
    await expect(api.fetchJSON('https://x', 'sk')).rejects.toMatchObject({ code: 'CLOUDFLARE' });
  });
  it('returns parsed json on success', async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson({ a: 1 }));
    await expect(api.fetchJSON('https://x', 'sk')).resolves.toEqual({ a: 1 });
  });
  it('sends sessionKey cookie + UA header', async () => {
    const spy = vi.fn().mockResolvedValue(okJson({}));
    global.fetch = spy;
    await api.fetchJSON('https://x', 'my-sk');
    const headers = spy.mock.calls[0][1].headers;
    expect(headers.cookie).toBe('sessionKey=my-sk');
    expect(headers['user-agent']).toMatch(/claude-usage-cli/);
  });
});

describe('fetchUsage', () => {
  it('throws when credentials are missing', async () => {
    await expect(api.fetchUsage({ sessionKey: '', organizationId: 'o' })).rejects.toThrow(/Missing credentials/);
  });
  it('merges overage data into extra_usage', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(okJson({ five_hour: { utilization: 10 } }))
      .mockResolvedValueOnce(okJson({ is_enabled: true, monthly_credit_limit: 1000, used_credits: 250, currency: 'USD' }))
      .mockResolvedValueOnce(okJson({ amount: 500, currency: 'USD' }));
    const data = await api.fetchUsage({ sessionKey: 'sk', organizationId: 'org' });
    expect(data.extra_usage.utilization).toBe(25);
    expect(data.extra_usage.balance_cents).toBe(500);
    expect(data.extra_usage.currency).toBe('USD');
  });
  it('still returns usage when overage and prepaid both fail', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(okJson({ five_hour: { utilization: 5 } }))
      .mockResolvedValueOnce(fail(404, 'no overage'))
      .mockResolvedValueOnce(fail(404, 'no prepaid'));
    const data = await api.fetchUsage({ sessionKey: 'sk', organizationId: 'org' });
    expect(data.five_hour.utilization).toBe(5);
    expect(data.extra_usage).toBeUndefined();
  });
});
