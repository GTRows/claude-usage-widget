import { accountProviderLabel, quotaText } from './account-presentation.js';

export function createAccountPanel({ api, t, onSelect, onAdd, onCancel, onChanged, onResize }) {
  const byId = (id) => document.getElementById(id);
  let state = { accounts: [], activeAccountId: null, snapshots: [] };
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text != null) element.textContent = text;
    return element;
  };
  const errorText = (code) => t(code === 'AUTH_REQUIRED' ? 'accounts.authRequired' : code === 'RATE_LIMITED' ? 'accounts.rateLimited' : 'accounts.fetchFailed');

  function render(snapshots = state.snapshots) {
    state.snapshots = snapshots;
    const overview = byId('accountOverview');
    overview.hidden = state.accounts.length < 2;
    byId('accountCount').textContent = String(state.accounts.length);
    byId('accountList').replaceChildren();
    for (const account of state.accounts) {
      const snapshot = snapshots.find((row) => row.accountId === account.id);
      const button = node('button', `account-card${account.id === state.activeAccountId ? ' active' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(account.id === state.activeAccountId));
      const identity = node('span', 'account-card-identity');
      identity.append(node('span', 'account-card-title', account.label), node('span', 'account-provider', accountProviderLabel(account)));
      const metrics = node('span', 'account-metrics');
      const data = snapshot?.data;
      if (account.provider === 'codex' && account.authType !== 'local') {
        metrics.append(node('span', 'account-api-total', data?.codex_usage ? t('accounts.apiTotal', { requests: data.codex_usage.num_model_requests, cost: new Intl.NumberFormat(undefined, { style: 'currency', currency: data.codex_usage.currency || 'USD' }).format(data.codex_usage.cost || 0) }) : '—'));
      } else {
        for (const [key, title] of [['five_hour', 'accounts.sessionShort'], ['seven_day', 'accounts.weeklyShort']]) {
          const metric = node('span', `account-mini-metric ${key}`);
          metric.append(node('span', 'account-mini-label', t(title)), node('strong', '', quotaText(data?.[key])));
          const track = node('span', 'account-mini-track');
          const fill = node('span', 'account-mini-fill');
          fill.style.width = `${Math.min(100, Math.max(0, data?.[key]?.utilization || 0))}%`;
          track.append(fill);
          metric.append(track);
          metrics.append(metric);
        }
      }
      const status = node('span', `account-status${snapshot?.error ? ' has-error' : ''}`, snapshot?.error ? t(snapshot.error.code === 'AUTH_REQUIRED' ? 'accounts.signIn' : 'accounts.retry') : snapshot?.updatedAt ? new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('accounts.waiting'));
      button.append(identity, metrics, status);
      button.addEventListener('click', () => onSelect(account.id));
      byId('accountList').append(button);
    }
    const active = state.accounts.find((account) => account.id === state.activeAccountId);
    byId('accountDetailLabel').textContent = active ? `${active.label} · ${accountProviderLabel(active)}` : '';
    byId('accountDetailLabel').hidden = state.accounts.length < 2;
    const activeSnapshot = snapshots.find((row) => row.accountId === state.activeAccountId);
    byId('accountRefreshStatus').hidden = !activeSnapshot?.error;
    byId('accountRefreshStatus').textContent = activeSnapshot?.error ? errorText(activeSnapshot.error.code) : '';
    byId('cancelAddAccount').hidden = state.accounts.length === 0;
    const name = byId('renameAccountInput');
    if (document.activeElement !== name) name.value = active?.label || '';
    onResize();
  }

  async function refresh(snapshots) {
    state = await api.getAccounts();
    render(snapshots || state.snapshots || []);
    return state;
  }

  async function link(provider, configDir) {
    const error = byId('localProfileError');
    error.textContent = t('accounts.linking');
    const result = await api.linkLocalProfile(provider, configDir);
    error.textContent = result.canceled || result.success ? '' : t('accounts.profileUnavailable');
    if (result.success) await onChanged();
  }

  async function discover() {
    const profiles = await api.discoverLocalProfiles();
    const list = byId('localProfileList');
    list.replaceChildren();
    for (const profile of profiles) {
      const button = node('button', 'profile-choice');
      button.type = 'button';
      button.append(node('span', 'profile-name', profile.label), node('span', 'profile-path', profile.configDir));
      button.addEventListener('click', () => link(profile.provider, profile.configDir));
      list.append(button);
    }
    byId('localProfileEmpty').hidden = profiles.length > 0;
    onResize();
  }

  byId('addAccountBtn').addEventListener('click', onAdd);
  byId('settingsAddAccountBtn').addEventListener('click', onAdd);
  byId('cancelAddAccount').addEventListener('click', onCancel);
  byId('chooseLocalProfileBtn').addEventListener('click', () => link(byId('localProviderSelect').value));
  byId('renameAccountBtn').addEventListener('click', async () => {
    const label = byId('renameAccountInput').value.trim();
    if (!label || !state.activeAccountId) return;
    await api.renameAccount(state.activeAccountId, label);
    await onChanged();
  });
  return { refresh, render, discover };
}
