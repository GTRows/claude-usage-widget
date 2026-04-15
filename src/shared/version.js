function parseVersion(version) {
  if (typeof version !== 'string') return null;
  const clean = version.trim().replace(/^v/i, '');
  const [core, preRelease] = clean.split('-');
  const parts = core.split('.').map((n) => parseInt(n, 10));
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2],
    preRelease: preRelease || null,
  };
}

function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  if (pa.preRelease && !pb.preRelease) return -1;
  if (!pa.preRelease && pb.preRelease) return 1;
  if (pa.preRelease && pb.preRelease) {
    if (pa.preRelease === pb.preRelease) return 0;
    return pa.preRelease < pb.preRelease ? -1 : 1;
  }
  return 0;
}

function isNewerVersion(remote, local) {
  return compareVersions(remote, local) > 0;
}

module.exports = { parseVersion, compareVersions, isNewerVersion };
