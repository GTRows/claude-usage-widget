const { app, BrowserWindow, ipcMain, Tray, Menu, session, shell, Notification, safeStorage, nativeImage, dialog } = require('electron');
const path = require('path');
const https = require('https');
const Store = require('electron-store');
const { fetchViaWindow } = require('./src/fetch-via-window');
const historyShared = require('./src/shared/history');
const { isNewerVersion, pickLatestRelease } = require('./src/shared/version');
const { normalizeSettings } = require('./src/shared/settings-schema');
const { t, setLanguage } = require('./src/shared/i18n');
const { fetchCodexUsage } = require('./src/cli/api');
const { randomUUID } = require('crypto');
const { createAccountStore, publicAccount } = require('./src/main/account-store');
const { createAccountUsage } = require('./src/main/account-usage');
const { selectAccountHistory, appendAccountSample, removeAccountHistory } = require('./src/shared/account-history');
const { discoverLocalProfiles, linkLocalProfile, fetchLocalUsage } = require('./src/providers');
const { fitWindowBounds, trayWindowBounds } = require('./src/shared/window-geometry');
const { createDockVisibility } = require('./src/main/dock-visibility');
const { historyForSource, historySources, applyHistoryPolicies, disconnectAccount } = require('./src/main/history-sources');
const {
  hasUsableCredentials,
  normalizeProvider,
} = require('./src/shared/accounts');

const GITHUB_OWNER = 'GTRows';
const GITHUB_REPO = 'claude-usage-widget';

// Migration: Handle old encrypted config files from v1.7.0 and earlier
// Must happen BEFORE creating Store instance to prevent parse errors
const fs = require('fs');
const os = require('os');

// Use Electron's actual user-data location, including isolated integration profiles.
const configPath = path.join(app.getPath('userData'), 'config.json');

try {
  if (fs.existsSync(configPath)) {
    const rawData = fs.readFileSync(configPath, 'utf-8');
    // Check if file looks encrypted (contains non-JSON garbage or doesn't start with {)
    if (rawData.includes('\u0000') || !rawData.trim().startsWith('{')) {
      console.log('[Migration] Detected old encrypted config from v1.7.0, deleting for fresh start');
      fs.unlinkSync(configPath);
    }
  }
} catch (err) {
  console.error('[Migration] Error checking config file:', err.message);
  // If we can't read it, try to delete it
  try {
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
  } catch {}
}

// Non-sensitive settings storage (no encryption needed)
const store = new Store();

// One-shot cleanup: drop the legacy Anthropic API key (removed in v1.15).
// Safe no-op when the keys are absent.
store.delete('apiKey');
store.delete('apiKey_encrypted');

// Debug mode: set DEBUG_LOG=1 env var or pass --debug flag to see verbose logs.
// Regular users will only see critical errors in the console.
const DEBUG = process.env.DEBUG_LOG === '1' || process.argv.includes('--debug');
function debugLog(...args) {
  if (DEBUG) console.log('[Debug]', ...args);
}

function encryptSecret(value) {
  if (!value) return null;
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: safeStorage.encryptString(value).toString('base64'),
    };
  }
  return { plain: value };
}

function decryptSecret(secret) {
  if (!secret) return null;
  if (secret.encrypted && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(secret.encrypted, 'base64'));
    } catch (err) {
      console.error('[Keychain] Failed to decrypt account secret:', err.message);
      return null;
    }
  }
  return secret.plain || null;
}

const accountStore = createAccountStore(store, { encrypt: encryptSecret, decrypt: decryptSecret });
const loadAccounts = () => accountStore.load();
const saveAccount = (input) => accountStore.save(input);
function deleteAccount(accountId) {
  const id = accountId || accountStore.active()?.id;
  if (!id) return;
  disconnectAccount({ store, accounts: accountStore, invalidate: accountUsage.invalidate }, id);
  session.fromPartition(`persist:account-${id}`).clearStorageData().catch(() => {});
}
function activeHistory() {
  return selectAccountHistory(store.get('usageHistory', []), accountStore.active()?.id || 'default');
}

const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let mainWindow = null;
let quitting = false;
let dockVisibility = null;
let settingsReturnBounds = null;
app.on('before-quit', () => { quitting = true; dockVisibility?.dispose(); });
let tray = null;
let trayIconFrames = [];
let trayIconIndex = 0;
let trayIconTimer = null;
let defaultTrayImage = null;

const WIDGET_WIDTH = process.platform === 'darwin' ? 590 : 560;
const WIDGET_COMPACT_WIDTH = 320;
const WIDGET_HEIGHT = 155;
const CHART_DAYS = 7;

function storeUsageHistory(data, accountId) {
  store.set('usageHistory', appendAccountSample(store.get('usageHistory', []), data, accountId));
}

// Set session-level User-Agent to avoid Electron detection
app.on('ready', () => {
  session.defaultSession.setUserAgent(CHROME_USER_AGENT);
});

