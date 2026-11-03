// Fixture-only integration test. It never reads real profile credentials.
const { app, BrowserWindow, nativeImage, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const os = require('os');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-smoke-'));
const screenshots = process.env.WIDGET_SCREENSHOTS || path.join(dataDir, 'screenshots');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(screenshots, { recursive: true });
app.setName('Usage Widget Test');
app.getVersion = () => require(path.join(root, 'package.json')).version;
app.setPath('userData', dataDir);
app.setLoginItemSettings = () => {};
const accounts = [
  { id: 'team', provider: 'claude', authType: 'local', configDir: '/fixture/team', label: 'Claude · Work' },
  { id: 'personal', provider: 'claude', authType: 'local', configDir: '/fixture/personal', label: 'Claude · Personal' },
  { id: 'codex', provider: 'codex', authType: 'local', configDir: '/fixture/codex', label: 'Codex · Personal' },
];
if (process.env.WIDGET_BROKEN_START) accounts.push({ id: 'broken', provider: 'claude', label: 'Unavailable account', organizationId: 'fixture-org' });
const history = accounts.flatMap((account, accountIndex) => Array.from({ length: 100 }, (_, i) => ({
  timestamp: Date.now() - (100 - i) * 864000, accountId: account.id,
  session: Math.round((i % 20) * 2 + accountIndex * 9), weekly: Math.round(i * 0.55 + accountIndex * 5),
})));
history.push({ timestamp: Date.now() - 7 * 86400000, accountId: 'personal', session: 9, weekly: 12 });
fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify({ accounts, usageHistory: history, settings: { activeProfile: process.env.WIDGET_BROKEN_START ? 'broken' : 'team', language: 'en', theme: 'dark', themeStyle: 'glass', graphVisible: true, usageAlerts: false } }));
const api = require(path.join(root, 'src/cli/api'));
api.fetchCodexUsage = async () => ({ provider: 'codex', codex_usage: { num_model_requests: 250, cost: 0.23, input_tokens: 50000, output_tokens: 12000, currency: 'USD' }, extra_usage: { used_cents: 23, currency: 'USD', is_enabled: true } });
const adapters = require(path.join(root, 'src/providers'));
let slowProfile = null;
adapters.discoverLocalProfiles = async () => accounts;
adapters.fetchLocalUsage = async (account) => {
  if (account.id === slowProfile) await new Promise((resolve) => setTimeout(resolve, 650));
  return {
  provider: account.provider, usageType: 'subscription',
  five_hour: { utilization: account.id === 'team' ? 38 : account.id === 'personal' ? 17 : 64, resets_at: new Date(Date.now() + 11280000).toISOString() },
  seven_day: { utilization: account.id === 'team' ? 57 : account.id === 'personal' ? 31 : 42, resets_at: new Date(Date.now() + 242000000).toISOString() },
  };
};
adapters.linkLocalProfile = async (provider, configDir) => ({ id: 'added', provider, configDir, label: 'New profile', authType: 'local' });
const registerHandler = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, handler) => registerHandler(channel, channel === 'set-active-account'
  ? async (...args) => { await new Promise((resolve) => setTimeout(resolve, 180)); return handler(...args); }
  : handler);
require(path.join(root, 'main.js'));
ipcMain.handle = registerHandler;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(test, description) {
  for (let i = 0; i < 120; i++) { if (await test()) return; await delay(100); }
  throw new Error(`Timeout: ${description}`);
}

