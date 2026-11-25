const { readdirSync } = require('fs');
const path = require('path');
const { isWindowsUpdatePublisher, readWindowsUpdatePublisher, verifyWindowsUpdateSignature } = require('../src/main/windows-update-signature');

function requireSigningInputs(environment) {
  const names = ['WINDOWS_UPDATE_PUBLISHER'];
  const thumbprint = environment.WINDOWS_SIGNING_CERTIFICATE_SHA1;
  if (thumbprint) {
    if (!/^[a-f0-9]{40}$/i.test(thumbprint)) throw new Error('WINDOWS_SIGNING_CERTIFICATE_SHA1 must be a 40-digit thumbprint');
  } else {
    names.push('WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD');
  }
  const missing = names.filter(name => !environment[name]?.trim());
  if (missing.length) throw new Error('Missing Windows release secrets: ' + missing.join(', '));
  if (!isWindowsUpdatePublisher(environment.WINDOWS_UPDATE_PUBLISHER)) {
    throw new Error('WINDOWS_UPDATE_PUBLISHER must be the full Authenticode certificate subject');
  }
}

async function verifyWindowsRelease(directory, publisher) {
  const unpacked = path.join(directory, 'win-unpacked');
  if (readWindowsUpdatePublisher(path.join(unpacked, 'resources', 'app-update.yml')) !== publisher) {
    throw new Error('Packaged updater is missing the configured Windows release publisher');
  }
  const assets = readdirSync(directory);
  const installers = ['-win-Setup.exe', '-win-portable.exe'].map(suffix => {
    const files = assets.filter(file => file.endsWith(suffix));
    if (files.length !== 1) throw new Error('Expected one Windows artifact ending in ' + suffix);
    return path.join(directory, files[0]);
  });
  for (const file of [path.join(unpacked, 'Claude-Usage-Widget.exe'), ...installers]) {
    const failure = await verifyWindowsUpdateSignature(publisher, file);
    if (failure) throw new Error(path.basename(file) + ': ' + failure);
  }
}

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--preflight')) requireSigningInputs(process.env);
    else await verifyWindowsRelease(path.resolve(process.argv[2] || 'dist'), process.env.WINDOWS_UPDATE_PUBLISHER);
    process.stdout.write('Windows release signing requirements verified\n');
  })().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
}

module.exports = { requireSigningInputs, verifyWindowsRelease };
