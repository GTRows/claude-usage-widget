import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { requireSigningInputs, verifyMacRelease } = require('../scripts/verify-mac-release.cjs');
describe('Mac release publication gate', () => {
  it('fails before a tagged build when signing or notarization secrets are missing', () => {
    expect(() => requireSigningInputs({ CSC_LINK: 'private-data' })).toThrow('APPLE_ID');
    try { requireSigningInputs({ CSC_LINK: 'private-data' }); } catch (error) { expect(error.message).not.toContain('private-data'); }
  });
  it('requires Developer ID, matching Team ID and notarization validation', () => {
    const calls = [];
    const run = (command, args) => {
      calls.push([command, args]);
      return command === '/usr/bin/codesign' && args[0] === '-d' ? 'Authority=Developer ID Application: Test (ABC)\nTeamIdentifier=ABC' : '';
    };
    verifyMacRelease(['example.app'], 'ABC', run);
    expect(calls.some(([command, args]) => command === '/usr/bin/xcrun' && args[0] === 'stapler')).toBe(true);
    expect(calls.some(([command]) => command === '/usr/sbin/spctl')).toBe(true);
    expect(() => verifyMacRelease(['example.app'], 'OTHER', run)).toThrow('Team ID');
    expect(() => verifyMacRelease(['example.app'], 'ABC', () => 'Signature=adhoc')).toThrow('Developer ID');
  });
  it('blocks publication when Gatekeeper or staple validation fails', () => {
    const run = (command, args) => {
      if (command === '/usr/bin/xcrun') throw new Error('no stapled ticket');
      return args[0] === '-d' ? 'Authority=Developer ID Application: Test (ABC)\nTeamIdentifier=ABC' : '';
    };
    expect(() => verifyMacRelease(['example.app'], 'ABC', run)).toThrow('no stapled ticket');
    expect(() => verifyMacRelease([], 'ABC', run)).toThrow('No Mac app bundles');
  });
});
