import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
const require = createRequire(import.meta.url);

function prepareWindowsRuntime() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-electron-'));
  const runtime = path.join(directory, 'runtime');
  fs.cpSync(path.dirname(require('electron')), runtime, { recursive: true });
  // Give sandboxed children read access to this disposable public runtime only.
  // Restricted inherited workspace ACLs can otherwise crash before the app loads.
  execFileSync('icacls', [runtime, '/grant', '*S-1-15-2-1:(OI)(CI)(RX)', '/T', '/Q']);
  return { directory, binary: path.join(runtime, 'electron.exe') };
}

// Hosted Windows runners provide a desktop session; local npm test stays lightweight.
describe('Windows desktop integration', () => {
  for (const broken of [false, true]) {
    it.runIf(process.platform === 'win32' && Boolean(process.env.CI))(broken ? 'keeps healthy accounts available when the selected credential is unreadable' : 'completes the real account, theme, logout and history flow', async () => {
      const { directory, binary } = prepareWindowsRuntime();
      try {
        const result = await new Promise((resolve, reject) => {
          const child = spawn(binary, ['--enable-logging=stderr', path.join(process.cwd(), 'tests/electron/smoke.cjs')], { cwd: process.cwd(), env: { ...process.env, WIDGET_BROKEN_START: broken ? '1' : '', WIDGET_HOLD: '' }, windowsHide: true });
          let output = '';
          child.stdout.on('data', (data) => { output += data; });
          child.stderr.on('data', (data) => { output += data; });
          const timer = setTimeout(() => { child.kill(); resolve({ code: -1, output: output + '\nElectron smoke timed out' }); }, 100000);
          child.on('error', (error) => { clearTimeout(timer); reject(error); });
          child.on('close', (code) => { clearTimeout(timer); resolve({ code, output }); });
        });
        expect(result.output, result.output).toContain('ELECTRON_SMOKE_PASS');
        expect(result.code, result.output).toBe(0);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
      }
    }, 120000);
  }
});
