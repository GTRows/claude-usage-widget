const { contextBridge, ipcRenderer } = require('electron');

// Allowed domains for openExternal — prevents renderer from opening arbitrary URLs
const ALLOWED_EXTERNAL_DOMAINS = [
  'claude.ai',
  'chatgpt.com',
  'platform.openai.com',
  'github.com'
];

function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_EXTERNAL_DOMAINS.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Credentials management
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
  deleteCredentials: (accountId) => ipcRenderer.invoke('delete-credentials', accountId),
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  renameAccount: (id, label) => ipcRenderer.invoke('rename-account', id, label),
  discoverLocalProfiles: () => ipcRenderer.invoke('discover-local-profiles'),
  linkLocalProfile: (provider, directory) => ipcRenderer.invoke('link-local-profile', provider, directory),
  saveLocalProfile: (ticket) => ipcRenderer.invoke('save-local-profile', ticket),
  getHistorySources: () => ipcRenderer.invoke('get-history-sources'),
  getHistorySource: (source) => ipcRenderer.invoke('get-history-source', source),
  fetchAllUsage: () => ipcRenderer.invoke('fetch-all-usage'),
  onAccountUsageUpdated: (callback) => ipcRenderer.on('account-usage-updated', (_event, snapshot) => callback(snapshot)),
  setActiveAccount: (accountId) => ipcRenderer.invoke('set-active-account', accountId),
  validateSessionKey: (sessionKey) => ipcRenderer.invoke('validate-session-key', sessionKey),
  detectSessionKey: () => ipcRenderer.invoke('detect-session-key'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  quitApp: () => ipcRenderer.send('quit-app'),
  fitContentHeight: (height) => ipcRenderer.send('fit-content-height', height),

  // Window position
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setWindowPosition: (position) => ipcRenderer.invoke('set-window-position', position),

  // Event listeners
  onRefreshUsage: (callback) => {
    ipcRenderer.on('refresh-usage', () => callback());
  },
  onSessionExpired: (callback) => {
    ipcRenderer.on('session-expired', () => callback());
  },

  // API
  fetchUsageData: () => ipcRenderer.invoke('fetch-usage-data'),
  getUsageHistory: () => ipcRenderer.invoke('get-usage-history'),
  getUsageHistoryRange: (rangeMs) => ipcRenderer.invoke('get-usage-history-range', rangeMs),
  getUsageHistoryWindow: (fromMs, toMs) => ipcRenderer.invoke('get-usage-history-window', fromMs, toMs),
  openExternal: (url) => {
    if (isAllowedExternalUrl(url)) {
      ipcRenderer.send('open-external', url);
    } else {
      console.warn('openExternal blocked — URL not in allowlist:', url);
    }
  },

  // Platform
  platform: process.platform,

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveAppearance: (patch) => ipcRenderer.invoke('save-appearance', patch),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Language
  getLanguage: () => ipcRenderer.invoke('get-language'),
  setLanguage: (lang) => ipcRenderer.invoke('set-language', lang),
  onLanguageChanged: (callback) => {
    ipcRenderer.on('language-changed', (_event, lang) => callback(lang));
  },

  // Updates
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  setUpdatePreferences: (enabled) => ipcRenderer.invoke('set-update-preferences', enabled),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update-state', listener);
    return () => ipcRenderer.removeListener('update-state', listener);
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Storage info
  getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
  pruneHistory: (days) => ipcRenderer.invoke('prune-history', days),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  exportHistory: (format, range) => ipcRenderer.invoke('export-history', { format, ...(range || {}) }),
  openPath: (target) => ipcRenderer.send('open-path', target),
  setSettingsWindow: (on) => ipcRenderer.send('set-settings-window', on),

  // Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),

  // Compact mode
  setCompactMode: (compact) => ipcRenderer.send('set-compact-mode', compact),

  // Tray icon frames (pre-rendered in renderer, cycled in main)
  setTrayFrames: (frames) => ipcRenderer.send('set-tray-frames', frames)
});
