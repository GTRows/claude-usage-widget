import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createUpdateController } = require('../src/main/update-controller');
function fixture(options = {}) {
  const updater = new EventEmitter();
  updater.checkForUpdates = vi.fn(async () => {});
  updater.downloadUpdate = vi.fn(async () => {});
  updater.quitAndInstall = vi.fn();
  const states = [];
  const controller = createUpdateController({ updater, capability: { supported: true }, emitState: state => states.push(state), ...options });
  return { updater, controller, states };
}
describe('desktop update controller', () => {
  it('pins stable release and forbids automatic installation or downgrades', () => {
    const { updater } = fixture();
    expect(updater.channel).toBe('latest');
    expect(updater.allowPrerelease).toBe(false);
    expect(updater.allowDowngrade).toBe(false);
    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);
    expect(updater.disableWebInstaller).toBe(true);
  });
  it('downloads an available version and installs only after an explicit action', async () => {
    const { updater, controller } = fixture();
    updater.emit('update-available', { version: '1.18.0-gtrows.1' });
    await Promise.resolve();
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
    updater.emit('download-progress', { percent: 25.6, secret: 'private' });
    expect(controller.getState().percent).toBe(26);
    expect(controller.install()).toBe(false);
    updater.emit('update-downloaded', { version: '1.18.0-gtrows.1' });
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    expect(controller.install()).toBe(true);
    expect(controller.install()).toBe(false);
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });
  it('deduplicates checks and does not discard a downloaded update', async () => {
    const { updater, controller } = fixture();
    let resolve;
    updater.checkForUpdates.mockImplementation(() => new Promise(done => { resolve = done; }));
    const a = controller.check();
    const b = controller.check();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    updater.emit('update-not-available'); resolve();
    await Promise.all([a, b]);
    expect(controller.getState().status).toBe('up-to-date');
    updater.emit('update-downloaded', { version: '2.0.0-gtrows.1' });
    await controller.check();
    expect(controller.getState().status).toBe('downloaded');
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });
  it('honors disabled automatic downloads and lets a manual action download once', async () => {
    const { updater, controller } = fixture({ readPreference: () => false });
    updater.emit('update-available', { version: '2.0.0-gtrows.1' });
    expect(controller.getState().status).toBe('available');
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    let resolve;
    updater.downloadUpdate.mockImplementation(() => new Promise(done => { resolve = done; }));
    const a = controller.download(); const b = controller.download();
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
    updater.emit('update-downloaded', { version: '2.0.0-gtrows.1' }); resolve();
    await Promise.all([a, b]);
    expect(controller.getState().status).toBe('downloaded');
  });
  it('recovers from offline checks without exposing URLs or local paths', async () => {
    const { updater, controller } = fixture();
    updater.checkForUpdates.mockRejectedValueOnce(new Error('https://private/?token=secret /Users/private'));
    await controller.check();
    expect(controller.getState().error).toBe('UPDATE_FAILED');
    expect(JSON.stringify(controller.getState())).not.toContain('private');
    updater.checkForUpdates.mockImplementation(async () => updater.emit('update-not-available'));
    await controller.check();
    expect(controller.getState().error).toBe(null);
    expect(controller.getState().checkedAt).toEqual(expect.any(Number));
  });
  it('retains the version after a failed download and allows retry', async () => {
    const { updater, controller } = fixture({ readPreference: () => false });
    updater.emit('update-available', { version: '2.0.0-gtrows.1' });
    updater.downloadUpdate.mockRejectedValueOnce(new Error('network error'));
    await controller.download();
    expect(controller.getState()).toMatchObject({ status: 'error', version: '2.0.0-gtrows.1' });
    await controller.download();
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(2);
  });
  it('does not begin a stale download while a fresh version check is running', async () => {
    const { updater, controller } = fixture({ readPreference: () => false });
    updater.emit('update-available', { version: '2.0.0' });
    let finish;
    updater.checkForUpdates.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const check = controller.check();
    await controller.download();
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    updater.emit('update-available', { version: '2.0.1' }); finish();
    await check;
    await controller.download();
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
  });
  it('only installs supported, fully downloaded updates', () => {
    const { updater, controller } = fixture();
    expect(controller.install()).toBe(false);
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });
  it('uses manual release checks when native updates are unavailable', async () => {
    const { updater, controller } = fixture({ capability: { supported: false, reason: 'unsigned-mac' }, checkManual: async () => ({ hasUpdate: true, version: '2.0.0-gtrows.1' }) });
    await controller.check();
    expect(controller.getState()).toMatchObject({ status: 'manual', reason: 'unsigned-mac', version: '2.0.0-gtrows.1' });
    await controller.download(); expect(controller.install()).toBe(false);
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
  });
  it('enables download of an already available update when preference changes', async () => {
    const { updater, controller } = fixture({ readPreference: () => false });
    updater.emit('update-available', { version: '2.0.0-gtrows.1' });
    controller.setAutomaticDownloads(true);
    await Promise.resolve();
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
  });
  it('stops scheduled work and ignores late events after disposal', async () => {
    vi.useFakeTimers();
    try {
      const { updater, controller, states } = fixture();
      controller.start(); controller.dispose();
      const count = states.length;
      await vi.advanceTimersByTimeAsync(8 * 3600000);
      updater.emit('update-available', { version: '2.0.0' });
      expect(() => updater.emit('error', new Error('late network failure'))).not.toThrow();
      expect(updater.checkForUpdates).not.toHaveBeenCalled();
      expect(states).toHaveLength(count);
    } finally { vi.useRealTimers(); }
  });
});
