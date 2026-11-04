export function watchContentHeight() {
  const app = document.getElementById('app');
  const widget = document.getElementById('widgetContainer');
  let frame = null;
  let lastHeight = 0;

  function measure() {
    frame = null;
    const overlay = [...widget.querySelectorAll('.settings-overlay')]
      .find((element) => element.getClientRects().length);
    app.classList.toggle('settings-visible', Boolean(overlay));
    const scrollPositions = [widget, ...widget.querySelectorAll('#mainContent, #loginContainer, .settings-rows')]
      .map((element) => [element, element.scrollTop]);
    app.classList.add('measuring-content');
    const appStyle = getComputedStyle(app);
    const height = Math.ceil((overlay
      ? overlay.offsetTop + overlay.getBoundingClientRect().height + parseFloat(getComputedStyle(widget).borderBottomWidth)
      : widget.getBoundingClientRect().height) + parseFloat(appStyle.paddingTop) + parseFloat(appStyle.paddingBottom));
    app.classList.remove('measuring-content');
    for (const [element, top] of scrollPositions) element.scrollTop = top;
    if (height !== lastHeight) {
      lastHeight = height;
      window.electronAPI.fitContentHeight(height);
    }
  }

  function schedule() {
    if (frame === null) frame = requestAnimationFrame(measure);
  }

  const mutations = new MutationObserver(schedule);
  mutations.observe(widget, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  mutations.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme-style'] });
  const sizes = new ResizeObserver(schedule);
  sizes.observe(widget);
  for (const element of widget.children) sizes.observe(element);
  document.fonts.ready.then(schedule);
  window.addEventListener('resize', schedule);
  schedule();
  return () => {
    mutations.disconnect();
    sizes.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
  };
}
