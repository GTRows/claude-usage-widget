const RELEASES_URL = 'https://github.com/GTRows/claude-usage-widget/releases';
export function presentUpdate(state, t) {
  const version = state.version;
  const status = state.status;
  const progress = Math.max(0, Math.min(100, Math.round(Number(state.percent) || 0)));
  const keys = { checking: 'checkingStatus', 'up-to-date': 'upToDate', available: 'available', downloading: 'downloading', downloaded: 'ready', installing: 'installing', error: 'failed' };
  const statusText = t(`update.${keys[status] || (version ? 'available' : 'notChecked')}`, { version, percent: progress });
  let action = null;
  if (version && !state.supported) action = 'manual';
  else if (state.supported && status === 'downloaded') action = 'install';
  else if (state.supported && version && ['available', 'error'].includes(status)) action = 'download';
  return { statusText, action, progress, supportKey: state.supported ? null : `update.support.${state.reason || 'package-manager'}` };
}
export function createUpdatePanel({ document, api, t, onChange = () => {} }) {
  const ids = ['updateBanner', 'updateBannerText', 'updateBannerDismiss', 'settingsUpdateLink', 'checkUpdatesBtn', 'checkUpdatesStatus', 'checkUpdatesTimestamp', 'updateInstallBtn', 'updateProgress', 'autoDownloadUpdates', 'updateSupportHint'];
  const nodes = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  let state = { status: 'idle', supported: false, automaticDownloads: true };
  let revision = 0;
  let dismissed = null;
  let off = () => {};
  let disposed = false;
  const handlers = [];
  function render() {
    if (disposed) return;
    const view = presentUpdate(state, t);
    const busy = ['checking', 'downloading', 'installing'].includes(state.status);
    const actionLabel = view.action === 'install' ? 'update.install' : view.action === 'manual' ? 'update.manualDownload' : 'update.download';
    nodes.checkUpdatesStatus.textContent = view.statusText;
    nodes.checkUpdatesStatus.setAttribute('role', 'status');
    nodes.checkUpdatesBtn.disabled = busy;
    nodes.checkUpdatesBtn.textContent = t(state.status === 'checking' ? 'update.checking' : 'update.checkBtn');
    nodes.updateInstallBtn.hidden = !view.action;
    nodes.updateInstallBtn.disabled = busy;
    nodes.updateInstallBtn.textContent = t(actionLabel);
    nodes.updateProgress.hidden = state.status !== 'downloading';
    nodes.updateProgress.value = view.progress;
    nodes.autoDownloadUpdates.checked = state.automaticDownloads !== false;
    nodes.autoDownloadUpdates.disabled = !state.supported;
    nodes.updateSupportHint.hidden = !view.supportKey;
    nodes.updateSupportHint.textContent = view.supportKey ? t(view.supportKey) : '';
    const visible = state.version && dismissed !== `${state.version}:${state.status}`;
    nodes.updateBanner.style.display = visible ? 'flex' : 'none';
    nodes.updateBannerText.textContent = `${view.statusText}${view.action ? ' — ' + t(actionLabel) : ''}`;
    nodes.updateBannerText.disabled = !view.action;
    nodes.settingsUpdateLink.style.display = view.action ? 'inline' : 'none';
    nodes.settingsUpdateLink.textContent = t(actionLabel);
    if (state.checkedAt) {
      const date = new Date(state.checkedAt);
      nodes.checkUpdatesTimestamp.textContent = t('update.lastChecked', { date: date.toLocaleDateString(), time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    }
    onChange(state);
  }
  function receive(snapshot) { revision++; state = { ...snapshot }; render(); }
  function bind(id, event, handler) {
    nodes[id].addEventListener(event, handler);
    handlers.push([nodes[id], event, handler]);
  }
  async function request(method, ...args) {
    const current = revision;
    try {
      const result = await api[method](...args);
      if (!disposed && current === revision && result?.status) receive(result);
    } catch {
      if (!disposed && current === revision) receive({ ...state, status: 'error', error: 'UPDATE_FAILED' });
    }
  }
  async function act() {
    const { action } = presentUpdate(state, t);
    if (action === 'manual') api.openExternal(RELEASES_URL);
    else if (action === 'install') await request('installUpdate');
    else if (action === 'download') await request('downloadUpdate');
  }
  bind('checkUpdatesBtn', 'click', () => request('checkForUpdate'));
  for (const id of ['updateBannerText', 'settingsUpdateLink', 'updateInstallBtn']) bind(id, 'click', act);
  bind('updateBannerDismiss', 'click', () => { dismissed = `${state.version}:${state.status}`; render(); });
  bind('autoDownloadUpdates', 'change', () => request('setUpdatePreferences', nodes.autoDownloadUpdates.checked));
  async function start() {
    off = api.onUpdateState(receive);
    const current = revision;
    const snapshot = await api.getUpdateState();
    if (!disposed && current === revision) receive(snapshot);
  }
  function dispose() {
    disposed = true; off();
    for (const [node, event, handler] of handlers) node.removeEventListener(event, handler);
  }
  return { start, render, dispose };
}
