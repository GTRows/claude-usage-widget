const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const assert = require('assert/strict');
const { verifyUpdateMetadata } = require('./verify-update-metadata.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(file, args, environment = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { env: environment, windowsHide: true });
    let output = '';
    child.stdout?.on('data', data => { output = (output + data).slice(-100000); });
    child.stderr?.on('data', data => { output = (output + data).slice(-100000); });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Fixture process timed out: ' + output)); }, 240000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(`Fixture exited ${code}: ${output}`)); });
  });
}
async function main() {
  assert.equal(process.platform, 'win32', 'Native update acceptance requires Windows');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-updater-'));
  const dataDirectory = path.join(directory, 'data');
  const candidate = path.join(directory, 'candidate');
  fs.mkdirSync(dataDirectory); fs.mkdirSync(candidate);
  fs.writeFileSync(path.join(dataDirectory, 'config.json'), JSON.stringify({ accounts: [{ id: 'fixture', provider: 'claude', authType: 'local', configDir: path.join(dataDirectory, 'profile'), label: 'Fixture account' }], updateAcceptanceSentinel: 'preserve-me', settings: { codexQuotaDisplay: 'remaining', autoDownloadUpdates: false, usageAlerts: false }, usageHistory: [{ accountId: 'fixture', timestamp: Date.now(), session: 12, weekly: 34 }] }));
  const server = http.createServer((request, response) => {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname.slice(1));
    if (!name || name !== path.basename(name)) { response.writeHead(404).end(); return; }
    const file = path.join(candidate, name);
    if (!fs.existsSync(file)) { response.writeHead(404).end(); return; }
    const size = fs.statSync(file).size;
    response.writeHead(200, { 'Content-Length': size, 'Content-Type': name.endsWith('.yml') ? 'text/yaml' : 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const feed = `http://127.0.0.1:${server.address().port}/`;
  try {
    const old = path.join(directory, 'old');
    for (const [version, output] of [['99.0.0-gtrows.1', old], ['99.0.1-gtrows.1', candidate]]) {
      const spec = path.join(directory, 'build.json');
      fs.writeFileSync(spec, JSON.stringify({ version, output, dataDirectory, feed }));
      await run(process.execPath, [require.resolve('electron-builder/cli.js'), '--config', 'tests/electron/update-build.cjs', '--win', 'nsis', '--x64', '--publish', 'never'], { ...process.env, WIDGET_UPDATE_BUILD_SPEC: spec });
      await verifyUpdateMetadata(output);
    }
    const installDirectory = path.join(directory, 'installed');
    const installer = path.join(old, fs.readdirSync(old).find(name => name.endsWith('Setup.exe')));
    await run(installer, ['/S', '/currentuser', '/D=' + installDirectory]);
    const executable = path.join(installDirectory, 'Widget-Update-Fixture.exe');
    const application = spawn(executable, [], { windowsHide: true, stdio: 'ignore' });
    application.on('error', error => { fs.writeFileSync(path.join(dataDirectory, 'result.json'), JSON.stringify({ ok: false, error: error.message })); });
    const resultFile = path.join(dataDirectory, 'result.json');
    for (let i = 0; i < 1200 && !fs.existsSync(resultFile); i++) await delay(100);
    assert(fs.existsSync(resultFile), 'Updated application did not restart within two minutes');
    const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    assert.equal(result.ok, true, result.error);
    assert.equal(result.version, '99.0.1-gtrows.1');
    assert.equal(result.preserved, true);
    assert(fs.existsSync(path.join(dataDirectory, 'downloaded.json')), 'Verified download checkpoint missing');
    process.stdout.write('WINDOWS_UPDATE_ACCEPTANCE_PASS: NSIS download, checksum verification, install/restart, persisted data\n');
  } finally { server.close(); }
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
