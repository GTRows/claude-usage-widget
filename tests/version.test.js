import { describe, it, expect } from 'vitest';
import { parseVersion, compareVersions, isNewerVersion, pickLatestRelease } from '../src/shared/version.js';

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

describe('pickLatestRelease', () => {
  it('picks the highest published release even when it is a GitHub prerelease', () => {
    expect(pickLatestRelease([
      {
        tag_name: 'v1.12.0-gtrows.1',
        draft: false,
        prerelease: false,
        html_url: 'https://github.com/GTRows/claude-usage-widget/releases/tag/v1.12.0-gtrows.1',
      },
      {
        tag_name: 'v1.16.0-gtrows.1',
        draft: false,
        prerelease: true,
        html_url: 'https://github.com/GTRows/claude-usage-widget/releases/tag/v1.16.0-gtrows.1',
      },
    ])).toEqual({
      version: '1.16.0-gtrows.1',
      releaseUrl: 'https://github.com/GTRows/claude-usage-widget/releases/tag/v1.16.0-gtrows.1',
    });
  });

  it('ignores drafts and malformed release tags', () => {
    expect(pickLatestRelease([
      { tag_name: 'v2.0.0', draft: true, html_url: 'draft-url' },
      { tag_name: 'not-a-version', draft: false, html_url: 'bad-url' },
      { tag_name: 'v1.9.0', draft: false, html_url: 'stable-url' },
    ])).toEqual({ version: '1.9.0', releaseUrl: 'stable-url' });
  });
});
