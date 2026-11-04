const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const metadata = require(path.join(root, 'package.json'));
const config = metadata.widgetUpdateFixture;
if (!config?.dataDirectory) throw new Error('Missing isolated updater fixture configuration');
app.setPath('userData', config.dataDirectory);
app.setLoginItemSettings = () => {};
require(path.join(root, 'src/main/release-check')).checkLatestRelease = async () => ({ ok: true, hasUpdate: false });
require(path.join(root, 'src/providers')).fetchLocalUsage = async () => ({ provider: 'claude', five_hour: { utilization: 12 }, seven_day: { utilization: 34 } });
require(path.join(root, 'main.js'));
function write(name, data) {
  const file = path.join(config.dataDirectory, name);
  fs.writeFileSync(file + '.tmp', JSON.stringify(data)); fs.renameSync(file + '.tmp', file);
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  try {
    if (metadata.version === config.target) {
      const stored = JSON.parse(fs.readFileSync(path.join(config.dataDirectory, 'config.json'), 'utf8'));
      if (stored.updateAcceptanceSentinel !== 'preserve-me' || stored.settings.codexQuotaDisplay !== 'remaining' || stored.usageHistory[0]?.accountId !== 'fixture' || stored.accounts[0]?.id !== 'fixture' || stored.accounts[0]?.configDir !== path.join(config.dataDirectory, 'profile')) throw new Error('Persisted data was not preserved');
      write('result.json', { ok: true, version: metadata.version, preserved: true });
      app.quit(); return;
    }
    write('started.json', { version: metadata.version });
    const win = BrowserWindow.getAllWindows()[0];
    const js = code => win.webContents.executeJavaScript(code);
    for (let i = 0; i < 300; i++) {
      if (await js('Boolean(window.electronAPI)')) break;
      await delay(100);
    }
    await js('window.electronAPI.checkForUpdate()');
    let state = await js('window.electronAPI.getUpdateState()');
    if (state.status !== 'available' || state.version !== config.target) throw new Error('Candidate version was not offered: ' + JSON.stringify(state));
    await js('window.electronAPI.downloadUpdate()');
    state = await js('window.electronAPI.getUpdateState()');
    if (state.status !== 'downloaded') throw new Error('Verified download did not complete: ' + JSON.stringify(state));
    write('downloaded.json', { version: state.version });
    // Successful installation closes this renderer before its IPC reply may arrive.
    js('window.electronAPI.installUpdate()').then(ok => {
      if (!ok) write('result.json', { ok: false, error: 'Install action was rejected' });
    }).catch(() => {});
  } catch (error) {
    write('result.json', { ok: false, error: error.message });
    app.exit(1);
  }
});
