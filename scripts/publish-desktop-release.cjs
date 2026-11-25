const { execFile } = require('child_process');
const { createHash } = require('crypto');
const { createReadStream } = require('fs');
const { readdir, writeFile } = require('fs/promises');
const path = require('path');
const { promisify } = require('util');
const { verifyUpdateMetadata } = require('./verify-update-metadata.cjs');
const { isNewerVersion } = require('../src/shared/version');

const exec = promisify(execFile);
async function runCommand(command, args) {
  const { stdout } = await exec(command, args);
  return stdout;
}

async function verifyDesktopRelease(directory, tag) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-gtrows\.(?:0|[1-9]\d*)$/.test(tag)) {
    throw new Error('Expected a GTRows desktop release tag');
  }
  const version = tag.slice(1);
  const name = 'Claude-Usage-Widget-' + version;
  const setup = name + '-win-Setup.exe';
  const macZip = ['arm64', 'x64'].map(arch => name + '-macOS-' + arch + '.zip');
  const macDmg = ['arm64', 'x64'].map(arch => name + '-macOS-' + arch + '.dmg');
  const appImages = ['x86_64', 'arm64'].map(arch => name + '-linux-' + arch + '.AppImage');
  const manifests = {
    'latest.yml': [setup],
    'latest-mac.yml': macZip,
    'latest-linux.yml': [appImages[0]],
    'latest-linux-arm64.yml': [appImages[1]]
  };
  const required = [
    ...Object.keys(manifests), setup, name + '-win-portable.exe',
    ...macZip, ...macDmg, ...[setup, ...macZip, ...macDmg].map(file => file + '.blockmap'),
    ...appImages, ...['arm64.deb', 'amd64.deb', 'aarch64.rpm', 'x86_64.rpm', 'aarch64.pacman',
      'x64.pacman', 'arm64.tar.gz', 'x64.tar.gz'].map(suffix => name + '-linux-' + suffix)
  ];
  const files = new Set((await readdir(directory, { withFileTypes: true })).filter(file => file.isFile()).map(file => file.name));
  for (const file of required) {
    if (!files.has(file)) throw new Error('Missing release asset: ' + file);
  }
  const metadata = await verifyUpdateMetadata(directory);
  for (const { manifest, files, version: actualVersion } of metadata) {
    if (actualVersion !== version || !manifests[manifest]?.every(file => files.includes(file))
      || files.some(file => !required.includes(file))) {
      throw new Error('Unexpected release metadata: ' + manifest);
    }
  }
  return required;
}

async function digestFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function publishDesktopRelease({ directory, tag, head, run = runCommand }) {
  const files = await verifyDesktopRelease(directory, tag);
  const digests = new Map();
  for (const file of files) digests.set(file, await digestFile(path.join(directory, file)));
  const checksum = 'SHA256SUMS';
  await writeFile(path.join(directory, checksum), [...digests].map(([file, digest]) => digest + '  ' + file).join('\n') + '\n');
  digests.set(checksum, await digestFile(path.join(directory, checksum)));

  const gh = (...args) => run('gh', ['release', ...args]);
  const view = async () => JSON.parse(await gh('view', tag, '--json', 'assets,isDraft'));
  const verifyAssets = assets => {
    const missing = new Set(digests.keys());
    for (const asset of assets) {
      if (!missing.delete(asset.name) || asset.digest !== 'sha256:' + digests.get(asset.name) || asset.state !== 'uploaded') {
        throw new Error('Unexpected or mismatched draft asset: ' + asset.name);
      }
    }
    return [...missing];
  };
  const verifyTag = async () => {
    const ref = 'refs/tags/' + tag;
    const output = await run('git', ['ls-remote', '--exit-code', 'origin', ref, ref + '^{}']);
    const refs = new Map(output.trim().split(/\r?\n/).map(line => line.split('\t').reverse()));
    if ((refs.get(ref + '^{}') || refs.get(ref)) !== head) throw new Error('Release tag changed: ' + tag);
  };

  await verifyTag();
  let existing;
  try {
    existing = await view();
  } catch (error) {
    if (!/release not found/i.test(error.stderr || error.message)) throw error;
    await gh('create', tag, '--draft', '--verify-tag', '--generate-notes');
  }
  if (existing && existing.isDraft !== true) throw new Error('Release is already public: ' + tag);

  const remaining = verifyAssets(existing?.assets || []);
  if (remaining.length) await gh('upload', tag, ...remaining.map(file => path.join(directory, file)));
  const release = await view();
  if (release.isDraft !== true) throw new Error('Release is no longer a draft: ' + tag);
  const missing = verifyAssets(release.assets);
  if (missing.length) throw new Error('Missing uploaded assets: ' + missing.join(', '));
  let latest = null;
  try {
    latest = JSON.parse(await gh('view', '--json', 'tagName')).tagName;
  } catch (error) {
    if (!/no releases found/i.test(error.stderr || error.message)) throw error;
  }
  await verifyTag();
  await gh('edit', tag, '--draft=false', '--latest=' + (!latest || isNewerVersion(tag, latest)), '--verify-tag');
}

if (require.main === module) {
  (async () => {
    const head = (await runCommand('git', ['rev-parse', 'HEAD'])).trim();
    await publishDesktopRelease({ directory: path.resolve(process.argv[2]), tag: process.env.GITHUB_REF_NAME, head });
  })().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
}

module.exports = { publishDesktopRelease };
