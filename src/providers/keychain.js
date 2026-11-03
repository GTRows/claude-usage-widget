const { execFile: nativeExecFile } = require('node:child_process');
const { providerError } = require('./errors');

function readMacKeychain({ service }, { execFile = nativeExecFile } = {}) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(providerError('LOCAL_CREDENTIALS_UNAVAILABLE'));
    if (typeof service !== 'string' || !/^Claude Code-credentials(?:-[a-z0-9]+)?$/.test(service)) {
      fail();
      return;
    }
    try {
      execFile('/usr/bin/security', ['find-generic-password', '-s', service, '-w'], {
        timeout: 2000,
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
        windowsHide: true,
      }, (error, stdout) => {
        if (error || typeof stdout !== 'string' || !stdout.trim()) fail();
        else resolve(stdout.trim());
      });
    } catch {
      fail();
    }
  });
}

module.exports = { readMacKeychain };
