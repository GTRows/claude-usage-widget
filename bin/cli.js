#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadCredentials, writeConfig, getConfigPath, getConfigDir } = require('../src/cli/config');
const { fetchUsage, fetchOrganizations } = require('../src/cli/api');
const { summary, inlinePrompt, pickPercent } = require('../src/cli/render');
const { readWidgetHistory, getWidgetStorePath, getWidgetSettingsLanguage } = require('../src/cli/widget-store');
const historyShared = require('../src/shared/history');
const { DEFAULT_ACCOUNT_ID, normalizeAccount, normalizeAccounts } = require('../src/shared/accounts');
const { t, setLanguage } = require('../src/shared/i18n');
const pkg = require('../package.json');

function buildHelp() {
  return [
    t('cli.help.banner', { version: pkg.version }),
    '',
    t('cli.help.usage'),
    '',
    t('cli.help.commands'),
    t('cli.help.cmdStatus'),
    t('cli.help.cmdJson'),
    t('cli.help.cmdWatch'),
    t('cli.help.cmdPrompt'),
    t('cli.help.cmdLogin'),
    t('cli.help.cmdOrgs'),
    t('cli.help.cmdHistory'),
    t('cli.help.cmdDoctor'),
    t('cli.help.cmdConfig'),
    t('cli.help.cmdVersion'),
    t('cli.help.cmdHelp'),
    '',
    t('cli.help.authBlock'),
    '',
    t('cli.help.optionsBlock'),
    ''
  ].join('\n');
}

function parseArgs(argv) {
  const args = { command: argv[0] || 'help', flags: {}, rest: [] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.flags[key] = next;
        i++;
      } else {
        args.flags[key] = true;
      }
    } else {
      args.rest.push(a);
    }
  }
  return args;
}

function getThresholds(flags) {
  const warn = flags.warn ? Number(flags.warn) : undefined;
  const danger = flags.danger ? Number(flags.danger) : undefined;
  return { warn, danger };
}

