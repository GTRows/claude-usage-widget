export function filterSavedHistory(rows, { rangeMs = 0, from = null, to = null, custom = false, now = Date.now() } = {}) {
  const low = custom ? (from ?? -Infinity) : rangeMs > 0 ? now - rangeMs : -Infinity;
  const high = custom ? (to ?? Infinity) : Infinity;
  return rows.filter((row) => Number.isFinite(row.timestamp) && row.timestamp >= low && row.timestamp <= high).sort((a, b) => a.timestamp - b.timestamp);
}

export function createSavedHistory({ api, t, onView, onBack }) {
  const byId = (id) => document.getElementById(id);
  let sources = [];
  async function refresh() {
    sources = await api.getHistorySources();
    const select = byId('savedHistorySelect');
    const selected = select.value;
    select.replaceChildren();
    for (const source of sources) {
      const option = document.createElement('option');
      option.value = source.id;
      option.textContent = source.legacy ? t('accounts.legacyHistory') : source.label;
      select.append(option);
    }
    if (sources.some((source) => source.id === selected)) select.value = selected;
    byId('savedHistoryControls').hidden = sources.length === 0;
  }
  byId('viewSavedHistoryBtn').addEventListener('click', () => {
    const source = sources.find((item) => item.id === byId('savedHistorySelect').value);
    if (source) onView({ ...source, label: source.legacy ? t('accounts.legacyHistory') : source.label });
  });
  byId('exportSavedHistoryBtn').addEventListener('click', () => {
    if (byId('savedHistorySelect').value) api.exportHistory('json', { source: byId('savedHistorySelect').value });
  });
  byId('closeArchiveHistoryBtn').addEventListener('click', onBack);
  return { refresh };
}
