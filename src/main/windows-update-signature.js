const { execFile } = require('child_process');
const { readFileSync } = require('fs');
const { createRequire } = require('module');
const path = require('path');
const { promisify } = require('util');

const run = promisify(execFile);
const signatureCommand = [
  "$ErrorActionPreference = 'Stop'",
  '[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)',
  "Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1')",
  '$signature = Get-AuthenticodeSignature -LiteralPath $env:WIDGET_UPDATE_INSTALLER',
  '@{ status = [int]$signature.Status; publisher = $signature.SignerCertificate.Subject } | ConvertTo-Json -Compress'
].join('; ');

function isWindowsUpdatePublisher(value) {
  return typeof value === 'string' && value === value.trim() && /(?:^|,\s*)CN=\S/i.test(value) && !/[\r\n\0]/.test(value);
}

function readWindowsUpdatePublisher(file) {
  try {
    const updaterRequire = createRequire(require.resolve('electron-updater'));
    const { load } = updaterRequire('js-yaml');
    const publisher = load(readFileSync(file, 'utf8'))?.publisherName;
    const names = Array.isArray(publisher) ? publisher : [publisher];
    return names.length === 1 && isWindowsUpdatePublisher(names[0]) ? names[0] : null;
  } catch {
    return null;
  }
}

async function verifyWindowsUpdateSignature(publisher, file) {
  if (!isWindowsUpdatePublisher(publisher) || typeof file !== 'string' || !path.isAbsolute(file)) {
    return 'Windows update signature could not be verified';
  }
  try {
    const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const { stdout } = await run(powershell, ['-NoProfile', '-NonInteractive', '-Command', signatureCommand], {
      env: { ...process.env, WIDGET_UPDATE_INSTALLER: file },
      timeout: 20000,
      windowsHide: true
    });
    const signature = JSON.parse(stdout);
    if (signature.status !== 0) return 'Windows update signature is invalid';
    if (signature.publisher !== publisher) return 'Windows update signature does not match the release publisher';
    return null;
  } catch {
    return 'Windows update signature could not be verified';
  }
}

module.exports = { isWindowsUpdatePublisher, readWindowsUpdatePublisher, verifyWindowsUpdateSignature };
