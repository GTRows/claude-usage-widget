#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadCredentials, writeConfig, getConfigPath, getConfigDir } = require('../src/cli/config');
const { fetchUsage, fetchOrganizations } = require('../src/cli/api');
const { summary, inlinePrompt, pickPercent } = require('../src/cli/render');
const { readWidgetHistory, getWidgetStorePath } = require('../src/cli/widget-store');
const historyShared = require('../src/shared/history');
const pkg = require('../package.json');

const HELP = `claude-usage ${pkg.version}
GTRows fork — desktop widget companion CLI

Usage:
  claude-usage <command> [options]

Commands:
  status              Print current 5-hour and weekly usage (one shot)
  json                Print the raw usage JSON
  watch [--interval s]  Re-fetch every N seconds (default 60)
  prompt [--segments 5h,7d,opus,sonnet,extra] [--cache N]
                      Print a one-line summary for shell prompts; --cache
                      reuses a stored response for N seconds (avoids
                      hitting the API on every keystroke)
  login --key K --org O   Save credentials to the CLI config file
  organizations       List organizations the session can see
  history [--since N] [--format csv|json] [--output FILE]
                      Read the desktop widget's stored usage history
  doctor              Diagnose credentials, widget store, and API reach
  config              Print the config file path
  version             Print the CLI version
  help                Show this message

Auth:
  Credentials come from CLAUDE_SESSION_KEY + CLAUDE_ORGANIZATION_ID env
  vars first, then from the file at \`claude-usage config\`. The desktop
  widget stores its key encrypted with Electron's safeStorage and is
  not readable from outside Electron, so the CLI keeps its own copy.

Options:
  --no-color          Disable ANSI color output
  --warn N            Warn threshold percent (default 75)
  --danger N          Danger threshold percent (default 90)
`;

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
      process.stderr.write(`error: ${err.message}\n`);
    }
  };
  await tick();
  setInterval(tick, intervalSec * 1000);
}

async function cmdLogin(flags) {
  const key = flags.key;
  const org = flags.org || flags.organization;
  if (!key) throw new Error('--key required');
  const patch = { sessionKey: key };
  if (org) patch.organizationId = org;
  if (!org) {
    try {
      const orgs = await fetchOrganizations(key);
      if (Array.isArray(orgs) && orgs.length === 1) {
        patch.organizationId = orgs[0].uuid || orgs[0].id;
      } else if (Array.isArray(orgs)) {
        process.stdout.write(`Multiple organizations available. Pass --org <uuid>:\n`);
        for (const o of orgs) process.stdout.write(`  ${o.uuid || o.id}  ${o.name || ''}\n`);
        if (!org) return;
      }
    } catch (err) {
      process.stderr.write(`warning: could not auto-detect organization (${err.message}); pass --org\n`);
    }
  }
  writeConfig(patch);
  process.stdout.write(`Saved credentials to ${getConfigPath()}\n`);
}

async function cmdOrganizations(flags) {
  const creds = loadCredentials();
  if (!creds.sessionKey) throw new Error('Missing session key');
  const orgs = await fetchOrganizations(creds.sessionKey);
  process.stdout.write(JSON.stringify(orgs, null, 2) + '\n');
}

async function cmdDoctor() {
  const lines = [];
  const ok = (label, value) => lines.push(`  [ok]   ${label}${value ? ': ' + value : ''}`);
  const warn = (label, value) => lines.push(`  [warn] ${label}${value ? ': ' + value : ''}`);
  const fail = (label, value) => lines.push(`  [fail] ${label}${value ? ': ' + value : ''}`);

  lines.push(`claude-usage ${pkg.version} doctor`);
  lines.push(`  node ${process.version}  platform ${process.platform}/${process.arch}`);
  lines.push('Credentials');
  const fromEnv = !!(process.env.CLAUDE_SESSION_KEY && process.env.CLAUDE_ORGANIZATION_ID);
  const creds = loadCredentials();
  if (fromEnv) ok('env vars set');
  else if (creds.sessionKey && creds.organizationId) ok('config file', getConfigPath());
  else fail('no credentials', 'run `claude-usage login --key K --org O`');

  lines.push('Widget store');
  const widgetPath = getWidgetStorePath();
  const widget = readWidgetHistory();
  if (widget === null) warn('not present', widgetPath);
  else ok(`history rows: ${widget.length}`, widgetPath);

  lines.push('API reachability');
  if (creds.sessionKey && creds.organizationId) {
    try {
      const t0 = Date.now();
      await fetchUsage(creds);
      ok(`usage endpoint`, `${Date.now() - t0}ms`);
    } catch (err) {
      fail('usage endpoint', `${err.code || 'ERR'} ${err.message}`);
    }
  } else {
    warn('skipped', 'no credentials');
  }

  process.stdout.write(lines.join('\n') + '\n');
}

function cmdHistory(flags) {
  const history = readWidgetHistory();
  if (history === null) {
    throw new Error(`No widget store found at ${getWidgetStorePath()}. Run the desktop widget at least once or set CLAUDE_USAGE_WIDGET_DIR.`);
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
    throw new Error(`Unknown --format '${format}' (expected csv or json)`);
  }
  if (flags.output && flags.output !== true) {
    fs.writeFileSync(flags.output, out);
    process.stdout.write(`Wrote ${rows.length} rows to ${flags.output}\n`);
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
        process.stdout.write(HELP);
        if (cmd !== 'help' && cmd !== '-h' && cmd !== '--help') process.exit(1);
    }
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    if (err.code === 'CLOUDFLARE') {
      process.stderr.write('Cloudflare blocked the request. The desktop widget bypasses this with a hidden browser window; the CLI cannot.\n');
    }
    process.exit(1);
  }
}

main();
