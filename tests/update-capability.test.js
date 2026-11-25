import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { updateCapability } = require('../src/main/update-capability');
describe('native update availability', () => {
  it('does not install from a development checkout', () => {
    expect(updateCapability({ packaged: false, platform: 'win32' })).toMatchObject({ supported: false, reason: 'development' });
  });
  it('requires a configured Windows publisher and excludes portable builds', () => {
    const installed = { packaged: true, platform: 'win32', environment: {} };
    const windowsPublisher = 'CN=Widget Publisher, O=Widget Publisher, C=US';
    expect(updateCapability(installed)).toEqual({ supported: false, reason: 'unsigned-windows' });
    expect(updateCapability({ ...installed, windowsPublisher }).supported).toBe(true);
    expect(updateCapability({ ...installed, windowsPublisher, environment: { PORTABLE_EXECUTABLE_FILE: 'widget.exe' } })).toEqual({ supported: false, reason: 'portable' });
  });
  it('requires a Developer ID signature for Mac updates', () => {
    for (const signature of ['', 'Signature=adhoc\nTeamIdentifier=not set', 'Signature=adhoc\nTeamIdentifier=ABC']) {
      expect(updateCapability({ packaged: true, platform: 'darwin', signature }).supported).toBe(false);
    }
    expect(updateCapability({ packaged: true, platform: 'darwin', signature: 'Authority=Developer ID Application: Example (ABC)\nTeamIdentifier=ABC' }).supported).toBe(true);
  });
  it('limits Linux native updates to AppImage installations', () => {
    expect(updateCapability({ packaged: true, platform: 'linux', environment: {} }).supported).toBe(false);
    expect(updateCapability({ packaged: true, platform: 'linux', environment: { APPIMAGE: '/opt/widget.AppImage' } }).supported).toBe(true);
  });
});