function getRenderOpts(flags) {
  const opts = {
    color: !flags['no-color'],
    thresholds: getThresholds(flags),
  };
  if (typeof flags.segments === 'string') {
    opts.segments = flags.segments.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return opts;
}

async function cmdStatus(flags) {
  const creds = loadCredentials();
  const data = await fetchUsage(creds);
  process.stdout.write(summary(data, getRenderOpts(flags)) + '\n');
}

async function cmdJson(flags) {
  const creds = loadCredentials();
  const data = await fetchUsage(creds);
  process.stdout.write(JSON.stringify(data, null, flags.compact ? 0 : 2) + '\n');
}

function getCachePath() {
  return path.join(getConfigDir(), 'prompt-cache.json');
}

function readPromptCache(maxAgeSec) {
  try {
    const raw = fs.readFileSync(getCachePath(), 'utf8');
    const cached = JSON.parse(raw);
    if (!cached || typeof cached !== 'object') return null;
    const ageSec = (Date.now() - Number(cached.savedAt || 0)) / 1000;
    if (!Number.isFinite(ageSec) || ageSec > maxAgeSec) return null;
    return cached.data || null;
  } catch {
    return null;
  }
}

function writePromptCache(data) {
  try {
    fs.mkdirSync(getConfigDir(), { recursive: true });
    fs.writeFileSync(getCachePath(), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // best-effort cache; ignore disk errors
  }
}

async function cmdPrompt(flags) {
  const cacheSec = flags.cache != null && flags.cache !== true ? Number(flags.cache) : NaN;
  if (Number.isFinite(cacheSec) && cacheSec > 0) {
    const cached = readPromptCache(cacheSec);
    if (cached) {
      process.stdout.write(inlinePrompt(cached, getRenderOpts(flags)) + '\n');
      return;
    }
  }
  const creds = loadCredentials();
  const data = await fetchUsage(creds);
  if (Number.isFinite(cacheSec) && cacheSec > 0) writePromptCache(data);
  process.stdout.write(inlinePrompt(data, getRenderOpts(flags)) + '\n');
}

async function cmdWatch(flags) {
  const intervalSec = Math.max(15, Number(flags.interval) || 60);
  const creds = loadCredentials();
  const opts = getRenderOpts(flags);
  const tick = async () => {
    try {
      const data = await fetchUsage(creds);
      const ts = new Date().toLocaleTimeString();
      process.stdout.write(`\x1b[2J\x1b[H[${ts}]\n${summary(data, opts)}\n`);
    } catch (err) {
      process.stderr.write(t('cli.error.prefix', { message: err.message }) + '\n');
    }
  };
  await tick();
  setInterval(tick, intervalSec * 1000);
}

async function cmdLogin(flags) {
  const provider = flags.provider === 'codex' ? 'codex' : 'claude';
  const id = flags.account || DEFAULT_ACCOUNT_ID;
  const label = flags.label || (provider === 'codex' ? 'Codex Account' : 'Claude Account');
  const key = flags.key;
  const org = flags.org || flags.organization;
  if (!key) throw new Error(t('cli.login.missingKey'));
  const account = provider === 'codex'
    ? normalizeAccount({
      id,
      provider,
      label,
      apiKey: key,
      organizationHeader: org || flags['openai-organization'],
      projectId: flags.project || flags['openai-project'],
    })
    : normalizeAccount({ id, provider, label, sessionKey: key, organizationId: org });

  if (provider === 'claude' && !org) {
    try {
      const orgs = await fetchOrganizations(key);
      if (Array.isArray(orgs) && orgs.length === 1) {
        account.organizationId = orgs[0].uuid || orgs[0].id;
      } else if (Array.isArray(orgs)) {
        process.stdout.write(t('cli.login.multipleOrgs') + '\n');
        for (const o of orgs) process.stdout.write(`  ${o.uuid || o.id}  ${o.name || ''}\n`);
        if (!org) return;
      }
    } catch (err) {
      process.stderr.write(t('cli.login.autoDetectFailed', { error: err.message }) + '\n');
    }
  }
  const current = require('../src/cli/config').readConfig();
  const accounts = normalizeAccounts(current.accounts);
  const existing = accounts.findIndex((item) => item.id === account.id);
  if (existing >= 0) accounts[existing] = account;
  else accounts.push(account);
  writeConfig({
    accounts,
    activeAccountId: account.id,
    sessionKey: provider === 'claude' && account.id === DEFAULT_ACCOUNT_ID ? account.sessionKey : current.sessionKey,
    organizationId: provider === 'claude' && account.id === DEFAULT_ACCOUNT_ID ? account.organizationId : current.organizationId,
  });
  process.stdout.write(t('cli.login.savedTo', { path: getConfigPath() }) + '\n');
}

async function cmdOrganizations(flags) {
  const creds = loadCredentials();
  if (creds.provider === 'codex') throw new Error('organizations is only available for Claude accounts');
  if (!creds.sessionKey) throw new Error(t('cli.login.missingSession'));
  const orgs = await fetchOrganizations(creds.sessionKey);
  process.stdout.write(JSON.stringify(orgs, null, 2) + '\n');
}

async function cmdDoctor() {
  const lines = [];
  const ok = (label, value) => lines.push(`${t('cli.doctor.tagOk')}${label}${value ? ': ' + value : ''}`);
  const warn = (label, value) => lines.push(`${t('cli.doctor.tagWarn')}${label}${value ? ': ' + value : ''}`);
  const fail = (label, value) => lines.push(`${t('cli.doctor.tagFail')}${label}${value ? ': ' + value : ''}`);

  lines.push(t('cli.doctor.banner', { version: pkg.version }));
  lines.push(t('cli.doctor.platform', { node: process.version, platform: process.platform, arch: process.arch }));
  lines.push(t('cli.doctor.credsHeader'));
  const fromEnv = !!(process.env.CLAUDE_SESSION_KEY && process.env.CLAUDE_ORGANIZATION_ID);
  const creds = loadCredentials();
  const codexEnv = !!(process.env.OPENAI_ADMIN_KEY || process.env.OPENAI_API_KEY);
  if (fromEnv || codexEnv) ok(t('cli.doctor.envVarsSet'));
  else if ((creds.sessionKey && creds.organizationId) || creds.apiKey) ok(t('cli.doctor.configFile'), getConfigPath());
  else fail(t('cli.doctor.noCreds'), t('cli.doctor.noCredsHint'));

  lines.push(t('cli.doctor.widgetStoreHeader'));
  const widgetPath = getWidgetStorePath();
  const widget = readWidgetHistory();
  if (widget === null) warn(t('cli.doctor.widgetNotPresent'), widgetPath);
  else ok(t('cli.doctor.widgetHistoryRows', { n: widget.length }), widgetPath);

  lines.push(t('cli.doctor.apiHeader'));
  if ((creds.sessionKey && creds.organizationId) || creds.apiKey) {
    try {
      const t0 = Date.now();
      await fetchUsage(creds);
      ok(t('cli.doctor.apiOk'), `${Date.now() - t0}ms`);
    } catch (err) {
      fail(t('cli.doctor.apiOk'), `${err.code || 'ERR'} ${err.message}`);
    }
  } else {
    warn(t('cli.doctor.apiSkipped'), t('cli.doctor.skippedReason'));
  }

  process.stdout.write(lines.join('\n') + '\n');
}

function cmdHistory(flags) {
  const history = readWidgetHistory();
  if (history === null) {
    throw new Error(t('cli.history.noStore', { path: getWidgetStorePath() }));
  }
  let rows = history;
  const sinceDays = flags.since != null && flags.since !== true ? Number(flags.since) : NaN;
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
    rows = historyShared.filterByRange(rows, cutoff, Infinity);
  }
  const format = (flags.format || 'json').toLowerCase();
  let out;
  if (format === 'csv') {
    out = historyShared.toCSV(rows);
  } else if (format === 'json') {
    out = JSON.stringify(historyShared.toJSON(rows), null, flags.compact ? 0 : 2);
  } else {
    throw new Error(t('cli.history.unknownFormat', { fmt: format }));
  }
  if (flags.output && flags.output !== true) {
    fs.writeFileSync(flags.output, out);
    process.stdout.write(t('cli.history.wrote', { n: rows.length, path: flags.output }) + '\n');
  } else {
    process.stdout.write(out + '\n');
  }
}

function cmdConfig() {
  process.stdout.write(getConfigPath() + '\n');
}

function cmdVersion() {
  process.stdout.write(pkg.version + '\n');
}

async function main() {
  setLanguage(getWidgetSettingsLanguage());
  const args = parseArgs(process.argv.slice(2));
  const cmd = args.command.toLowerCase();
  try {
    switch (cmd) {
      case 'status': await cmdStatus(args.flags); break;
      case 'json': await cmdJson(args.flags); break;
      case 'prompt': await cmdPrompt(args.flags); break;
      case 'watch': await cmdWatch(args.flags); break;
      case 'login': await cmdLogin(args.flags); break;
      case 'organizations':
      case 'orgs': await cmdOrganizations(args.flags); break;
      case 'history': cmdHistory(args.flags); break;
      case 'doctor': await cmdDoctor(); break;
      case 'config': cmdConfig(); break;
      case 'version':
      case '-v':
      case '--version': cmdVersion(); break;
      case 'help':
      case '-h':
      case '--help':
      default:
        process.stdout.write(buildHelp());
        if (cmd !== 'help' && cmd !== '-h' && cmd !== '--help') process.exit(1);
    }
  } catch (err) {
    process.stderr.write(t('cli.error.prefix', { message: err.message }) + '\n');
    if (err.code === 'CLOUDFLARE') {
      process.stderr.write(t('cli.error.cloudflare') + '\n');
    }
    process.exit(1);
  }
}

main();
