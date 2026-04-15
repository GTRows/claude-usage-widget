import { describe, it, expect } from 'vitest';
import { parseVersion, compareVersions, isNewerVersion } from '../src/shared/version.js';

describe('parseVersion', () => {
  it('parses a plain semver', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, preRelease: null });
  });
  it('strips a leading v', () => {
    expect(parseVersion('v1.9.0')).toEqual({ major: 1, minor: 9, patch: 0, preRelease: null });
  });
  it('captures a pre-release tag', () => {
    expect(parseVersion('1.9.0-gtrows.1')).toEqual({ major: 1, minor: 9, patch: 0, preRelease: 'gtrows.1' });
  });
  it('rejects malformed input', () => {
    expect(parseVersion('not-a-version')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion(null)).toBeNull();
  });
});

describe('compareVersions', () => {
  it('orders by major then minor then patch', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.9.10', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.9.9', '1.9.9')).toBe(0);
  });
  it('treats a pre-release as older than the release', () => {
    expect(compareVersions('1.9.0-rc.1', '1.9.0')).toBeLessThan(0);
    expect(compareVersions('1.9.0', '1.9.0-rc.1')).toBeGreaterThan(0);
  });
  it('orders pre-release tags lexically', () => {
    expect(compareVersions('1.9.0-gtrows.2', '1.9.0-gtrows.1')).toBeGreaterThan(0);
  });
});

describe('isNewerVersion', () => {
  it('returns true only when remote outranks local', () => {
    expect(isNewerVersion('1.9.1', '1.9.0')).toBe(true);
    expect(isNewerVersion('1.9.0', '1.9.0')).toBe(false);
    expect(isNewerVersion('1.8.0', '1.9.0')).toBe(false);
  });
});
