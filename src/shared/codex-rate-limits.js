const fs = require('fs');
const os = require('os');
const path = require('path');

const PREMIUM_EXHAUSTION_WINDOW_MS = 30 * 60 * 1000;

function codexHomeDir(customHome) {
  return customHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function resetToIso(value) {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value * 1000).toISOString();
  if (/^\d+$/.test(String(value))) return new Date(Number(value) * 1000).toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function walkJsonlFiles(root, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkJsonlFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractRateLimits(line) {
  if (!line.includes('"rate_limits"')) return null;
  const record = JSON.parse(line);
  const rateLimits = record?.payload?.rate_limits || record?.rate_limits;
  if (!rateLimits) return null;
  return {
    timestamp: record.timestamp || null,
    rateLimits,
  };
}

function entryTime(entry) {
  const time = Date.parse(entry?.timestamp || '');
  return Number.isFinite(time) ? time : 0;
}

function isCodexQuotaEntry(rateLimits) {
  return Boolean(rateLimits?.primary && (!rateLimits.limit_id || rateLimits.limit_id === 'codex'));
}

function isPremiumExhausted(rateLimits) {
  const credits = rateLimits?.credits;
  if (rateLimits?.limit_id !== 'premium' || !credits) return false;
  const balance = credits.balance == null ? null : Number(credits.balance);
  return credits.has_credits === false
    && credits.unlimited === false
    && Number.isFinite(balance)
    && balance <= 0;
}

function premiumExhaustionNear(entry, premiumEntry) {
  if (!entry || !premiumEntry) return false;
  return Math.abs(entry.time - premiumEntry.time) <= PREMIUM_EXHAUSTION_WINDOW_MS;
}

function latestCodexRateLimits(options = {}) {
  const home = codexHomeDir(options.codexHome);
  const files = [
    ...walkJsonlFiles(path.join(home, 'sessions')),
    ...walkJsonlFiles(path.join(home, 'archived_sessions')),
  ];

  let latest = null;
  let latestPremiumExhausted = null;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      try {
        const entry = extractRateLimits(line);
        if (!entry) continue;
        const time = entryTime(entry);
        const candidate = {
          time,
          file,
          ...entry,
        };
        if (isPremiumExhausted(entry.rateLimits)
          && (!latestPremiumExhausted || time >= latestPremiumExhausted.time)) {
          latestPremiumExhausted = candidate;
        }
        if (isCodexQuotaEntry(entry.rateLimits) && (!latest || time >= latest.time)) {
          latest = candidate;
        }
      } catch {
        // Ignore malformed or partially written JSONL lines.
      }
    }
  }
  if (premiumExhaustionNear(latest, latestPremiumExhausted)) {
    latest.premiumExhausted = latestPremiumExhausted;
  }
  return latest;
}

function windowFromRateLimit(limit) {
  if (!limit) return null;
  const used = clampPercent(limit.used_percent);
  const remaining = clampPercent(100 - used);
  return {
    utilization: remaining,
    remaining_percent: remaining,
    used_percent: used,
    window_minutes: limit.window_minutes || null,
    resets_at: resetToIso(limit.resets_at),
    display_mode: 'remaining',
  };
}

function normalizeCodexQuotaDisplay(mode) {
  return mode === 'remaining' ? 'remaining' : 'used';
}

function applyCodexQuotaDisplay(data, mode = 'used') {
  if (!data || data.provider !== 'codex') return data;
  const display = normalizeCodexQuotaDisplay(mode);
  const selectPercent = (node) => {
    if (!node) return node;
    const used = Number.isFinite(Number(node.used_percent))
      ? clampPercent(node.used_percent)
      : clampPercent(node.utilization);
    const remaining = Number.isFinite(Number(node.remaining_percent))
      ? clampPercent(node.remaining_percent)
      : clampPercent(100 - used);
    return {
      ...node,
      utilization: display === 'remaining' ? remaining : used,
      remaining_percent: remaining,
      used_percent: used,
      display_mode: display,
    };
  };
  return {
    ...data,
    quota_display: display,
    five_hour: selectPercent(data.five_hour),
    seven_day: selectPercent(data.seven_day),
  };
}

function usageFromCodexRateLimits(entry, options = {}) {
  if (!entry?.rateLimits?.primary) return null;
  const { rateLimits } = entry;
  let fiveHour = windowFromRateLimit(rateLimits.primary);
  if (entry.premiumExhausted && fiveHour) {
    fiveHour = {
      ...fiveHour,
      utilization: 100,
      remaining_percent: 0,
      used_percent: 100,
      premium_exhausted: true,
    };
  }
  const sevenDay = windowFromRateLimit(rateLimits.secondary);
  return applyCodexQuotaDisplay({
    provider: 'codex',
    source: 'codex-local-rate-limits',
    five_hour: fiveHour,
    seven_day: sevenDay || {
      utilization: 0,
      remaining_percent: 0,
      used_percent: 0,
      window_minutes: null,
      resets_at: null,
      display_mode: 'used',
    },
    codex_usage: {
      plan_type: rateLimits.plan_type || null,
      limit_id: rateLimits.limit_id || null,
      limit_name: rateLimits.limit_name || null,
      rate_limit_reached_type: rateLimits.rate_limit_reached_type || null,
      source_file: entry.file || null,
      observed_at: entry.timestamp || null,
      premium_exhausted: Boolean(entry.premiumExhausted),
      premium_observed_at: entry.premiumExhausted?.timestamp || null,
      premium_source_file: entry.premiumExhausted?.file || null,
    },
  }, options.displayMode);
}

module.exports = {
  applyCodexQuotaDisplay,
  codexHomeDir,
  latestCodexRateLimits,
  normalizeCodexQuotaDisplay,
  usageFromCodexRateLimits,
};