// Set sessionKey as a cookie in Electron's session
async function setSessionCookie(sessionKey, browserSession = session.defaultSession) {
  browserSession.setUserAgent(CHROME_USER_AGENT);
  await browserSession.cookies.set({
    url: 'https://claude.ai',
    name: 'sessionKey',
    value: sessionKey,
    domain: '.claude.ai',
    path: '/',
    secure: true,
    httpOnly: true
  });
  debugLog('sessionKey cookie set in Electron session');
}

function createMainWindow() {
  const savedPosition = store.get('windowPosition');
  const windowOptions = {
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    roundedCorners: false,
    alwaysOnTop: store.get('settings.alwaysOnTop', true),
    resizable: false,
    icon: path.join(__dirname, process.platform === 'darwin' ? 'assets/icon.icns' : process.platform === 'linux' ? 'assets/logo.png' : 'assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js')
    }
  };

  if (savedPosition) {
    const { screen } = require('electron');
    const display = screen.getDisplayMatching({ ...savedPosition, width: WIDGET_WIDTH, height: WIDGET_HEIGHT });
    Object.assign(windowOptions, fitWindowBounds({ ...savedPosition, width: WIDGET_WIDTH, height: WIDGET_HEIGHT }, display.workArea));
  }

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  applyNativeAppearance();
  applyTaskbarVisibility();

  let positionSaveTimer = null;
  mainWindow.on('move', () => {
    if (store.get('settings.compactMode', false) || _settingsModeActive) return;
    if (positionSaveTimer) clearTimeout(positionSaveTimer);
    positionSaveTimer = setTimeout(() => {
      if (!mainWindow || store.get('settings.compactMode', false) || _settingsModeActive) return;
      const position = mainWindow.getBounds();
      store.set('windowPosition', { x: position.x, y: position.y });
    }, 300);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function buildTrayMenuTemplate() {
  return [
    {
      label: t('tray.showWidget'),
      click: showMainWindow
    },
    {
      label: t('tray.refresh'),
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('refresh-usage');
        }
      }
    },
    { type: 'separator' },
    {
      label: t('tray.logOut'),
      click: async () => {
        deleteAccount();
        if (mainWindow) {
          mainWindow.webContents.send('session-expired');
        }
      }
    },
    { type: 'separator' },
    {
      label: t('tray.exit'),
      click: () => {
        app.quit();
      }
    }
  ];
}

