const { statusForPercent, normalizeThresholds } = require('../shared/thresholds');
const { formatPercent, formatDuration } = require('../shared/format');

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function colorize(text, color, useColor) {
  if (!useColor) return text;
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

function colorForStatus(status) {
  switch (status) {
    case 'dead':
    case 'danger': return 'red';
    case 'warn': return 'yellow';
    case 'low': return 'green';
    default: return 'gray';
  }
}

function bar(percent, width = 20, useColor = true) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((p / 100) * width);
  const empty = width - filled;
  const status = statusForPercent(p);
  const color = colorForStatus(status);
  const inner = '#'.repeat(filled) + '-'.repeat(empty);
  return `[${colorize(inner, color, useColor)}]`;
}

function pickPercent(data, key) {
  if (!data) return 0;
  if (typeof data[key] === 'number') return data[key];
  if (data[key] && typeof data[key].utilization === 'number') return data[key].utilization;
  return 0;
}

function pickResetMs(data, key) {
  const node = data && data[key];
  if (!node) return null;
  const at = node.resets_at || node.resetsAt;
  if (!at) return null;
  const t = Date.parse(at);
  return Number.isFinite(t) ? t : null;
}

function summary(data, opts = {}) {
  const useColor = opts.color !== false && process.stdout.isTTY;
  const thresholds = normalizeThresholds(opts.thresholds || {});
  const sessionPct = pickPercent(data, 'five_hour') || pickPercent(data, 'fiveHour') || pickPercent(data, 'session');
  const weeklyPct = pickPercent(data, 'seven_day') || pickPercent(data, 'sevenDay') || pickPercent(data, 'weekly');

  const sessionStatus = statusForPercent(sessionPct, thresholds);
  const weeklyStatus = statusForPercent(weeklyPct, thresholds);

  const sessionResetMs = pickResetMs(data, 'five_hour') || pickResetMs(data, 'fiveHour');
  const weeklyResetMs = pickResetMs(data, 'seven_day') || pickResetMs(data, 'sevenDay');

  const lines = [];
  lines.push(`${colorize('5h ', 'bold', useColor)}${bar(sessionPct, 20, useColor)} ${colorize(formatPercent(sessionPct), colorForStatus(sessionStatus), useColor)}` +
    (sessionResetMs ? colorize(`  resets in ${formatDuration(sessionResetMs - Date.now())}`, 'dim', useColor) : ''));
  lines.push(`${colorize('7d ', 'bold', useColor)}${bar(weeklyPct, 20, useColor)} ${colorize(formatPercent(weeklyPct), colorForStatus(weeklyStatus), useColor)}` +
    (weeklyResetMs ? colorize(`  resets in ${formatDuration(weeklyResetMs - Date.now())}`, 'dim', useColor) : ''));
  return lines.join('\n');
}

function inlinePrompt(data, opts = {}) {
  const useColor = opts.color !== false && process.stdout.isTTY;
  const thresholds = normalizeThresholds(opts.thresholds || {});
  const sessionPct = pickPercent(data, 'five_hour') || pickPercent(data, 'fiveHour') || pickPercent(data, 'session');
  const weeklyPct = pickPercent(data, 'seven_day') || pickPercent(data, 'sevenDay') || pickPercent(data, 'weekly');
  const s = statusForPercent(sessionPct, thresholds);
  const w = statusForPercent(weeklyPct, thresholds);
  return `${colorize(`5h:${formatPercent(sessionPct)}`, colorForStatus(s), useColor)} ${colorize(`7d:${formatPercent(weeklyPct)}`, colorForStatus(w), useColor)}`;
}

module.exports = { summary, inlinePrompt, bar, pickPercent };
