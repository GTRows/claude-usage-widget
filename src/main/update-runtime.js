const { spawnSync } = require('child_process');
const { createUpdateController } = require('./update-controller');
const { updateCapability } = require('./update-capability');
const { checkLatestRelease } = require('./release-check');
function createDesktopUpdates({ app, store, emitState }) {
  let signature = '';
  if (app.isPackaged && process.platform === 'darwin') {
    try { signature = spawnSync('/usr/bin/codesign', ['-d', '--verbose=2', app.getPath('exe')], { encoding: 'utf8', timeout: 3000 }).stderr || ''; } catch {}
  }
  const capability = updateCapability({ packaged: app.isPackaged, platform: process.platform, environment: process.env, signature });
  let lastCheck = store.get('updates.lastCheckedAt', null);
  return createUpdateController({
    updater: capability.supported ? require('electron-updater').autoUpdater : {}, capability,
    readPreference: () => store.get('settings.autoDownloadUpdates', true),
    checkManual: () => checkLatestRelease(app.getVersion()),
    emitState: state => {
      if (state.checkedAt && state.checkedAt !== lastCheck) { lastCheck = state.checkedAt; store.set('updates.lastCheckedAt', lastCheck); }
      emitState(state);
    },
  });
}
module.exports = { createDesktopUpdates };
