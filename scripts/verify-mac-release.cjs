const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
function requireSigningInputs(environment) {
  const names = ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
  const missing = names.filter(name => !environment[name]?.trim());
  if (missing.length) throw new Error('Missing Mac release secrets: ' + missing.join(', '));
}
function execute(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(`Mac release validation failed: ${path.basename(command)}`);
  return (result.stdout || '') + (result.stderr || '');
}
function verifyMacRelease(artifacts, teamId, run = execute) {
  if (!artifacts.length) throw new Error('No Mac app bundles found');
  for (const artifact of artifacts) {
    const signature = run('/usr/bin/codesign', ['-d', '--verbose=2', artifact]);
    if (!/^Authority=Developer ID Application:/m.test(signature) || /^Signature=adhoc/m.test(signature)) throw new Error('Mac release requires Developer ID signing');
    const actualTeam = /^TeamIdentifier=(.+)$/m.exec(signature)?.[1];
    if (!teamId || actualTeam !== teamId) throw new Error('Mac signing Team ID does not match release configuration');
    run('/usr/bin/codesign', ['--verify', '--deep', '--strict', artifact]);
    run('/usr/bin/xcrun', ['stapler', 'validate', artifact]);
    run('/usr/sbin/spctl', ['--assess', '--type', 'execute', artifact]);
  }
}
if (require.main === module) {
  try {
    requireSigningInputs(process.env);
    if (!process.argv.includes('--preflight')) {
      const directory = process.argv[2] || 'dist';
      const artifacts = fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory() && entry.name.startsWith('mac')).flatMap(entry => {
        const folder = path.join(directory, entry.name);
        return fs.readdirSync(folder).filter(name => name.endsWith('.app')).map(name => path.join(folder, name));
      });
      verifyMacRelease(artifacts, process.env.APPLE_TEAM_ID);
    }
    process.stdout.write('Mac release signing prerequisites verified\n');
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
module.exports = { requireSigningInputs, verifyMacRelease };
