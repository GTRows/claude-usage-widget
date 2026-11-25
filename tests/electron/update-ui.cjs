const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
function prepare(root) {
  const updater = new EventEmitter();
  let finish;
  let installed = false;
  updater.checkForUpdates = async () => updater.emit('update-available', { version: '99.0.1-gtrows.1' });
  updater.downloadUpdate = () => {
    updater.emit('download-progress', { percent: 37 });
    return new Promise(resolve => { finish = resolve; });
  };
  updater.quitAndInstall = (silent, restart) => { assert(silent && restart); installed = true; };
  require(path.join(root, 'src/main/update-runtime')).createDesktopUpdates = ({ store, emitState }) => {
    return require(path.join(root, 'src/main/update-controller')).createUpdateController({ updater, capability: { supported: true }, readPreference: () => store.get('settings.autoDownloadUpdates', true), emitState });
  };
  return async function run({ win, js, waitFor, delay, screenshots }) {
    await waitFor(async () => await js('document.getElementById("autoDownloadUpdates").checked && document.getElementById("sessionPercentage").textContent === "38%"'), 'update panel initialized');
    const history = await js('window.electronAPI.getUsageHistory()');
    await js('document.getElementById("settingsBtn").click()');
    await js('document.getElementById("autoDownloadUpdates").click()');
    await waitFor(async () => !(await js('window.electronAPI.getUpdateState()')).automaticDownloads, 'download preference persisted');
    assert.equal((await js('window.electronAPI.getSettings()')).autoDownloadUpdates, false);
    await js('document.getElementById("checkUpdatesBtn").click()');
    await waitFor(async () => await js('document.getElementById("updateInstallBtn").textContent === "Download update" && !document.getElementById("updateInstallBtn").hidden'), 'available update');
    await js('document.getElementById("updateInstallBtn").click()');
    await waitFor(async () => await js('document.getElementById("checkUpdatesStatus").textContent.includes("37%")'), 'download progress');
    assert.equal(installed, false);
    assert.equal(await js('document.getElementById("updateInstallBtn").getBoundingClientRect().bottom <= innerHeight'), true);
    await js('document.getElementById("checkUpdatesStatusRow").scrollIntoView({ block: "end" })');
    await delay(150);
    fs.writeFileSync(path.join(screenshots, 'update-downloading.png'), (await win.webContents.capturePage()).toPNG());
    updater.emit('update-downloaded', { version: '99.0.1-gtrows.1' }); finish();
    await waitFor(async () => await js('document.getElementById("updateInstallBtn").textContent === "Restart and update" && !document.getElementById("updateInstallBtn").hidden'), 'downloaded update');
    await delay(150);
    fs.writeFileSync(path.join(screenshots, 'update-ready.png'), (await win.webContents.capturePage()).toPNG());
    assert.equal((await js('window.electronAPI.getCredentials()')).id, 'team');
    assert.deepEqual(await js('window.electronAPI.getUsageHistory()'), history);
    await js('document.getElementById("updateInstallBtn").click()');
    await waitFor(() => installed, 'explicit restart action');
    process.stdout.write('ELECTRON_SMOKE_PASS: update preference, download progress, restart action and preserved account/history\n');
  };
}
module.exports = { prepare };