function createTray() {
  try {
    const trayIconPath = path.join(__dirname, process.platform === 'darwin' ? 'assets/tray-icon-mac.png' : process.platform === 'linux' ? 'assets/tray-icon-linux.png' : 'assets/tray-icon.png');
    defaultTrayImage = nativeImage.createFromPath(trayIconPath);
    tray = new Tray(defaultTrayImage);

    const contextMenu = Menu.buildFromTemplate(buildTrayMenuTemplate());

    tray.setToolTip(t('tray.tooltip'));
    if (process.platform === 'darwin') {
      defaultTrayImage.setTemplateImage(true);
      tray.on('right-click', () => tray.popUpContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate())));
    } else {
      tray.setContextMenu(contextMenu);
    }

    tray.on('click', (event, bounds) => {
      if (!mainWindow) { showMainWindow(); return; }
      recoverWindow();
      if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
        mainWindow.hide();
        return;
      }
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (store.get('settings.compactMode', false) && bounds) {
        anchorAboveTray(bounds);
      }
      showMainWindow();
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

// Anchor the window so its bottom sits just above the tray icon.
// Used for compact (tray-popup) mode: window grows upward as content grows.
function anchorAboveTray(trayBounds) {
  if (!mainWindow) return;
  const { screen } = require('electron');
  const bounds = trayBounds || tray?.getBounds();
  if (!bounds) return;
  const display = screen.getDisplayMatching(bounds);
  mainWindow.setBounds(trayWindowBounds(mainWindow.getBounds(), bounds, display.workArea));
}

function recoverWindow() {
  if (!mainWindow) return;
  if (store.get('settings.compactMode', false) && !_settingsModeActive && tray) { anchorAboveTray(); return; }
  const { screen } = require('electron');
  const bounds = mainWindow.getBounds();
  mainWindow.setBounds(fitWindowBounds(bounds, screen.getDisplayMatching(bounds).workArea));
}

function showMainWindow() {
  if (!app.isReady() || quitting) return;
  if (!mainWindow) createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  recoverWindow();
  applyTaskbarVisibility();
  mainWindow.show();
  mainWindow.focus();
}

function applyNativeAppearance() {
  if (!mainWindow) return;
  const glass = store.get('settings.themeStyle', process.platform === 'darwin' ? 'glass' : 'classic') === 'glass';
  if (process.platform === 'darwin') {
    mainWindow.setVibrancy(glass ? 'under-window' : null);
  } else if (process.platform === 'win32' && mainWindow.setBackgroundMaterial && Number(os.release().split('.')[2]) >= 22000) {
    mainWindow.setBackgroundMaterial(glass ? 'acrylic' : 'none');
  }
}

function applyTaskbarVisibility() {
  if (!mainWindow) return;
  const compact = store.get('settings.compactMode', false);
  const hide = store.get('settings.hideFromTaskbar', false);
  if (process.platform === 'darwin') {
    if (!dockVisibility) dockVisibility = createDockVisibility(app.dock);
    dockVisibility.setVisible(!compact && !hide);
  } else {
    mainWindow.setSkipTaskbar(compact || hide);
  }
}

function applyCompactWindowMode(compact) {
  if (!mainWindow) return;
  if (compact) {
    mainWindow.setMovable(false);
    mainWindow.setContentSize(WIDGET_COMPACT_WIDTH, mainWindow.getContentSize()[1]);
    if (tray) anchorAboveTray(tray.getBounds());
  } else {
    mainWindow.setMovable(true);
    mainWindow.setContentSize(WIDGET_WIDTH, mainWindow.getContentSize()[1]);
    const saved = store.get('windowPosition');
    if (saved) mainWindow.setPosition(saved.x, saved.y);
    if (!mainWindow.isVisible()) mainWindow.show();
    recoverWindow();
  }
  applyTaskbarVisibility();
}

// IPC Handlers
ipcMain.handle('get-credentials', () => ({
  ...publicAccount(accountStore.active()), accounts: accountStore.list(),
}));

ipcMain.handle('save-credentials', async (event, credentials) => {
  const account = saveAccount({
    id: credentials.id, provider: normalizeProvider(credentials.provider), label: credentials.label,
    sessionKey: credentials.sessionKey, organizationId: credentials.organizationId,
    apiKey: credentials.apiKey, organizationHeader: credentials.organizationHeader, projectId: credentials.projectId,
  });
  accountUsage.invalidate(account.id);
  return publicAccount(account);
});

ipcMain.handle('delete-credentials', (event, accountId) => { deleteAccount(accountId); return true; });
ipcMain.handle('get-accounts', () => ({ activeAccountId: accountStore.active()?.id || null, accounts: accountStore.list(), snapshots: accountUsage.snapshots() }));
ipcMain.handle('set-active-account', (event, accountId) => accountStore.select(accountId));
ipcMain.handle('rename-account', (event, accountId, label) => accountStore.rename(accountId, label));
ipcMain.handle('discover-local-profiles', () => discoverLocalProfiles());
const pendingProfiles = new Map();
ipcMain.handle('save-local-profile', (event, ticket) => {
  const pending = pendingProfiles.get(ticket);
  pendingProfiles.delete(ticket);
  if (!pending || Date.now() - pending.createdAt > 60000) throw new Error('Profile setup expired');
  const account = saveAccount(pending.account);
  accountUsage.invalidate(account.id);
  return publicAccount(account);
});
ipcMain.handle('link-local-profile', async (event, provider, directory) => {
  if (!['claude', 'codex'].includes(provider)) return { success: false, code: 'INVALID_PROVIDER' };
  try {
    if (directory) {
      const known = await discoverLocalProfiles();
      if (!known.some((profile) => profile.provider === provider && profile.configDir === directory)) return { success: false, code: 'UNKNOWN_PROFILE' };
    } else {
      const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'showHiddenFiles'] });
      if (result.canceled) return { canceled: true };
      directory = result.filePaths[0];
    }
    const account = await linkLocalProfile(provider, directory);
    for (const [key, value] of pendingProfiles) if (Date.now() - value.createdAt > 60000) pendingProfiles.delete(key);
    if (pendingProfiles.size >= 32) pendingProfiles.delete(pendingProfiles.keys().next().value);
    const ticket = randomUUID();
    pendingProfiles.set(ticket, { account, createdAt: Date.now() });
    return { success: true, ticket, account: publicAccount(account) };
  } catch {
    return { success: false, code: 'PROFILE_UNAVAILABLE' };
  }
});
ipcMain.handle('fetch-all-usage', () => accountUsage.refreshAll());

