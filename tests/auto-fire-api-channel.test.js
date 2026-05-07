import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CHANNEL_PATH = '../src/main/auto-fire/api-channel';

let mod;

const okRes = (status = 200, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

beforeEach(() => {
  delete require.cache[require.resolve(CHANNEL_PATH)];
  mod = require(CHANNEL_PATH);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fireViaApiKey', () => {
  it('returns skipped when apiKey is missing', async () => {
    const fetchImpl = vi.fn();
    expect(await mod.fireViaApiKey({ fetch: fetchImpl })).toEqual({
      status: 'skipped',
      reason: 'missing-credentials',
    });
    expect(await mod.fireViaApiKey({ apiKey: '', fetch: fetchImpl })).toEqual({
      status: 'skipped',
      reason: 'missing-credentials',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns ok with latencyMs on a 200 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okRes(200, { id: 'msg_1' }));
    const now = vi.fn();
    now.mockReturnValueOnce(1000).mockReturnValueOnce(1042);
    const result = await mod.fireViaApiKey({
      apiKey: 'sk-ant-test',
      fetch: fetchImpl,
      now,
    });
    expect(result.status).toBe('ok');
    expect(result.latencyMs).toBe(42);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('calls fetch with correct URL, headers, and payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okRes(200));
    await mod.fireViaApiKey({ apiKey: 'sk-ant-test', fetch: fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(mod.ANTHROPIC_MESSAGES_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-key']).toBe('sk-ant-test');
    expect(init.headers['anthropic-version']).toBe(mod.ANTHROPIC_API_VERSION);
    expect(init.headers['content-type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
    expect(body.max_tokens).toBe(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('returns auth-failed on a 401 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okRes(401, { error: 'unauthorized' }));
    const now = vi.fn();
    now.mockReturnValueOnce(1000).mockReturnValueOnce(1010);
    const result = await mod.fireViaApiKey({
      apiKey: 'sk-ant-bad',
      fetch: fetchImpl,
      now,
    });
    expect(result.status).toBe('error');
    expect(result.reason).toBe('auth-failed');
    expect(result.latencyMs).toBe(10);
  });

  it('returns auth-failed on a 403 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okRes(403, { error: 'forbidden' }));
    const result = await mod.fireViaApiKey({
      apiKey: 'sk-ant-bad',
      fetch: fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.reason).toBe('auth-failed');
  });

  it('returns rate-limited on a 429 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okRes(429, { error: 'too many' }));
    const result = await mod.fireViaApiKey({
      apiKey: 'sk-ant-test',
      fetch: fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.reason).toBe('rate-limited');
  });

  it("returns transport: http-500 on a 500 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okRes(500, { error: 'server' }));
    const result = await mod.fireViaApiKey({
      apiKey: 'sk-ant-test',
      fetch: fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.reason).toBe('transport: http-500');
  });

  it("returns transport: ... when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await mod.fireViaApiKey({
      apiKey: 'sk-ant-test',
      fetch: fetchImpl,
    });
    expect(result.status).toBe('error');
    expect(result.reason.startsWith('transport:')).toBe(true);
    expect(result.reason).toContain('ECONNRESET');
  });

  it("returns transport: no-fetch when no fetch is available", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = undefined;
    try {
      const result = await mod.fireViaApiKey({
        apiKey: 'sk-ant-test',
        fetch: null,
      });
      expect(result.status).toBe('error');
      expect(result.reason).toBe('transport: no-fetch');
    } finally {
      globalThis.fetch = original;
    }
  });
});
