const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { screen } = require('electron');

module.exports = async function checkContentWindow(win, js, delay, screenshots) {
  const settle = () => delay(450);
  const click = async (id) => { await js(`document.getElementById(${JSON.stringify(id)}).click()`); await settle(); };
  const maxHeight = () => Math.floor(screen.getDisplayMatching(win.getBounds()).workArea.height * 70 / 100);
  const checkFit = async () => {
    assert(win.getBounds().height <= maxHeight(), 'Window must stay below seventy percent of the work area');
    assert.equal(await js(`(() => {
      const widget = document.getElementById('widgetContainer').getBoundingClientRect();
      return Math.abs(widget.bottom + 6 - innerHeight) <= 1;
    })()`), true, 'Window must fit its content without unused space');
    if (win.getBounds().height < maxHeight()) {
      assert.equal(await js(`['mainContent', 'widgetContainer', 'accountList', 'loginContainer'].every((id) => {
        const element = document.getElementById(id);
        return !element.getClientRects().length || element.scrollHeight <= element.clientHeight + 1;
      })`), true, 'Content must not scroll before the height limit');
    }
  };
  if (await js('getComputedStyle(document.getElementById("graphSection")).display !== "none"')) await click('graphBtn');
  await settle();
  const home = win.getBounds();
  await checkFit();
  fs.writeFileSync(path.join(screenshots, 'content-home.png'), (await win.webContents.capturePage()).toPNG());
  await click('graphBtn');
  assert(win.getBounds().height > home.height, 'Opening the graph must grow the window');
  await checkFit();
  fs.writeFileSync(path.join(screenshots, 'content-graph.png'), (await win.webContents.capturePage()).toPNG());
  const getDisplay = screen.getDisplayMatching.bind(screen);
  const graphHeight = win.getBounds().height;
  try {
    screen.getDisplayMatching = (bounds) => {
      const display = getDisplay(bounds);
      return { ...display, workArea: { ...display.workArea, height: 600 } };
    };
    screen.emit('display-metrics-changed');
    await settle();
    assert.equal(win.getBounds().height, 420, 'Changing the display must recalculate the height limit');
  } finally {
    screen.getDisplayMatching = getDisplay;
    screen.emit('display-metrics-changed');
  }
  await settle();
  assert.equal(win.getBounds().height, graphHeight, 'A larger display must restore the requested content height');
  await click('graphBtn');
  assert.equal(win.getBounds().height, home.height, 'Closing the graph must shrink the window');
  await click('historyBtn');
  assert(win.getBounds().height > home.height, 'Opening the table must grow the window');
  await checkFit();
  await js(`document.querySelector('#historyRangeTabs [data-range="0"]').click()`);
  await settle();
  assert.equal(win.getBounds().height, maxHeight(), 'A large table must stop at the screen height limit');
  assert.equal(await js(`(() => {
    const main = document.getElementById('mainContent');
    main.scrollTop = main.scrollHeight;
    return main.scrollTop > 0 && main.scrollHeight <= main.clientHeight + main.scrollTop + 1;
  })()`), true, 'A capped table must scroll to its last row and pagination');
  await delay(1200);
  assert.equal(await js(`(() => {
    const main = document.getElementById('mainContent');
    return main.scrollTop > 0 && main.scrollHeight <= main.clientHeight + main.scrollTop + 1;
  })()`), true, 'Remeasuring content must preserve the table scroll position');
  fs.writeFileSync(path.join(screenshots, 'content-table-capped.png'), (await win.webContents.capturePage()).toPNG());
  await click('historyBtn');
  assert.equal(win.getBounds().height, home.height);
  for (const action of ['expandToggle', 'expandToggle', 'refreshBtn', 'settingsBtn', 'closeSettingsBtn',
    'settingsBtn', 'settingsAddAccountBtn', 'cancelAddAccount']) {
    await click(action);
    await checkFit();
    assert.equal(win.getBounds().width, home.width);
  }
  assert.equal(win.getBounds().height, home.height, 'Canceling account setup must restore the home height');
  await click('compactCollapseBtn');
  const compact = win.getBounds();
  assert(compact.width < home.width);
  await checkFit();
  await js(`(() => {
    const list = document.getElementById('accountList');
    for (let i = 0; i < 12; i++) {
      const clone = list.firstElementChild.cloneNode(true);
      clone.dataset.fixture = 'true';
      list.append(clone);
    }
  })()`);
  await settle();
  assert.equal(win.getBounds().height, maxHeight(), 'Compact account lists must also respect the limit');
  await js('document.getElementById("widgetContainer").scrollTop = 10000');
  assert(await js('document.getElementById("widgetContainer").scrollTop > 0'));
  await click('settingsBtn');
  assert.equal(await js(`getComputedStyle(document.getElementById('widgetContainer')).overflowY`), 'hidden',
    'Settings must scroll internally without a second outer scrollbar');
  assert.equal(await js(`(() => {
    const button = document.getElementById('closeSettingsBtn').getBoundingClientRect();
    return button.top >= 35 && button.bottom <= innerHeight;
  })()`), true, 'Settings controls must remain visible after scrolling compact accounts');
  assert.equal(await js(`(() => {
    const rows = document.querySelector('#settingsOverlay .settings-rows');
    rows.scrollTop = rows.scrollHeight;
    return rows.lastElementChild.getBoundingClientRect().bottom <= rows.getBoundingClientRect().bottom + 1;
  })()`), true, 'Capped settings must remain scrollable to the last group');
  fs.writeFileSync(path.join(screenshots, 'compact-settings.png'), (await win.webContents.capturePage()).toPNG());
  await click('closeSettingsBtn');
  await js('document.querySelectorAll("[data-fixture]").forEach((element) => element.remove())');
  await settle();
  assert.equal(win.getBounds().height, compact.height, 'Removing content must shrink compact mode');
  await click('compactExpandBtn');
  assert.equal(win.getBounds().width, home.width);
  assert.equal(win.getBounds().height, home.height);
  win.webContents.reload();
  for (let i = 0; i < 100; i++) {
    await delay(100);
    if (await js('document.getElementById("sessionPercentage")?.textContent === "38%"')) break;
  }
  await settle();
  assert.equal(win.getBounds().height, home.height, 'Reloading must restore the content height');
  await checkFit();
};