// Validate a sessionKey by fetching org ID via hidden BrowserWindow
ipcMain.handle('validate-session-key', async (event, sessionKey) => {
  const validationSession = session.fromPartition(`validation-${randomUUID()}`);
  try {
    // Set the cookie in Electron's session first
    await setSessionCookie(sessionKey, validationSession);

    // Fetch organizations using hidden BrowserWindow (bypasses Cloudflare)
    const data = await fetchViaWindow('https://claude.ai/api/organizations', { browserSession: validationSession });

    if (data && Array.isArray(data) && data.length > 0) {
      const orgId = data[0].uuid || data[0].id;
      debugLog('Session key validated, org ID:', orgId);
      return { success: true, organizationId: orgId };
    }

    // Check if it's an error response
    if (data && data.error) {
      return { success: false, error: data.error.message || data.error };
    }

    return { success: false, error: 'No organization found' };
  } catch (error) {
    console.error('Session key validation failed:', error.message);
    // Clean up the invalid cookie
    return { success: false, error: 'Unable to validate session' };
  } finally {
    await validationSession.clearStorageData();
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    // macOS: minimize to Dock so the user can restore via Dock click
    // Windows/Linux: hide to tray (taskbar may be hidden, tray is the restore path)
    if (process.platform === 'darwin') {
      mainWindow.minimize();
    } else {
      mainWindow.hide();
    }
  }
});

