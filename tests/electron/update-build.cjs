const fs = require('fs');
const spec = JSON.parse(fs.readFileSync(process.env.WIDGET_UPDATE_BUILD_SPEC, 'utf8'));
const base = require('../../package.json').build;
module.exports = {
  ...base, appId: 'com.gtrows.widgetupdatefixture', productName: 'Widget-Update-Fixture',
  directories: { output: spec.output },
  extraMetadata: { name: 'widget-update-fixture', version: spec.version, main: 'tests/electron/update-bootstrap.cjs', widgetUpdateFixture: { dataDirectory: spec.dataDirectory, target: '99.0.1-gtrows.1' } },
  files: [...base.files, 'tests/electron/update-bootstrap.cjs'],
  publish: [{ provider: 'generic', channel: 'latest', url: spec.feed }],
  nsis: { ...base.nsis, oneClick: false, perMachine: false, runAfterFinish: false, artifactName: 'Widget-Update-Fixture-${version}-Setup.${ext}' },
  win: { ...base.win, target: ['nsis'] },
};
