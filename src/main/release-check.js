const https = require('https');
const { pickLatestRelease, isNewerVersion } = require('../shared/version');
const RELEASES_URL = 'https://github.com/GTRows/claude-usage-widget/releases';
function checkLatestRelease(currentVersion) {
  return new Promise((resolve) => {
    let request;
    const timer = setTimeout(() => { request?.destroy(); done({ ok: false }); }, 5000);
    function done(result) { clearTimeout(timer); resolve({ hasUpdate: false, version: null, releaseUrl: RELEASES_URL, ...result }); }
    request = https.get('https://api.github.com/repos/GTRows/claude-usage-widget/releases?per_page=20', {
      headers: { 'User-Agent': 'claude-usage-widget', Accept: 'application/vnd.github+json' },
    }, (response) => {
      if (response.statusCode !== 200) { response.resume(); done({ ok: false }); return; }
      let body = '';
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 2 * 1024 * 1024) { request.destroy(); done({ ok: false }); }
      });
      response.on('error', () => done({ ok: false }));
      response.on('end', () => {
        try {
          const releases = JSON.parse(body);
          if (!Array.isArray(releases)) { done({ ok: false }); return; }
          const latest = pickLatestRelease(releases.filter(release => !release.prerelease));
          done({ ok: true, hasUpdate: Boolean(latest && isNewerVersion(latest.version, currentVersion)), version: latest && isNewerVersion(latest.version, currentVersion) ? latest.version : null });
        } catch { done({ ok: false }); }
      });
    });
    request.on('error', () => done({ ok: false }));
  });
}
module.exports = { checkLatestRelease, RELEASES_URL };
