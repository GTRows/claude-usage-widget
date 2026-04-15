const SETTINGS_DEFAULTS = {
  autoStart: false,
  alwaysOnTop: true,
  theme: 'dark',
  themeStyle: 'classic',
  trayStyle: 'bigNumber',
  trayShowLogo: false,
  trayMascotInterval: 2,
  warnThreshold: 75,
  dangerThreshold: 90,
  timeFormat: '12h',
  weeklyDateFormat: 'date',
  usageAlerts: true,
  compactMode: false,
  refreshInterval: 300,
  graphVisible: false,
  expandedOpen: false,
  historyVisible: false,
  autoPrune: false,
  autoPruneDays: 30,
  hideFromTaskbar: false,
  headlessMode: false,
  activeProfile: 'default',
};

const ENUM_VALUES = {
  theme: ['dark', 'light', 'system'],
  themeStyle: ['classic', 'plate', 'nord', 'sunset', 'mono'],
  trayStyle: ['bigNumber', 'ring', 'bar', 'dot'],
  timeFormat: ['12h', '24h'],
  weeklyDateFormat: ['date', 'date-day', 'date-day-time'],
};

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeSettings(input = {}) {
  const out = { ...SETTINGS_DEFAULTS };
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    if (!(key in input)) continue;
    const def = SETTINGS_DEFAULTS[key];
    const value = input[key];
    if (typeof def === 'boolean') {
      out[key] = Boolean(value);
    } else if (typeof def === 'number') {
      out[key] = Number.isFinite(Number(value)) ? Number(value) : def;
    } else if (key in ENUM_VALUES) {
      out[key] = ENUM_VALUES[key].includes(value) ? value : def;
    } else {
      out[key] = value == null ? def : String(value);
    }
  }
  out.warnThreshold = clampInt(out.warnThreshold, 1, 99, SETTINGS_DEFAULTS.warnThreshold);
  out.dangerThreshold = clampInt(out.dangerThreshold, 1, 99, SETTINGS_DEFAULTS.dangerThreshold);
  if (out.dangerThreshold < out.warnThreshold) out.dangerThreshold = out.warnThreshold;
  out.refreshInterval = clampInt(out.refreshInterval, 15, 86400, SETTINGS_DEFAULTS.refreshInterval);
  out.autoPruneDays = clampInt(out.autoPruneDays, 1, 3650, SETTINGS_DEFAULTS.autoPruneDays);
  out.trayMascotInterval = clampInt(out.trayMascotInterval, 1, 60, SETTINGS_DEFAULTS.trayMascotInterval);
  if (typeof out.activeProfile !== 'string' || !out.activeProfile) {
    out.activeProfile = 'default';
  }
  return out;
}

module.exports = { SETTINGS_DEFAULTS, ENUM_VALUES, normalizeSettings, clampInt };
