const HISTORY_FIELDS = ['session', 'weekly', 'sonnet', 'opus', 'extraUsage'];

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;
  const ts = Number(row.timestamp);
  if (!Number.isFinite(ts)) return null;
  const out = { timestamp: ts };
  for (const field of HISTORY_FIELDS) {
    const v = Number(row[field]);
    out[field] = Number.isFinite(v) ? v : null;
  }
  return out;
}

function filterByRange(history, fromMs, toMs) {
  if (!Array.isArray(history)) return [];
  const lo = Number.isFinite(fromMs) ? fromMs : -Infinity;
  const hi = Number.isFinite(toMs) ? toMs : Infinity;
  return history.filter((row) => {
    const ts = Number(row && row.timestamp);
    return Number.isFinite(ts) && ts >= lo && ts <= hi;
  });
}

function pruneOlderThan(history, cutoffMs) {
  if (!Array.isArray(history) || !Number.isFinite(cutoffMs)) return history || [];
  return history.filter((row) => Number(row && row.timestamp) >= cutoffMs);
}

function estimateSpanMs(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of entries) {
    const ts = Number(row && row.timestamp);
    if (!Number.isFinite(ts)) continue;
    if (ts < lo) lo = ts;
    if (ts > hi) hi = ts;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return 0;
  return hi - lo;
}

function toCSV(history, fields = HISTORY_FIELDS) {
  const cols = ['timestamp', 'iso', ...fields];
  const lines = [cols.join(',')];
  if (!Array.isArray(history)) return lines.join('\n');
  for (const raw of history) {
    const row = normalizeRow(raw);
    if (!row) continue;
    const iso = new Date(row.timestamp).toISOString();
    const cells = [String(row.timestamp), iso, ...fields.map((f) => row[f] == null ? '' : String(row[f]))];
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

function toJSON(history, fields = HISTORY_FIELDS) {
  if (!Array.isArray(history)) return [];
  return history
    .map(normalizeRow)
    .filter(Boolean)
    .map((row) => {
      const out = { timestamp: row.timestamp, iso: new Date(row.timestamp).toISOString() };
      for (const f of fields) out[f] = row[f];
      return out;
    });
}

module.exports = {
  HISTORY_FIELDS,
  normalizeRow,
  filterByRange,
  pruneOlderThan,
  estimateSpanMs,
  toCSV,
  toJSON,
};
