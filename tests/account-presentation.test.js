import { describe, it, expect } from 'vitest';
import { accountProviderLabel, quotaText, isApiUsage } from '../src/renderer/account-presentation.js';

describe('account presentation', () => {
  it('distinguishes local session metadata from API billing metrics', () => {
    expect(isApiUsage({ codex_usage: { plan_type: 'plus' } })).toBe(false);
    expect(isApiUsage({ codex_usage: { num_model_requests: 0, cost: 0 } })).toBe(true);
  });
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