ipcMain.on('close-window', () => {
  if (mainWindow) {
    if (process.platform === 'darwin') {
      mainWindow.hide();
    } else {
      mainWindow.hide();
    }
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

let _settingsModeActive = false;

ipcMain.on('resize-window', (event, height) => {
  if (!mainWindow) return;
  const { screen } = require('electron');
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const maxH = Math.max(200, display.workArea.height - 40);
  const clamped = Math.min(height, maxH);
  const compact = store.get('settings.compactMode', false);
  const width = _settingsModeActive ? WIDGET_WIDTH : (compact ? WIDGET_COMPACT_WIDTH : WIDGET_WIDTH);
  mainWindow.setContentSize(width, clamped);
  if (compact && !_settingsModeActive && tray) {
    anchorAboveTray(tray.getBounds());
  } else {
    recoverWindow();
  }
});

ipcMain.on('set-settings-window', (event, on) => {
  if (!mainWindow) return;
  const compact = store.get('settings.compactMode', false);
  const { screen } = require('electron');
  if (on) {
    if (!_settingsModeActive && !compact) settingsReturnBounds = mainWindow.getBounds();
    _settingsModeActive = true;
    const area = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
    mainWindow.setMovable(true);
    mainWindow.setBounds(fitWindowBounds({ ...mainWindow.getBounds(), width: WIDGET_WIDTH, height: 640 }, area));
    if (compact && tray) anchorAboveTray();
  } else {
    if (!compact && settingsReturnBounds) {
      const area = screen.getDisplayMatching(settingsReturnBounds).workArea;
      mainWindow.setBounds(fitWindowBounds(settingsReturnBounds, area));
      mainWindow.setMovable(true);
      settingsReturnBounds = null;
    } else if (compact) {
      applyCompactWindowMode(true);
    }
    _settingsModeActive = false;
  }
});

ipcMain.handle('get-window-position', () => {
  if (mainWindow) {
    return mainWindow.getBounds();
  }
  return null;
});

ipcMain.handle('set-window-position', (event, { x, y }) => {
  if (mainWindow) {
    mainWindow.setPosition(x, y);
    return true;
  }
  return false;
});

ipcMain.on('open-external', (event, url) => {
  // Trust boundary enforcement: duplicate allowlist check in main process
  const allowedDomains = ['claude.ai', 'chatgpt.com', 'github.com', 'paypal.me', 'platform.openai.com'];
  try {
    const parsedUrl = new URL(url);
    const isAllowed = allowedDomains.some(domain => 
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith('.' + domain)
    );
    if (isAllowed) {
      shell.openExternal(url);
    } else {
      console.warn(`[Security] Blocked openExternal call to disallowed domain: ${parsedUrl.hostname}`);
    }
  } catch (err) {
    console.warn(`[Security] Blocked openExternal call with invalid URL: ${url}`);
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-history-sources', () => historySources(store.get('usageHistory', []), loadAccounts(), store.get('historyArchives', {})));
ipcMain.handle('get-history-source', (event, id) => historyForSource(store.get('usageHistory', []), id));
ipcMain.handle('get-storage-info', () => {
  const fs = require('fs');
  let storeBytes = 0;
  try { storeBytes = fs.statSync(store.path).size; } catch {}
  const history = activeHistory();
  const historyCount = Array.isArray(history) ? history.length : 0;
  const historyBytes = Buffer.byteLength(JSON.stringify(history), 'utf8');
  return {
    userData: app.getPath('userData'),
    storeFile: store.path,
    storeBytes,
    historyBytes,
    historyCount
  };
});

ipcMain.handle('prune-history', (event, days) => {
  const n = Math.max(1, Math.floor(days || 0));
  const cutoff = Date.now() - n * 24 * 60 * 60 * 1000;
  const history = activeHistory();
  const kept = Array.isArray(history) ? history.filter((e) => e.timestamp >= cutoff) : [];
  store.set('usageHistory', [...removeAccountHistory(store.get('usageHistory', []), accountStore.active()?.id || 'default'), ...kept]);
  return { kept: kept.length, removed: (history.length || 0) - kept.length };
});

ipcMain.handle('clear-history', () => {
  store.set('usageHistory', removeAccountHistory(store.get('usageHistory', []), accountStore.active()?.id || 'default'));
  return true;
});

ipcMain.handle('export-history', async (event, options = {}) => {
  const format = options.format === 'json' ? 'json' : 'csv';
  const history = options.source ? historyForSource(store.get('usageHistory', []), options.source) : activeHistory();
  const fromMs = Number.isFinite(options.fromMs) ? options.fromMs : null;
  const toMs = Number.isFinite(options.toMs) ? options.toMs : null;
  const filtered = (fromMs != null || toMs != null)
    ? historyShared.filterByRange(history, fromMs != null ? fromMs : -Infinity, toMs != null ? toMs : Infinity)
    : history;
  const data = format === 'json'
    ? JSON.stringify(historyShared.toJSON(filtered), null, 2)
    : historyShared.toCSV(filtered);
  const rangeTag = (fromMs != null || toMs != null) ? '-range' : '';
  const defaultName = `claude-usage-history-${new Date().toISOString().slice(0, 10)}${rangeTag}.${format}`;
  const result = await dialog.showSaveDialog(mainWindow || undefined, {
    title: t('dialog.exportTitle'),
    defaultPath: defaultName,
    filters: format === 'json'
      ? [{ name: 'JSON', extensions: ['json'] }]
      : [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  fs.writeFileSync(result.filePath, data, 'utf8');
  return { canceled: false, filePath: result.filePath, rows: Array.isArray(filtered) ? filtered.length : 0 };
});

ipcMain.on('open-path', (event, target) => {
  const { shell } = require('electron');
  if (typeof target === 'string' && target.length > 0) {
    shell.openPath(target);
  }
});

ipcMain.handle('get-usage-history', () => {
  const history = activeHistory();
  const cutoff = Date.now() - (CHART_DAYS * 24 * 60 * 60 * 1000);
  return history
    .filter((entry) => entry.timestamp > cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);
});

// Range-scoped history fetch for the detail table.
// rangeMs: positive number = last N ms; 0 or null = full retained history.
ipcMain.handle('get-usage-history-range', (event, rangeMs) => {
  const history = activeHistory();
  if (!rangeMs || rangeMs <= 0) {
    return [...history].sort((a, b) => a.timestamp - b.timestamp);
  }
  const cutoff = Date.now() - rangeMs;
  return history
    .filter((entry) => entry.timestamp > cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);
});

// Absolute window fetch: inclusive [fromMs, toMs].
// Either bound may be null/undefined meaning "open on that side".
ipcMain.handle('get-usage-history-window', (event, fromMs, toMs) => {
  const history = activeHistory();
  const lo = Number.isFinite(fromMs) ? fromMs : -Infinity;
  const hi = Number.isFinite(toMs) ? toMs : Infinity;
  return history
    .filter((entry) => entry.timestamp >= lo && entry.timestamp <= hi)
    .sort((a, b) => a.timestamp - b.timestamp);
});

// Show a native OS desktop notification (Windows toast, macOS NC, Linux libnotify)
ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body, silent: false });
    n.show();
  }
});

// Resize window for compact vs normal mode
// Compact: 290px wide, normal: 530px wide. Height stays managed by renderer.
ipcMain.on('set-compact-mode', (event, compact) => {
  if (!mainWindow) return;
  const wasCompact = store.get('settings.compactMode', false);
  store.set('settings.compactMode', !!compact);
  applyCompactWindowMode(!!compact);
  if (wasCompact && !compact) {
    recoverWindow();
    mainWindow.focus();
  }
});

function getHistoryPolicy() {
  return store.get('historyPolicies', {})[accountStore.active()?.id] || { enabled: false, days: 30 };
}
function applyAutoPrune() {
  const history = store.get('usageHistory', []);
  const kept = applyHistoryPolicies(history, store.get('historyPolicies', {}));
  if (kept.length !== history.length) store.set('usageHistory', kept);
}

// Settings handlers
ipcMain.handle('save-appearance', (event, patch = {}) => {
  const settings = normalizeSettings(patch);
  for (const key of ['theme', 'themeStyle']) if (key in patch) store.set(`settings.${key}`, settings[key]);
  applyNativeAppearance();
  return true;
});
ipcMain.handle('get-settings', () => {
  return {
    autoStart: store.get('settings.autoStart', false),
    alwaysOnTop: store.get('settings.alwaysOnTop', true),
    theme: store.get('settings.theme', process.platform === 'darwin' ? 'system' : 'dark'),
    themeStyle: store.get('settings.themeStyle', process.platform === 'darwin' ? 'glass' : 'classic'),
    trayStyle: store.get('settings.trayStyle', 'bigNumber'),
    trayShowLogo: store.get('settings.trayShowLogo', false),
    trayMascotInterval: store.get('settings.trayMascotInterval', 2),
    trayMascotGap: store.get('settings.trayMascotGap', 10),
    warnThreshold: store.get('settings.warnThreshold', 75),
    dangerThreshold: store.get('settings.dangerThreshold', 90),
    timeFormat: store.get('settings.timeFormat', '12h'),
    weeklyDateFormat: store.get('settings.weeklyDateFormat', 'date'),
    usageAlerts: store.get('settings.usageAlerts', true),
    compactMode: store.get('settings.compactMode', false),
    refreshInterval: store.get('settings.refreshInterval', '300'),
    graphVisible: store.get('settings.graphVisible', false),
    expandedOpen: store.get('settings.expandedOpen', false),
    historyVisible: store.get('settings.historyVisible', false),
    autoPrune: getHistoryPolicy().enabled,
    autoPruneDays: getHistoryPolicy().days,
    hideFromTaskbar: store.get('settings.hideFromTaskbar', false),
    headlessMode: store.get('settings.headlessMode', false),
    language: store.get('settings.language', 'tr')
  };
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings.autoStart', settings.autoStart);
  store.set('settings.alwaysOnTop', settings.alwaysOnTop);
  store.set('settings.theme', settings.theme);
  if (settings.themeStyle) store.set('settings.themeStyle', settings.themeStyle);
  if (settings.trayStyle) store.set('settings.trayStyle', settings.trayStyle);
  store.set('settings.trayShowLogo', !!settings.trayShowLogo);
  if (Number.isFinite(settings.trayMascotInterval)) {
    const sec = Math.max(1, Math.min(60, Math.round(settings.trayMascotInterval)));
    store.set('settings.trayMascotInterval', sec);
  }
  if (Number.isFinite(settings.trayMascotGap)) {
    const gap = Math.max(0, Math.min(600, Math.round(settings.trayMascotGap)));
    store.set('settings.trayMascotGap', gap);
  }
  store.set('settings.warnThreshold', settings.warnThreshold);
  store.set('settings.dangerThreshold', settings.dangerThreshold);
  store.set('settings.timeFormat', settings.timeFormat);
  store.set('settings.weeklyDateFormat', settings.weeklyDateFormat);
  store.set('settings.usageAlerts', settings.usageAlerts);
  store.set('settings.compactMode', settings.compactMode);
  store.set('settings.refreshInterval', settings.refreshInterval);
  store.set('settings.graphVisible', settings.graphVisible);
  store.set('settings.expandedOpen', settings.expandedOpen);
  store.set('settings.historyVisible', settings.historyVisible);
  const accountId = accountStore.active()?.id;
  if (accountId) store.set('historyPolicies', { ...store.get('historyPolicies', {}), [accountId]: { enabled: !!settings.autoPrune, days: Math.max(1, Math.floor(settings.autoPruneDays || 30)) } });
  store.set('settings.hideFromTaskbar', !!settings.hideFromTaskbar);
  store.set('settings.headlessMode', !!settings.headlessMode);
  if (settings.language) store.set('settings.language', settings.language);
  applyTaskbarVisibility();
  applyNativeAppearance();

  applyAutoPrune();

  // openAtLogin is not supported on Linux — Electron silently ignores it.
  // Skip the call entirely to avoid misleading behaviour.
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({
      openAtLogin: settings.autoStart,
      ...(process.platform !== 'darwin' && { path: app.getPath('exe') })
    });
  }

  if (mainWindow) {
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  }

  return true;
});

ipcMain.handle('get-language', () => {
  return store.get('settings.language', 'tr');
});

ipcMain.handle('set-language', (event, lang) => {
  const accepted = setLanguage(lang);
  if (!accepted) return { ok: false };
  store.set('settings.language', lang);
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('language-changed', lang);
  }
  try {
    if (tray && !tray.isDestroyed?.()) {
      if (process.platform !== 'darwin') tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate()));
      tray.setToolTip(t('tray.tooltip'));
    }
  } catch (err) {
    console.warn('[i18n] tray rebuild failed:', err.message);
  }
  return { ok: true };
});

