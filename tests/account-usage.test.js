import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createAccountUsage } = require('../src/main/account-usage');

describe('independent account polling', () => {
  it('keeps healthy data and saved credentials when another account fails', async () => {
    const accounts = [{ id: 'a' }, { id: 'b' }];
    const service = createAccountUsage({
      getAccounts: () => accounts,
      fetchUsage: async (account) => { if (account.id === 'a') throw new Error('Unauthorized private-secret'); return { five_hour: { utilization: 37 } }; },
      recordHistory: () => {}, now: () => 123,
    });
    const snapshots = await service.refreshAll();
    expect(snapshots.find((row) => row.accountId === 'a')).toMatchObject({ error: { code: 'AUTH_REQUIRED' }, data: null });
    expect(snapshots.find((row) => row.accountId === 'b')).toMatchObject({ data: { five_hour: { utilization: 37 } }, updatedAt: 123 });
    expect(accounts).toHaveLength(2);
    expect(JSON.stringify(snapshots)).not.toContain('private-secret');
  });

  it('publishes a healthy account while another account is still pending', async () => {
    const updates = [];
    let finish;
    const service = createAccountUsage({
      getAccounts: () => [{ id: 'slow' }, { id: 'healthy' }],
      fetchUsage: (account) => account.id === 'slow' ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve({ five_hour: { utilization: 18 } }),
      recordHistory: () => {}, onUpdate: (snapshot) => updates.push(snapshot),
    });
    const all = service.refreshAll();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updates.map((row) => row.accountId)).toEqual(['healthy']);
    finish({});
    await all;
  });

  it('shares an in-flight request and retains last success after a transient error', async () => {
    let complete;
    let requests = 0;
    const service = createAccountUsage({ getAccounts: () => [{ id: 'a' }], fetchUsage: () => { requests++; return new Promise((resolve, reject) => { complete = { resolve, reject }; }); }, recordHistory: () => {}, now: () => 55 });
    const first = service.refreshAccount('a');
    const second = service.refreshAccount('a');
    await Promise.resolve();
    complete.resolve({ seven_day: { utilization: 62 } });
    await Promise.all([first, second]);
    expect(requests).toBe(1);
    const failed = service.refreshAccount('a');
    await Promise.resolve();
    complete.reject(new Error('offline'));
    expect(await failed).toMatchObject({ updatedAt: 55, data: { seven_day: { utilization: 62 } }, error: { code: 'FETCH_FAILED' } });
  });

  it('does not record or cache late results after the account is removed', async () => {
    let resolve;
    let accounts = [{ id: 'a' }];
    const recorded = [];
    const service = createAccountUsage({ getAccounts: () => accounts, fetchUsage: () => new Promise((done) => { resolve = done; }), recordHistory: (...args) => recorded.push(args) });
    const request = service.refreshAccount('a');
    await Promise.resolve();
    accounts = [];
    service.invalidate('a');
    resolve({ five_hour: { utilization: 10 } });
    expect(await request).toBeNull();
    expect(recorded).toHaveLength(0);
    expect(service.snapshots()).toEqual([]);
  });
});
