const fs = require('fs');
const path = require('path');
const os = require('os');

function getWidgetUserDataDir(productName = 'claude-usage-widget') {
  if (process.env.CLAUDE_USAGE_WIDGET_DIR) return process.env.CLAUDE_USAGE_WIDGET_DIR;
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, productName);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', productName);
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, productName);
}

function getWidgetStorePath(productName) {
  return path.join(getWidgetUserDataDir(productName), 'config.json');
}

function readWidgetStore(productName) {
  const p = getWidgetStorePath(productName);
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    return (data && typeof data === 'object') ? data : {};
  } catch {
    return null;
  }
}

function readWidgetHistory(productName) {
  const data = readWidgetStore(productName);
  if (!data) return null;
  const history = data.usageHistory;
  if (!Array.isArray(history)) return [];
  return history;
}

module.exports = {
  getWidgetUserDataDir,
  getWidgetStorePath,
  readWidgetStore,
  readWidgetHistory,
};
