import { describe, it, expect, vi } from 'vitest';
import { createUpdatePanel, presentUpdate } from '../src/renderer/update-panel.js';
const t = (key, values = {}) => `${key} ${JSON.stringify(values)}`;
describe('update presentation', () => {
  it('offers install only after verification and displays clamped download progress', () => {
    expect(presentUpdate({ supported: true, status: 'available', version: '2.0.0' }, t).action).toBe('download');
    expect(presentUpdate({ supported: true, status: 'downloading', version: '2.0.0', percent: 36 }, t)).toMatchObject({ action: null, progress: 36 });
    expect(presentUpdate({ supported: true, status: 'downloaded', version: '2.0.0' }, t).action).toBe('install');
  });
  it('reports a successful manual check with no newer version as up to date', () => {
    expect(presentUpdate({ supported: false, status: 'manual', checkedAt: 123, version: null }, t).statusText).toContain('update.upToDate');
    expect(presentUpdate({ supported: false, status: 'manual', checkedAt: null, version: null }, t).statusText).toContain('update.notChecked');
  });
  it('explains unsupported Mac installations and retains a manual release action', () => {
    expect(presentUpdate({ supported: false, status: 'manual', reason: 'unsigned-mac', version: '2.0.0' }, t)).toMatchObject({ action: 'manual', supportKey: 'update.support.unsigned-mac' });
  });
  it('offers a retry after errors without presenting an incomplete download as installed', () => {
    expect(presentUpdate({ supported: true, status: 'error', version: '2.0.0' }, t).action).toBe('download');
    expect(presentUpdate({ supported: true, status: 'error', version: null }, t).action).toBe('manual');
  });
  it('ignores a stale initial snapshot received after a newer update event', async () => {
    let receive; let resolve;
    const nodes = new Map();
    const document = { getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {} });
      return nodes.get(id);
    } };
    const api = { onUpdateState(fn) { receive = fn; return () => {}; }, getUpdateState: () => new Promise(done => { resolve = done; }) };
    const panel = createUpdatePanel({ document, api, t });
    const start = panel.start();
    receive({ supported: true, status: 'downloaded', version: '2.0.0', automaticDownloads: true });
    resolve({ supported: true, status: 'idle', automaticDownloads: true });
    await start;
    expect(nodes.get('updateInstallBtn').textContent).toContain('update.install');
    expect(nodes.get('updateInstallBtn').hidden).toBe(false);
    panel.dispose();
  });
});
