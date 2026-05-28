import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';

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
  it('normalizes OpenAI organization usage for codex accounts', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(okJson({
        data: [{
          results: [{ input_tokens: 100, output_tokens: 50, num_model_requests: 2 }],
        }],
      }))
      .mockResolvedValueOnce(okJson({
        data: [{
          results: [{ amount: { value: 1.25, currency: 'usd' } }],
        }],
      }));
    const emptyCodexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-empty-test-'));
    const data = await api.fetchUsage({ provider: 'codex', apiKey: 'sk-admin', codexHome: emptyCodexHome });
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('bucket_width=1d'), expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('limit=7'), expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('bucket_width=1d'), expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('limit=7'), expect.any(Object));
    expect(data.provider).toBe('codex');
    expect(data.codex_usage.input_tokens).toBe(100);
    expect(data.codex_usage.output_tokens).toBe(50);
    expect(data.codex_usage.cost).toBe(1.25);
    expect(data.extra_usage.used_cents).toBe(125);
  });

  it('reads Codex local rate-limit logs as used quota by default', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rate-limit-test-'));
    const sessionDir = path.join(tmp, 'sessions', '2026', '05', '27');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'rollout.jsonl'), [
      JSON.stringify({
        timestamp: '2026-05-27T20:40:00.000Z',
        type: 'event_msg',
        payload: {
          rate_limits: {
            limit_id: 'codex',
            plan_type: 'plus',
            primary: { used_percent: 28, window_minutes: 300, resets_at: 1779931952 },
            secondary: { used_percent: 21, window_minutes: 10080, resets_at: 1780283665 },
          },
        },
      }),
      '',
    ].join('\n'));

    const data = await api.fetchUsage({ provider: 'codex', codexHome: tmp });

    expect(data.provider).toBe('codex');
    expect(data.quota_display).toBe('used');
    expect(data.five_hour.utilization).toBe(28);
    expect(data.five_hour.remaining_percent).toBe(72);
    expect(data.five_hour.used_percent).toBe(28);
    expect(data.seven_day.utilization).toBe(21);
    expect(data.codex_usage.plan_type).toBe('plus');
  });

  it('can read Codex local rate-limit logs as remaining quota', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rate-limit-test-'));
    const sessionDir = path.join(tmp, 'sessions', '2026', '05', '27');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'rollout.jsonl'), `${JSON.stringify({
      timestamp: '2026-05-27T20:40:00.000Z',
      type: 'event_msg',
      payload: {
        rate_limits: {
          limit_id: 'codex',
          primary: { used_percent: 28, window_minutes: 300, resets_at: 1779931952 },
          secondary: { used_percent: 21, window_minutes: 10080, resets_at: 1780283665 },
        },
      },
    })}\n`);

    const data = await api.fetchUsage({ provider: 'codex', codexHome: tmp, codexQuotaDisplay: 'remaining' });

    expect(data.quota_display).toBe('remaining');
    expect(data.five_hour.utilization).toBe(72);
    expect(data.seven_day.utilization).toBe(79);
  });

  it('maps recent premium exhaustion to the Codex five-hour quota only', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-rate-limit-test-'));
    const sessionDir = path.join(tmp, 'sessions', '2026', '05', '28');
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'rollout.jsonl'), [
      JSON.stringify({
        timestamp: '2026-05-28T18:30:17.000Z',
        type: 'event_msg',
        payload: {
          rate_limits: {
            limit_id: 'premium',
            primary: null,
            secondary: null,
            credits: { has_credits: false, unlimited: false, balance: '0' },
          },
        },
      }),
      JSON.stringify({
        timestamp: '2026-05-28T18:30:33.000Z',
        type: 'event_msg',
        payload: {
          rate_limits: {
            limit_id: 'codex',
            plan_type: 'plus',
            primary: { used_percent: 3, window_minutes: 300, resets_at: 1780011033 },
            secondary: { used_percent: 47, window_minutes: 10080, resets_at: 1780283665 },
          },
        },
      }),
      '',
    ].join('\n'));

    const used = await api.fetchUsage({ provider: 'codex', codexHome: tmp });
    const remaining = await api.fetchUsage({ provider: 'codex', codexHome: tmp, codexQuotaDisplay: 'remaining' });

    expect(used.quota_display).toBe('used');
    expect(used.five_hour.utilization).toBe(100);
    expect(used.five_hour.used_percent).toBe(100);
    expect(used.five_hour.remaining_percent).toBe(0);
    expect(used.five_hour.premium_exhausted).toBe(true);
    expect(used.seven_day.utilization).toBe(47);
    expect(used.seven_day.remaining_percent).toBe(53);
    expect(used.codex_usage.premium_exhausted).toBe(true);

    expect(remaining.quota_display).toBe('remaining');
    expect(remaining.five_hour.utilization).toBe(0);
    expect(remaining.five_hour.used_percent).toBe(100);
    expect(remaining.five_hour.remaining_percent).toBe(0);
    expect(remaining.seven_day.utilization).toBe(53);
    expect(remaining.seven_day.used_percent).toBe(47);
  });
});
