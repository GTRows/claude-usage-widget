const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
async function verifyUpdateMetadata(directory) {
  const manifests = fs.readdirSync(directory).filter(name => /^latest(?:-mac|-linux(?:-[a-z0-9]+)?)?\.yml$/.test(name));
  if (!manifests.length) throw new Error('No update metadata generated');
  const results = [];
  for (const manifest of manifests) {
    const info = yaml.load(fs.readFileSync(path.join(directory, manifest), 'utf8'));
    if (!info?.version || !Array.isArray(info.files) || !info.files.length) throw new Error(`Invalid update metadata: ${manifest}`);
    const files = [];
    for (const entry of info.files) {
      const file = decodeURIComponent(entry.url || '');
      if (!file || file !== path.basename(file) || /[\\/:]/.test(file)) throw new Error('Invalid artifact path');
      const hash = crypto.createHash('sha512');
      for await (const chunk of fs.createReadStream(path.join(directory, file))) hash.update(chunk);
      if (hash.digest('base64') !== entry.sha512) throw new Error(`Checksum mismatch: ${file}`);
      files.push(file);
    }
    results.push({ manifest, version: info.version, files });
  }
  return results;
}
if (require.main === module) verifyUpdateMetadata(process.argv[2] || 'dist').then(results => {
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
}).catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
module.exports = { verifyUpdateMetadata };