// Open a visible BrowserWindow for the user to log in to Claude.ai.
//
// Why we don't embed login directly in the app:
// Claude.ai (via Cloudflare) detects and blocks Electron-embedded logins.
// Instead, we open a standalone browser window, let the user authenticate
// normally, then capture the sessionKey cookie once login completes.
// Do NOT attempt to "fix" this back to an embedded login without verifying
// that Claude.ai/Cloudflare no longer blocks it.
ipcMain.handle('detect-session-key', async () => {
  const loginSession = session.fromPartition(`login-${randomUUID()}`);
  loginSession.setUserAgent(CHROME_USER_AGENT);
  return new Promise((resolve) => {
    const loginWin = new BrowserWindow({
      width: 1000,
      height: 700,
      title: t('dialog.loginTitle'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: loginSession
      }
    });

    let resolved = false;

    // Listen for sessionKey cookie being set after login
    const onCookieChanged = (event, cookie, cause, removed) => {
      if (
        cookie.name === 'sessionKey' &&
        cookie.domain.includes('claude.ai') &&
        !removed &&
        cookie.value
      ) {
        resolved = true;
        loginSession.cookies.removeListener('changed', onCookieChanged);
        loginWin.close();
        resolve({ success: true, sessionKey: cookie.value });
      }
    };

    loginSession.cookies.on('changed', onCookieChanged);

    loginWin.on('closed', () => {
      loginSession.clearStorageData().catch(() => {});
      loginSession.cookies.removeListener('changed', onCookieChanged);
      if (!resolved) {
        resolve({ success: false, error: 'Login window closed' });
      }
    });

    loginWin.loadURL('https://claude.ai/login');
  });
});

