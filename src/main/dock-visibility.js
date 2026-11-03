function createDockVisibility(dock) {
  let desired = dock.isVisible();
  let lastShow = -Infinity;
  let pendingShow = false;
  let timer = null;
  let disposed = false;
  function setVisible(visible) {
    if (disposed) return;
    desired = Boolean(visible);
    clearTimeout(timer);
    if (desired) {
      if (dock.isVisible() || pendingShow) return;
      lastShow = Date.now();
      pendingShow = true;
      Promise.resolve(dock.show()).then(() => {
        pendingShow = false;
        if (!desired) setVisible(false);
      }, () => { pendingShow = false; });
    } else {
      // Electron 28 ignores DockHide during the second after DockShow.
      const delay = Math.max(0, lastShow + 1100 - Date.now());
      const hide = () => { if (!disposed && !desired && dock.isVisible()) dock.hide(); };
      if (delay) timer = setTimeout(hide, delay);
      else hide();
    }
  }
  return { setVisible, dispose: () => { disposed = true; clearTimeout(timer); } };
}
module.exports = { createDockVisibility };
