function createUpdateController({ updater, capability, readPreference = () => true, emitState = () => {}, checkManual = async () => ({ hasUpdate: false }) }) {
  let disposed = false;
  let checkPromise = null;
  let downloadPromise = null;
  let initialTimer = null;
  let interval = null;
  const listeners = [];
  let state = {
    status: capability.supported ? 'idle' : 'manual', supported: capability.supported,
    reason: capability.reason || null, automaticDownloads: readPreference() !== false,
    version: null, percent: 0, error: null, checkedAt: null,
  };
  const getState = () => ({ ...state });
  function change(patch) {
    if (disposed) return;
    state = { ...state, ...patch };
    emitState(getState());
  }
  const failure = () => change({ status: 'error', error: 'UPDATE_FAILED' });
  function listen(name, callback) {
    updater.on(name, callback);
    listeners.push([name, callback]);
  }
  if (capability.supported) {
    Object.assign(updater, {
      channel: 'latest', allowPrerelease: false, allowDowngrade: false,
      autoDownload: false, autoInstallOnAppQuit: false, disableWebInstaller: true,
    });
    listen('update-available', (info) => {
      change({ status: 'available', version: info.version, percent: 0, error: null, checkedAt: Date.now() });
      if (state.automaticDownloads) download();
    });
    listen('update-not-available', () => change({ status: 'up-to-date', version: null, error: null, checkedAt: Date.now() }));
    listen('download-progress', (progress) => {
      const percent = Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, Math.round(progress.percent))) : 0;
      change({ status: 'downloading', percent });
    });
    listen('update-downloaded', (info) => change({ status: 'downloaded', version: info.version, percent: 100, error: null }));
    listen('error', failure);
  }
  function check() {
    if (disposed || ['downloading', 'downloaded', 'installing'].includes(state.status)) return Promise.resolve(getState());
    if (checkPromise) return checkPromise;
    change({ status: 'checking', error: null });
    // Defer promise cleanup so even a synchronous updater event remains single-flight.
    let work;
    try { work = capability.supported ? updater.checkForUpdates() : checkManual(); }
    catch { work = Promise.reject(new Error('UPDATE_FAILED')); }
    checkPromise = Promise.resolve(work).then((result) => {
      if (!capability.supported) {
        if (result?.ok === false) { failure(); return; }
        change({ status: 'manual', version: result?.hasUpdate ? result.version : null, error: null, checkedAt: Date.now() });
      }
    }).catch(failure).then(() => getState()).finally(() => { checkPromise = null; });
    return checkPromise;
  }
  function download() {
    if (disposed || !capability.supported || !state.version || ['downloaded', 'installing'].includes(state.status)) return Promise.resolve(getState());
    if (downloadPromise) return downloadPromise;
    change({ status: 'downloading', percent: 0, error: null });
    let work;
    try { work = updater.downloadUpdate(); }
    catch { work = Promise.reject(new Error('UPDATE_FAILED')); }
    downloadPromise = Promise.resolve(work).catch(failure).then(() => getState()).finally(() => { downloadPromise = null; });
    return downloadPromise;
  }
  function install() {
    if (disposed || !capability.supported || state.status !== 'downloaded') return false;
    change({ status: 'installing' });
    try { updater.quitAndInstall(true, true); return true; }
    catch { failure(); return false; }
  }
  function setAutomaticDownloads(enabled) {
    change({ automaticDownloads: Boolean(enabled) });
    if (enabled && state.status === 'available') download();
    return getState();
  }
  function start() {
    if (disposed || initialTimer || interval) return;
    initialTimer = setTimeout(() => { initialTimer = null; check(); }, 15000);
    interval = setInterval(check, 4 * 3600000);
    initialTimer.unref?.(); interval.unref?.();
  }
  function dispose() {
    disposed = true;
    clearTimeout(initialTimer); clearInterval(interval);
    for (const [name, callback] of listeners) updater.removeListener(name, callback);
  }
  return { start, check, download, install, getState, setAutomaticDownloads, dispose };
}
module.exports = { createUpdateController };
