export function chartPoints(history, field) {
  return history.filter((sample) => Number.isFinite(sample.timestamp)).map((sample) => ({
    x: sample.timestamp,
    y: Number.isFinite(sample[field]) ? sample[field] : null,
  }));
}

export function quotaHistory(history, displayMode) {
  return history.map((row) => {
    if (row.provider !== 'codex' || row.apiRequests != null) return row;
    const convert = (value) => Number.isFinite(value) && (row.quotaDisplay || 'used') !== displayMode ? 100 - value : value;
    return { ...row, session: convert(row.session), weekly: convert(row.weekly), quotaDisplay: displayMode };
  });
}
