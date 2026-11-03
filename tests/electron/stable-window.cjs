const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

module.exports = async function checkStableWindow(win, js, delay, screenshots) {
  const bounds = win.getBounds();
  const changes = [];
  const record = () => changes.push(win.getBounds());
  win.on('resize', record);
  win.on('move', record);
  try {
    for (const action of [
      'graphBtn', 'graphBtn', 'historyBtn', 'historyBtn',
      'expandToggle', 'expandToggle', 'refreshBtn',
      'settingsBtn', 'closeSettingsBtn',
      'settingsBtn', 'settingsAddAccountBtn', 'cancelAddAccount',
    ]) {
      await js(`document.getElementById(${JSON.stringify(action)}).click()`);
      await delay(350);
      assert.deepEqual(win.getBounds(), bounds, `${action} changed the window bounds`);
      if (action === 'settingsAddAccountBtn') {
        assert.equal(await js(`(() => {
          const container = document.getElementById('loginContainer');
          container.scrollTop = container.scrollHeight;
          return container.scrollHeight <= container.clientHeight + container.scrollTop + 1;
        })()`), true, 'Account setup must be scrollable to the end');
      }
    }
    assert(changes.every((next) => ['x', 'y', 'width', 'height'].every((key) => next[key] === bounds[key])),
      `Ordinary actions changed window bounds: ${JSON.stringify(changes)}`);
    assert.equal(await js('window.electronAPI.resizeWindow'), undefined);
  } finally {
    win.removeListener('resize', record);
    win.removeListener('move', record);
  }
  await js('document.getElementById("compactCollapseBtn").click()');
  await delay(350);
  const compactBounds = win.getBounds();
  assert(compactBounds.width < bounds.width, 'Compact mode must be an explicit smaller view');
  const compactChanges = [];
  const recordCompact = () => compactChanges.push(win.getBounds());
  win.on('resize', recordCompact);
  try {
    await js(`(() => {
      const list = document.getElementById('accountList');
      for (let i = 0; i < 3; i++) list.append(list.firstElementChild.cloneNode(true));
      document.getElementById('widgetContainer').scrollTop = 10000;
    })()`);
    assert(await js('document.getElementById("widgetContainer").scrollTop > 0'), 'Fixture must cover a scrolled compact window');
    for (const action of ['settingsBtn', 'closeSettingsBtn', 'refreshBtn']) {
      await js(`document.getElementById(${JSON.stringify(action)}).click()`);
      await delay(350);
      assert.deepEqual(win.getBounds(), compactBounds, `${action} resized compact mode`);
      if (action === 'settingsBtn') {
        assert.equal(await js(`(() => {
          const button = document.getElementById('closeSettingsBtn').getBoundingClientRect();
          return button.top >= 35 && button.bottom <= innerHeight;
        })()`), true, 'Settings controls must remain visible after scrolling compact accounts');
        fs.writeFileSync(path.join(screenshots, 'compact-settings.png'), (await win.webContents.capturePage()).toPNG());
      }
    }
    assert.equal(compactChanges.length, 0, 'Compact content must not resize the native window');
    fs.writeFileSync(path.join(screenshots, 'compact-fixed.png'), (await win.webContents.capturePage()).toPNG());
  } finally {
    win.removeListener('resize', recordCompact);
  }
  await js('document.getElementById("compactExpandBtn").click()');
  await delay(350);
  assert.equal(win.getBounds().width, bounds.width);
  assert.equal(win.getBounds().height, bounds.height);
  const reloadedBounds = win.getBounds();
  win.webContents.reload();
  for (let i = 0; i < 100; i++) {
    await delay(100);
    if (await js('document.getElementById("sessionPercentage")?.textContent === "38%"')) break;
  }
  await delay(300);
  assert.deepEqual(win.getBounds(), reloadedBounds, 'Reloading must keep the window bounds');
};
