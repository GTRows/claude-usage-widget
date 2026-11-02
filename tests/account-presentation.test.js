import { describe, it, expect } from 'vitest';
import { accountProviderLabel, quotaText } from '../src/renderer/account-presentation.js';

describe('account presentation', () => {
  it('distinguishes API billing from a Codex subscription', () => {
    expect(accountProviderLabel({ provider: 'codex', authType: 'local' })).toBe('Codex');
    expect(accountProviderLabel({ provider: 'codex', hasApiKey: true })).toBe('OpenAI API');
  });
  it('shows unknown limits as unknown instead of unused', () => {
    expect(quotaText(undefined)).toBe('—');
    expect(quotaText({ utilization: 0 })).toBe('0%');
    expect(quotaText({ utilization: 36.7 })).toBe('37%');
  });
});
