const DEFAULT_WARN = 75;
const DEFAULT_DANGER = 90;
const DEFAULT_DEAD = 100;

function clampThreshold(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeThresholds(input = {}) {
  const warn = clampThreshold(input.warn, DEFAULT_WARN);
  let danger = clampThreshold(input.danger, DEFAULT_DANGER);
  if (danger < warn) danger = warn;
  return { warn, danger, dead: DEFAULT_DEAD };
}

function statusForPercent(percent, thresholds = {}) {
  const t = normalizeThresholds(thresholds);
  const p = Number(percent);
  if (!Number.isFinite(p) || p <= 0) return 'zero';
  if (p >= t.dead) return 'dead';
  if (p >= t.danger) return 'danger';
  if (p >= t.warn) return 'warn';
  return 'low';
}

function statusColor(status) {
  switch (status) {
    case 'dead': return '#d23a3a';
    case 'danger': return '#e0533a';
    case 'warn': return '#e0a13a';
    case 'low': return '#3aa15a';
    case 'zero':
    default: return '#7a7a7a';
  }
}

module.exports = {
  DEFAULT_WARN,
  DEFAULT_DANGER,
  DEFAULT_DEAD,
  clampThreshold,
  normalizeThresholds,
  statusForPercent,
  statusColor,
};
