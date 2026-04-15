const fs = require('fs');
const path = require('path');
const os = require('os');

function getConfigDir() {
  if (process.env.CLAUDE_USAGE_CONFIG_DIR) {
    return process.env.CLAUDE_USAGE_CONFIG_DIR;
  }
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'claude-usage-cli');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'claude-usage-cli');
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, 'claude-usage');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function readConfig() {
  const p = getConfigPath();
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  const current = readConfig();
  const next = { ...current, ...patch };
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  return next;
}

function loadCredentials() {
  const fromEnv = {
    sessionKey: process.env.CLAUDE_SESSION_KEY || null,
    organizationId: process.env.CLAUDE_ORGANIZATION_ID || null,
  };
  if (fromEnv.sessionKey && fromEnv.organizationId) return fromEnv;
  const cfg = readConfig();
  return {
    sessionKey: fromEnv.sessionKey || cfg.sessionKey || null,
    organizationId: fromEnv.organizationId || cfg.organizationId || null,
  };
}

module.exports = {
  getConfigDir,
  getConfigPath,
  readConfig,
  writeConfig,
  loadCredentials,
};