// Check GitHub releases for a newer version.
// Scans the full releases list (including prereleases) and picks the
// highest semver, so fork tags like 1.11.0-gtrows.1 are compared
// correctly even when they are published as prereleases.
ipcMain.handle('check-for-update', () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=20`,
      method: 'GET',
      headers: {
        'User-Agent': 'claude-usage-widget',
        'Accept': 'application/vnd.github+json'
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!Array.isArray(data)) {
            resolve({ ok: false, hasUpdate: false, version: null, releaseUrl: null });
            return;
          }
          const current = app.getVersion();
          const latestRelease = pickLatestRelease(data);
          if (latestRelease && isNewerVersion(latestRelease.version, current)) {
            resolve({
              ok: true,
              hasUpdate: true,
              version: latestRelease.version,
              releaseUrl: latestRelease.releaseUrl
            });
          } else {
            resolve({ ok: true, hasUpdate: false, version: null, releaseUrl: null });
          }
        } catch {
          resolve({ ok: false, hasUpdate: false, version: null, releaseUrl: null });
        }
      });
    });

    req.on('error', () => resolve({ ok: false, hasUpdate: false, version: null, releaseUrl: null }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, hasUpdate: false, version: null, releaseUrl: null }); });
    req.end();
  });
});

async function fetchAccountUsage(activeAccount) {

  if (!hasUsableCredentials(activeAccount)) {
    throw new Error('Missing credentials');
  }

  if (activeAccount.authType === 'local') return fetchLocalUsage(activeAccount);
  if (activeAccount.provider === 'codex') return fetchCodexUsage(activeAccount);

  const { sessionKey, organizationId } = activeAccount;

  // Ensure cookie is set
  const browserSession = session.fromPartition(`persist:account-${activeAccount.id}`);
  await setSessionCookie(sessionKey, browserSession);

  const usageUrl = `https://claude.ai/api/organizations/${organizationId}/usage`;
  const overageUrl = `https://claude.ai/api/organizations/${organizationId}/overage_spend_limit`;
  const prepaidUrl = `https://claude.ai/api/organizations/${organizationId}/prepaid/credits`;

  // Fetch all endpoints in parallel. Usage is required; overage and prepaid are optional.
  const [usageResult, overageResult, prepaidResult] = await Promise.allSettled([
    fetchViaWindow(usageUrl, { browserSession }),
    fetchViaWindow(overageUrl, { browserSession }),
    fetchViaWindow(prepaidUrl, { browserSession })
  ]);

  // Usage endpoint is mandatory
  if (usageResult.status === 'rejected') {
    const error = usageResult.reason;
    debugLog('API request failed:', error.message);
    throw error;
  }

  const data = usageResult.value;
  if (!data || data.error) throw new Error('SessionExpired');

  // Merge overage spending data into data.extra_usage
  if (overageResult.status === 'fulfilled' && overageResult.value) {
    const overage = overageResult.value;
    const limit = overage.monthly_credit_limit ?? overage.spend_limit_amount_cents;
    const used = overage.used_credits ?? overage.balance_cents;
    const enabled = overage.is_enabled !== undefined ? overage.is_enabled : (limit != null);

    if (enabled && typeof limit === 'number' && limit > 0 && typeof used === 'number') {
      data.extra_usage = {
        utilization: (used / limit) * 100,
        resets_at: null,
        used_cents: used,
        limit_cents: limit,
        is_enabled: true,
        currency: overage.currency || 'USD',
      };
    } else if (!enabled) {
      // Extra usage is off — still pass the flag so the renderer can show status
      if (!data.extra_usage) data.extra_usage = {};
      data.extra_usage.is_enabled = false;
      data.extra_usage.currency = overage.currency || 'USD';
    }
  } else {
    debugLog('Overage fetch skipped or failed:', overageResult.reason?.message || 'no data');
  }

  // Merge prepaid balance into data.extra_usage
  if (prepaidResult.status === 'fulfilled' && prepaidResult.value) {
    const prepaid = prepaidResult.value;
    if (typeof prepaid.amount === 'number') {
      if (!data.extra_usage) data.extra_usage = {};
      data.extra_usage.balance_cents = prepaid.amount;
      // Use prepaid currency if overage didn't already set one
      if (!data.extra_usage.currency && prepaid.currency) {
        data.extra_usage.currency = prepaid.currency;
      }
    }
  } else {
    debugLog('Prepaid fetch skipped or failed:', prepaidResult.reason?.message || 'no data');
  }


  // Re-assert always-on-top after hidden BrowserWindows from fetchViaWindow
  // are destroyed — creating/destroying BrowserWindows can temporarily disrupt
  // the main window's z-order on some OS/window manager combinations.
  if (mainWindow && !mainWindow.isDestroyed()) {
    const alwaysOnTop = store.get('settings.alwaysOnTop', true);
    if (alwaysOnTop) {
      mainWindow.setAlwaysOnTop(true, 'floating');
    }
  }

  return data;
}

