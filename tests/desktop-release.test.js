import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { publishDesktopRelease } = require('../scripts/publish-desktop-release.cjs');
const tag = 'v1.18.0-gtrows.2';
const version = '1.18.0-gtrows.2';
const prefix = 'Claude-Usage-Widget-' + version;
const head = 'a'.repeat(40);
const windows = prefix + '-win-Setup.exe';
const macArm = prefix + '-macOS-arm64.zip';
const macIntel = prefix + '-macOS-x64.zip';
const linuxArm = prefix + '-linux-arm64.AppImage';
const linuxIntel = prefix + '-linux-x86_64.AppImage';
const payloads = [
  windows, windows + '.blockmap', prefix + '-win-portable.exe',
  macArm, macIntel, macArm + '.blockmap', macIntel + '.blockmap',
  prefix + '-macOS-arm64.dmg', prefix + '-macOS-x64.dmg',
  prefix + '-macOS-arm64.dmg.blockmap', prefix + '-macOS-x64.dmg.blockmap',
  linuxArm, linuxIntel, prefix + '-linux-arm64.deb', prefix + '-linux-amd64.deb',
  prefix + '-linux-aarch64.rpm', prefix + '-linux-x86_64.rpm',
  prefix + '-linux-aarch64.pacman', prefix + '-linux-x64.pacman',
  prefix + '-linux-arm64.tar.gz', prefix + '-linux-x64.tar.gz'
];

describe('desktop release publication', () => {
  let directory, run, publishedAssets, latestTag;

  function writeManifest(name, files, releaseVersion = version) {
    fs.writeFileSync(path.join(directory, name), JSON.stringify({
      version: releaseVersion,
      files: files.map(url => ({ url, sha512: createHash('sha512').update(url).digest('base64') }))
    }));
  }

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-release-'));
    for (const file of payloads) fs.writeFileSync(path.join(directory, file), file);
    writeManifest('latest.yml', [windows]);
    writeManifest('latest-mac.yml', [macArm, macIntel]);
    writeManifest('latest-linux.yml', [linuxIntel]);
    writeManifest('latest-linux-arm64.yml', [linuxArm]);
    publishedAssets = fs.readdirSync(directory).map(name => ({
      name, state: 'uploaded', digest: 'sha256:' + createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')
    }));
    latestTag = 'v1.17.5-gtrows.1';
    let uploaded = false;
    run = vi.fn(async (command, args) => {
      if (command === 'git') return `${head}\trefs/tags/${tag}\n`;
      if (args[1] === 'view' && args[2] === '--json') return JSON.stringify({ tagName: latestTag });
      if (args[1] === 'view') return JSON.stringify({ isDraft: true, assets: uploaded ? publishedAssets : [] });
      if (args[1] === 'upload') {
        uploaded = true;
        const checksums = fs.readFileSync(path.join(directory, 'SHA256SUMS'));
        publishedAssets.push({ name: 'SHA256SUMS', state: 'uploaded', digest: 'sha256:' + createHash('sha256').update(checksums).digest('hex') });
      }
      return '';
    });
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('uploads the complete verified set before making a draft public', async () => {
    await publishDesktopRelease({ tag, directory, head, run });
    const commands = run.mock.calls.map(([command, args]) => command === 'git' ? args[0] : args[1]);
    expect(commands).toEqual(['ls-remote', 'view', 'upload', 'view', 'view', 'ls-remote', 'edit']);
    expect(run.mock.calls[2][1].slice(3)).toContain(path.join(directory, 'latest-mac.yml'));
    expect(run.mock.calls[2][1]).not.toContain('--clobber');
    expect(run.mock.calls.at(-1)[1]).toContain('--latest=true');
    expect(fs.readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8')).toContain('  ' + windows + '\n');
  });

  it('creates a missing release as a draft before uploading the assets', async () => {
    run.mockResolvedValueOnce(`${head}\trefs/tags/${tag}\n`).mockRejectedValueOnce(new Error('release not found'));
    await publishDesktopRelease({ tag, directory, head, run });
    expect(run.mock.calls[2][1]).toContain('--draft');
    expect(run.mock.calls[2][1]).toContain('--verify-tag');
  });

  it('stops before contacting GitHub when a platform asset is missing or a manifest targets a different version', async () => {
    fs.unlinkSync(path.join(directory, macIntel + '.blockmap'));
    await expect(publishDesktopRelease({ tag, directory, head, run })).rejects.toThrow(macIntel + '.blockmap');
    fs.writeFileSync(path.join(directory, macIntel + '.blockmap'), '');
    writeManifest('latest-linux-arm64.yml', [linuxArm], '1.18.0-gtrows.1');
    await expect(publishDesktopRelease({ tag, directory, head, run })).rejects.toThrow('latest-linux-arm64.yml');
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects a moved tag and leaves public releases untouched', async () => {
    run.mockResolvedValueOnce(`${'b'.repeat(40)}\trefs/tags/${tag}^{}\n`);
    await expect(publishDesktopRelease({ tag, directory, head, run })).rejects.toThrow('Release tag changed');
    run.mockClear();
    run.mockResolvedValueOnce(`${head}\trefs/tags/${tag}\n`).mockResolvedValueOnce(JSON.stringify({ isDraft: false, assets: publishedAssets }));
    await expect(publishDesktopRelease({ tag, directory, head, run })).rejects.toThrow('already public');
    expect(run.mock.calls.map(([command, args]) => command === 'git' ? args[0] : args[1])).toEqual(['ls-remote', 'view']);
  });

  it('leaves the release as a draft when GitHub reports a missing or different upload', async () => {
    publishedAssets.find(asset => asset.name === windows).digest = 'sha256:wrong';
    await expect(publishDesktopRelease({ tag, directory, head, run })).rejects.toThrow(windows);
    expect(run.mock.calls.some(([, args]) => args[1] === 'edit')).toBe(false);
  });

  it('reuses matching draft assets and never overwrites an existing asset', async () => {
    const saved = publishedAssets.find(asset => asset.name === windows);
    run.mockResolvedValueOnce(`${head}\trefs/tags/${tag}\n`).mockResolvedValueOnce(JSON.stringify({ isDraft: true, assets: [saved] }));
    await publishDesktopRelease({ tag, directory, head, run });
    expect(run.mock.calls[2][1]).not.toContain(path.join(directory, windows));
  });

  it('does not replace a newer release on the stable channel', async () => {
    latestTag = 'v1.18.0-gtrows.10';
    await publishDesktopRelease({ tag, directory, head, run });
    expect(run.mock.calls.at(-1)[1]).toContain('--latest=false');
  });
});
