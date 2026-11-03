import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  getActiveAccount,
  hasUsableCredentials,
  legacyClaudeAccount,
  normalizeAccount,
  normalizeAccounts,
  normalizeProvider,
} = require('../src/shared/accounts.js');

describe('account normalization', () => {
  it('falls back to claude for unknown providers', () => {
    expect(normalizeProvider('unknown')).toBe('claude');
    expect(normalizeAccount({ provider: 'unknown' }).provider).toBe('claude');
  });

  it('keeps distinct claude and codex account credential shapes', () => {
    const claude = normalizeAccount({ id: 'c1', provider: 'claude', sessionKey: 'sk', organizationId: 'org' });
    const codex = normalizeAccount({ id: 'o1', provider: 'codex' });

    expect(hasUsableCredentials(claude)).toBe(true);
    expect(hasUsableCredentials(codex)).toBe(true);
  });

  it('creates a default account from legacy claude credentials', () => {
    expect(legacyClaudeAccount({ sessionKey: 'sk', organizationId: 'org' })).toMatchObject({
      id: 'default',
      provider: 'claude',
      sessionKey: 'sk',
      organizationId: 'org',
    });
  });

  it('selects the requested active account with a first-account fallback', () => {
    const accounts = normalizeAccounts([
      { id: 'claude-main', provider: 'claude' },
      { id: 'codex-main', provider: 'codex' },
    ]);

    expect(getActiveAccount(accounts, 'codex-main').id).toBe('codex-main');
    expect(getActiveAccount(accounts, 'missing').id).toBe('claude-main');
  });
});
