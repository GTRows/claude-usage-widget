import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { readWindowsUpdatePublisher, verifyWindowsUpdateSignature } = require('../src/main/windows-update-signature');
const { requireSigningInputs, verifyWindowsRelease } = require('../scripts/verify-win-release.cjs');
const publisher = 'CN=Widget Publisher, O=Widget Publisher, C=US';

describe('Windows update signature policy', () => {
  it('enables updates only for one configured distinguished name', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-release-policy-'));
    try {
      const config = path.join(directory, 'app-update.yml');
      expect(readWindowsUpdatePublisher(config)).toBeNull();
      for (const value of ['publisherName: Widget Publisher', 'publisherName: []', 'publisherName: [', 'publisherName: [CN=One, CN=Two]']) {
        fs.writeFileSync(config, value);
        expect(readWindowsUpdatePublisher(config)).toBeNull();
      }
      fs.writeFileSync(config, `publisherName: [${JSON.stringify(publisher)}]`);
      expect(readWindowsUpdatePublisher(config)).toBe(publisher);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform !== 'win32')('accepts a trusted Windows signature and rejects a different publisher and unsigned data', async () => {
    const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const probe = "Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') ; (Get-AuthenticodeSignature -LiteralPath (Join-Path $PSHOME powershell.exe)).SignerCertificate.Subject";
    const expected = execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', probe], { encoding: 'utf8' }).trim();
    expect(expected).toMatch(/CN=/);
    expect(await verifyWindowsUpdateSignature(expected, powershell)).toBeNull();
    expect(await verifyWindowsUpdateSignature(publisher, powershell)).toBe('Windows update signature does not match the release publisher');

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-unsigned-update-'));
    try {
      const installer = path.join(directory, "unsigned & publisher's setup.exe");
      fs.writeFileSync(installer, 'unsigned fixture');
      expect(await verifyWindowsUpdateSignature(expected, installer)).toBe('Windows update signature is invalid');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('requires a certificate and a distinguished publisher before building a release', () => {
    expect(() => requireSigningInputs({})).toThrow('WIN_CSC_LINK');
    const credentials = { WIN_CSC_LINK: 'test-cert', WIN_CSC_KEY_PASSWORD: 'test-password', WINDOWS_UPDATE_PUBLISHER: 'Widget Publisher' };
    expect(() => requireSigningInputs(credentials)).toThrow('full Authenticode certificate subject');
    expect(() => requireSigningInputs({ ...credentials, WINDOWS_UPDATE_PUBLISHER: publisher })).not.toThrow();
  });

  it('allows a valid Windows certificate store thumbprint without a PFX', () => {
    const credentials = { WINDOWS_UPDATE_PUBLISHER: publisher, WINDOWS_SIGNING_CERTIFICATE_SHA1: 'a'.repeat(40) };
    expect(() => requireSigningInputs(credentials)).not.toThrow();
    expect(() => requireSigningInputs({ ...credentials, WINDOWS_SIGNING_CERTIFICATE_SHA1: 'not-a-thumbprint' })).toThrow('40-digit thumbprint');
  });

  it('rejects a release without the selected publisher in the packaged updater', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-release-policy-'));
    try {
      await expect(verifyWindowsRelease(directory, publisher)).rejects.toThrow('Packaged updater is missing');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