const accountUsage = createAccountUsage({
  getAccounts: loadAccounts, fetchUsage: fetchAccountUsage, recordHistory: storeUsageHistory,
  onUpdate: (snapshot) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('account-usage-updated', snapshot); }
});
ipcMain.handle('fetch-usage-data', async () => {
  const snapshot = await accountUsage.refreshAccount(accountStore.active()?.id);
  if (!snapshot?.data) throw new Error(snapshot?.error?.code || 'Missing credentials');
  return snapshot.data;
});

// Renderer pushes pre-rendered tray icon frames (one per metric).
// Each frame: { dataURL: string, tooltip: string }. Main cycles them.
function applyTrayFrame(index) {
  if (!tray || tray.isDestroyed?.()) return;
  if (!trayIconFrames.length) {
    if (defaultTrayImage) tray.setImage(defaultTrayImage);
    tray.setToolTip(t('tray.tooltip'));
    if (process.platform === 'darwin') tray.setTitle('');
    return;
  }
  const frame = trayIconFrames[index % trayIconFrames.length];
  try {
    const img = nativeImage.createFromDataURL(frame.dataURL);
    if (!img.isEmpty()) tray.setImage(img);
  } catch (err) {
    debugLog('Failed to apply tray frame:', err.message);
  }
  if (frame.tooltip) tray.setToolTip(frame.tooltip);
  if (process.platform === 'darwin') tray.setTitle(frame.title || '');
}

function startTrayCycle() {
  if (trayIconTimer) clearTimeout(trayIconTimer);
  if (trayIconFrames.length <= 1) return;
  const step = () => {
    trayIconIndex = (trayIconIndex + 1) % trayIconFrames.length;
    applyTrayFrame(trayIconIndex);
    const current = trayIconFrames[trayIconIndex];
    const delay = Math.max(80, Math.min(600000, Number(current && current.duration) || 3000));
    trayIconTimer = setTimeout(step, delay);
  };
  const first = trayIconFrames[trayIconIndex];
  const firstDelay = Math.max(80, Math.min(10000, Number(first && first.duration) || 3000));
  trayIconTimer = setTimeout(step, firstDelay);
}

ipcMain.on('set-tray-frames', (event, frames) => {
  trayIconFrames = Array.isArray(frames) ? frames.filter(f => f && f.dataURL) : [];
  trayIconIndex = 0;
  applyTrayFrame(0);
  startTrayCycle();
});

// App lifecycle
app.whenReady().then(async () => {
  setLanguage(store.get('settings.language', 'tr'));

  // Disable default application menu so its accelerators (Ctrl+R reload,
  // Ctrl+Shift+I devtools, etc.) don't collide with widget shortcuts.
  Menu.setApplicationMenu(null);

  accountStore.load();

  if (!store.has('historyPolicies')) {
    const activeId = accountStore.active()?.id;
    store.set('historyPolicies', activeId ? { [activeId]: { enabled: store.get('settings.autoPrune', false), days: store.get('settings.autoPruneDays', 30) } } : {});
  }
  applyAutoPrune();

  const headlessMode = store.get('settings.headlessMode', false);
  createMainWindow();
  createTray();
  const { screen } = require('electron');
  for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(event, recoverWindow);

  // Apply persisted settings
  const alwaysOnTop = store.get('settings.alwaysOnTop', true);
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(alwaysOnTop, 'floating');
  }
  if (store.get('settings.compactMode', false)) {
    applyCompactWindowMode(true);
  }
  if (headlessMode && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
  applyTaskbarVisibility();

  // Periodic always-on-top re-assertion to recover from z-order disruptions
  // (hidden window spawns, window manager shortcuts, alt-tab, etc.)
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const alwaysOnTopSetting = store.get('settings.alwaysOnTop', true);
      if (alwaysOnTopSetting) {
        mainWindow.setAlwaysOnTop(true, 'floating');
      }
    }
  }, 5000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray
  }
});

app.on('activate', showMainWindow);

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);
}
