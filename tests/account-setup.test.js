import { describe, it, expect } from 'vitest';
import { createAccountSetup } from '../src/renderer/account-setup.js';

function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }

describe('account setup transitions', () => {
  it('does not save or select a profile after cancellation during validation', async () => {
    const pending = deferred(); const saved = []; const shown = [];
    const flow = createAccountSetup();
    const work = flow.run({ prepare: () => pending.promise, commit: (account) => { saved.push(account); return account; }, apply: (account) => shown.push(account) });
    expect(flow.cancel()).toBe(true);
    pending.resolve({ id: 'canceled' });
    await work;
    expect(saved).toEqual([]);
    expect(shown).toEqual([]);
  });
  it('ignores an earlier profile validation when a newer connection wins', async () => {
    const first = deferred(); const saved = [];
    const flow = createAccountSetup();
    const stale = flow.run({ prepare: () => first.promise, commit: (account) => saved.push(account), apply: () => {} });
    await flow.run({ prepare: async () => 'new', commit: (account) => saved.push(account), apply: () => {} });
    first.resolve('old'); await stale;
    expect(saved).toEqual(['new']);
  });
  it('makes a save non-cancelable once the atomic commit has started', async () => {
    const pending = deferred(); const busy = [];
    const flow = createAccountSetup({ onBusy: (value) => busy.push(value) });
    const work = flow.run({ prepare: async () => 'profile', commit: () => pending.promise, apply: () => {} });
    await Promise.resolve();
    expect(flow.cancel()).toBe(false);
    pending.resolve('saved'); await work;
    expect(busy).toEqual([true, false]);
  });
});