app.whenReady().then(async () => {
  try {
    if (process.platform === 'darwin') {
      const { createTrayFrameImage, createMacTrayPlaceholder } = require(path.join(root, 'src/main/tray-image'));
      const placeholder = createMacTrayPlaceholder(nativeImage);
      assert.deepEqual(placeholder.getSize(), { width: 16, height: 16 });
      assert.equal(placeholder.isTemplateImage(), true);
      const bitmap = nativeImage.createFromBitmap(Buffer.alloc(32 * 32 * 4, 255), { width: 32, height: 32 });
      const icon = createTrayFrameImage(nativeImage, { dataURL: bitmap.toDataURL(), template: true }, 'darwin');
      assert.deepEqual(icon.getSize(), { width: 16, height: 16 });
      assert.equal(icon.getScaleFactors().includes(2), true);
      assert.equal(icon.isTemplateImage(), true);
      assert.equal(createTrayFrameImage(nativeImage, { nativeTextOnly: true }, 'darwin').isEmpty(), true);
    }
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('index.html')) || BrowserWindow.getAllWindows()[0];
    win.webContents.on('console-message', (_, level, message) => { if (level >= 2) process.stderr.write(`renderer: ${message}\n`); });
    const js = (source) => win.webContents.executeJavaScript(source);
    if (process.env.WIDGET_BROKEN_START) {
      await waitFor(async () => await js('document.querySelectorAll(".account-card").length === 4 && document.getElementById("accountList").textContent.includes("38%")'), 'healthy accounts while active credential unavailable');
      assert.equal(await js('getComputedStyle(document.getElementById("loginContainer")).display'), 'none');
      await js('document.querySelectorAll(".account-card")[0].click()');
      await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "38%"'), 'select healthy account');
      process.stdout.write('ELECTRON_SMOKE_PASS: unavailable active credential does not block healthy accounts\n');
      app.quit();
      return;
    }
    await waitFor(async () => await js('document.getElementById("sessionPercentage")?.textContent === "38%"'), 'initial usage');
    if (process.platform === 'darwin') assert.equal(await js('document.getElementById("trayStyleSelect").options[0].textContent'), 'Percentage');
    assert.equal(await js('document.querySelectorAll(".account-card").length'), 3);
    assert.equal(await js('document.getElementById("addAccountBtn")'), null);
    assert.equal(await js('document.getElementById("accountOverview").getBoundingClientRect().top >= document.querySelector(".metric-grid").getBoundingClientRect().bottom'), true);
    assert.equal(await js('document.body.dataset.themeStyle'), 'glass');
    const publicState = await js('window.electronAPI.getCredentials()');
    assert.equal(publicState.sessionKey, undefined);
    assert.equal(publicState.apiKey, undefined);
    if (process.env.WIDGET_HOLD === '1') { process.stdout.write('WIDGET_HOLD_READY\n'); return; }
    await delay(250);
    fs.writeFileSync(path.join(screenshots, 'glass-dark.png'), (await win.webContents.capturePage()).toPNG());
    slowProfile = 'personal';
    await js(`window.electronAPI.saveCredentials({ id: 'personal', provider: 'claude', label: 'Claude · Personal' })`);
    const switchBounds = win.getContentSize();
    const switchSizes = [];
    const recordSwitchSize = () => switchSizes.push(win.getContentSize());
    win.on('resize', recordSwitchSize);
    await js('document.querySelectorAll(".account-card")[1].click()');
    await delay(80);
    assert.equal(await js('getComputedStyle(document.getElementById("loadingContainer")).display'), 'none');
    await delay(250);
    assert.equal(await js('document.body.classList.contains("account-switching")'), true);
    await js('document.getElementById("graphBtn").click(); document.getElementById("graphBtn").click()');
    assert.equal(await js('document.body.classList.contains("account-switching")'), true);
    assert.deepEqual(win.getContentSize(), switchBounds);
    fs.writeFileSync(path.join(screenshots, 'account-switch-loading.png'), (await win.webContents.capturePage()).toPNG());
    await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "17%"'), 'stable account switch');
    await delay(250);
    slowProfile = null;
    assert.deepEqual(win.getContentSize(), switchBounds);
    fs.writeFileSync(path.join(screenshots, 'account-switch-ready.png'), (await win.webContents.capturePage()).toPNG());
    await js('document.querySelectorAll(".account-card")[0].click()');
    await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "38%"'), 'return to work account');
    await delay(250);
    win.removeListener('resize', recordSwitchSize);
    assert(switchSizes.every((size) => size[0] === switchBounds[0] && size[1] === switchBounds[1]), `Account switch resized the window: ${JSON.stringify(switchSizes)}`);
    await js('document.getElementById("settingsBtn").click()');
    await delay(100);
    await js('document.getElementById("autoPruneToggle").checked = true; document.getElementById("autoPruneDays").value = "1"; document.getElementById("autoPruneToggle").dispatchEvent(new Event("change", { bubbles: true }))');
    await waitFor(async () => { const settings = await js('window.electronAPI.getSettings()'); return settings.autoPrune && settings.autoPruneDays === 1; }, 'work account retention setting');
    await js('document.getElementById("autoPruneDays").value = "2"; document.getElementById("autoPruneDays").dispatchEvent(new Event("input", { bubbles: true }))');
    await js('document.querySelectorAll(".account-card")[1].click()');
    await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "17%"'), 'account switch');
    await js('document.getElementById("graphBtn").click(); document.getElementById("graphBtn").click()');
    await delay(450);
    assert.equal((await js('window.electronAPI.getSettings()')).autoPrune, false);
    assert((await js('window.electronAPI.getHistorySource("personal")')).some((row) => row.timestamp < Date.now() - 5 * 86400000));
    assert.equal((await js('window.electronAPI.getUsageHistory()')).every((row) => row.accountId === 'personal'), true);
    await js('document.getElementById("settingsBtn").click()');
    await delay(150);
    await js('document.querySelector("[data-theme-style=graphite]").click()');
    await waitFor(async () => (await js('window.electronAPI.getSettings()')).themeStyle === 'graphite', 'theme persistence');
    fs.writeFileSync(path.join(screenshots, 'settings-graphite.png'), (await win.webContents.capturePage()).toPNG());
    await js('document.getElementById("closeSettingsBtn").click()');
    await delay(200);
    fs.writeFileSync(path.join(screenshots, 'graphite-dark.png'), (await win.webContents.capturePage()).toPNG());
    await js('document.getElementById("settingsBtn").click()');
    await delay(100);
    await js('document.getElementById("settingsAddAccountBtn").click()');
    await waitFor(async () => await js('getComputedStyle(document.getElementById("loginContainer")).display !== "none"'), 'account setup');
    await delay(1800);
    const setupHeight = win.getContentSize()[1];
    assert(setupHeight >= 480, `Account setup collapsed to ${setupHeight}px`);
    await delay(600);
    assert(Math.abs(win.getContentSize()[1] - setupHeight) <= 2, 'Account setup height must stay stable');
    win.setContentSize(win.getContentSize()[0], 155);
    await delay(600);
    assert(win.getContentSize()[1] >= 480, 'Account setup must recover its content height from a small window');
    fs.writeFileSync(path.join(screenshots, 'account-setup.png'), (await win.webContents.capturePage()).toPNG());
    await js('document.getElementById("cancelAddAccount").click()');
    await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "17%"'), 'cancel setup');
    await js('document.querySelectorAll(".account-card")[2].click()');
    await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "64%"'), 'Codex subscription quota');
    await js('document.getElementById("settingsBtn").click()');
    await delay(100);
    await js('document.getElementById("codexQuotaDisplay").value = "remaining"; document.getElementById("codexQuotaDisplay").dispatchEvent(new Event("change", { bubbles: true }))');
    await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "36%"'), 'remaining quota display');
    await js('document.getElementById("closeSettingsBtn").click()');
    await js(`window.electronAPI.saveCredentials({ id: 'api', provider: 'codex', label: 'OpenAI API test', apiKey: 'fixture-not-a-real-key' })`);
    await js('document.getElementById("refreshBtn").click()');
    await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "250"'), 'API count metric');
    await delay(1100);
    assert.equal(await js('document.getElementById("sessionPercentage").textContent'), '250');
    assert.equal(await js('document.getElementById("weeklyPercentage").textContent'), '$0.23');
    fs.writeFileSync(path.join(screenshots, 'api-graph.png'), (await win.webContents.capturePage()).toPNG());
    await js('document.getElementById("settingsBtn").click()');
    await delay(100);
    await js('document.getElementById("logoutBtn").click()');
    await waitFor(async () => (await js('window.electronAPI.getAccounts()')).accounts.length === 3, 'logout preserves other accounts');
    await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "38%"'), 'remaining account refresh');
    const savedSources = await js('window.electronAPI.getHistorySources()');
    assert(savedSources.some((source) => source.id === 'api'), 'disconnected API history must remain accessible');
    await js('document.getElementById("settingsBtn").click()');
    await waitFor(async () => await js('document.getElementById("savedHistorySelect").options.length > 0'), 'saved history controls');
    await js('document.getElementById("savedHistorySelect").value = "api"; document.getElementById("viewSavedHistoryBtn").click()');
    await waitFor(async () => await js('document.body.classList.contains("history-archive-open")'), 'saved history view');
    assert((await js('window.electronAPI.getHistorySource("api")')).every((row) => row.apiRequests === 250));
    await js('document.getElementById("closeArchiveHistoryBtn").click()');
    await waitFor(async () => await js('!document.body.classList.contains("history-archive-open")'), 'return from history');
    const beforeMove = win.getBounds();
    win.setPosition(beforeMove.x + 5, beforeMove.y + 5);
    await waitFor(() => JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'))).windowPosition?.x === beforeMove.x + 5, 'normal position persistence after settings logout');
    const activeBeforeTray = (await js('window.electronAPI.getCredentials()')).id;
    await js(`window.electronAPI.deleteCredentials(${JSON.stringify(activeBeforeTray)})`);
    win.webContents.send('session-expired');
    await waitFor(async () => await js('document.getElementById("sessionPercentage").textContent === "17%"'), 'tray logout reselects remaining account');
    await js('window.electronAPI.closeWindow()');
    await waitFor(() => !win.isVisible(), 'hidden widget');
    app.emit('second-instance');
    await waitFor(() => win.isVisible(), 'relaunch restores widget');
    process.stdout.write('ELECTRON_SMOKE_PASS: overview, provider quotas, account switch, scoped history, theme persistence, setup/cancel, hidden relaunch\n');
    app.on('will-quit', () => process.stdout.write('WILL_QUIT\n'));
    app.on('quit', (_, code) => process.stdout.write(`QUIT_CODE:${code}\n`));
    app.quit();
  } catch (error) { process.stderr.write(`${error.stack}\n`); app.exit(1); }
});
