const { contextBridge, ipcRenderer } = require('electron');

// Allowed domains for openExternal — prevents renderer from opening arbitrary URLs
const ALLOWED_EXTERNAL_DOMAINS = [
  'claude.ai',
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
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),
  validateSessionKey: (sessionKey) => ipcRenderer.invoke('validate-session-key', sessionKey),
  detectSessionKey: () => ipcRenderer.invoke('detect-session-key'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  resizeWindow: (height) => ipcRenderer.send('resize-window', height),

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
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Updates
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Peak-hour throttle (session limits drain faster in the peak window)
  getPeakThrottleStatus: () => ipcRenderer.invoke('get-peak-throttle-status'),

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
