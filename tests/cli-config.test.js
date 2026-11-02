import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const configPath = path.join(process.cwd(), 'src/cli/config.js');

let configMod;
let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-usage-cli-test-'));
  process.env.CLAUDE_USAGE_CONFIG_DIR = tmp;
  delete process.env.CLAUDE_SESSION_KEY;
  delete process.env.CLAUDE_ORGANIZATION_ID;
  delete process.env.CLAUDE_USAGE_PROVIDER;
  delete process.env.USAGE_PROVIDER;
  delete process.env.OPENAI_ADMIN_KEY;
  delete process.env.OPENAI_API_KEY;
  delete require.cache[require.resolve(configPath)];
  configMod = require(configPath);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.CLAUDE_USAGE_CONFIG_DIR;
  delete process.env.CLAUDE_USAGE_PROVIDER;
  delete process.env.USAGE_PROVIDER;
  delete process.env.OPENAI_ADMIN_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe('config dir + path', () => {
  it('uses the override env var', () => {
    expect(configMod.getConfigDir()).toBe(tmp);
    expect(configMod.getConfigPath().startsWith(tmp)).toBe(true);
  });
});

describe('readConfig / writeConfig', () => {
  it('returns an empty object when file is missing', () => {
    expect(configMod.readConfig()).toEqual({});
  });
  it('writes and reads back a partial patch', () => {
    configMod.writeConfig({ sessionKey: 'sk', organizationId: 'org' });
    expect(configMod.readConfig()).toEqual({ sessionKey: 'sk', organizationId: 'org' });
  });
  it('merges patches without dropping existing keys', () => {
    configMod.writeConfig({ sessionKey: 'sk' });
    configMod.writeConfig({ organizationId: 'org' });
    expect(configMod.readConfig()).toEqual({ sessionKey: 'sk', organizationId: 'org' });
  });
});

describe('loadCredentials', () => {
  it('prefers env vars when both are set', () => {
    process.env.CLAUDE_SESSION_KEY = 'env-sk';
    process.env.CLAUDE_ORGANIZATION_ID = 'env-org';
    configMod.writeConfig({ sessionKey: 'file-sk', organizationId: 'file-org' });
    expect(configMod.loadCredentials()).toMatchObject({
      provider: 'claude',
      sessionKey: 'env-sk',
      organizationId: 'env-org',
    });
  });
  it('falls back to the file when env is missing', () => {
    configMod.writeConfig({ sessionKey: 'file-sk', organizationId: 'file-org' });
    expect(configMod.loadCredentials()).toMatchObject({
      provider: 'claude',
      sessionKey: 'file-sk',
      organizationId: 'file-org',
    });
  });
  it('returns null fields when nothing is configured', () => {
    expect(configMod.loadCredentials()).toMatchObject({
      provider: 'claude',
      sessionKey: null,
      organizationId: null,
    });
  });
  it('loads the active account from the account list', () => {
    configMod.writeConfig({
      activeAccountId: 'codex-main',
      accounts: [
        { id: 'claude-main', provider: 'claude', sessionKey: 'sk', organizationId: 'org' },
        { id: 'codex-main', provider: 'codex', apiKey: 'openai-key' },
      ],
    });
    expect(configMod.loadCredentials()).toMatchObject({
      id: 'codex-main',
      provider: 'codex',
      apiKey: 'openai-key',
    });
  });
  it('uses an OpenAI admin key as a Codex account when no provider is specified', () => {
    process.env.OPENAI_ADMIN_KEY = 'admin-key';
    expect(configMod.loadCredentials()).toMatchObject({
      provider: 'codex',
      apiKey: 'admin-key',
    });
    delete process.env.OPENAI_ADMIN_KEY;
  });
  it('allows explicit Codex provider without an API key for local rate-limit logs', () => {
    expect(configMod.loadCredentials('codex')).toMatchObject({
      provider: 'codex',
      apiKey: null,
    });
  });
  it('uses a configured Codex account when the provider override asks for Codex', () => {
    configMod.writeConfig({
      activeAccountId: 'claude-main',
      accounts: [
        { id: 'claude-main', provider: 'claude', sessionKey: 'sk', organizationId: 'org' },
        { id: 'codex-main', provider: 'codex', apiKey: 'openai-key' },
      ],
    });
    expect(configMod.loadCredentials('codex')).toMatchObject({
      id: 'codex-main',
      provider: 'codex',
      apiKey: 'openai-key',
    });
  });
});
