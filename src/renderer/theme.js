const MODES = new Set(['dark', 'light', 'system']);
const STYLES = new Set(['classic', 'plate', 'nord', 'sunset', 'mono', 'graphite', 'glass']);

/** Owns appearance state; the host supplies preference storage and chart repaint. */
export function createThemeController({
  document = globalThis.document,
  matchMedia = globalThis.matchMedia?.bind(globalThis),
  persist = () => {},
  onChange = () => {},
} = {}) {
  const media = matchMedia?.('(prefers-color-scheme: dark)');
  let theme = 'dark';
  let themeStyle = 'classic';
  let applied = false;

  function getState() {
    const resolvedTheme = theme === 'system' ? (media?.matches ? 'dark' : 'light') : theme;
    return { theme, themeStyle, resolvedTheme };
  }

  function render() {
    const state = getState();
    document?.body?.classList.toggle('theme-light', state.resolvedTheme === 'light');
    document?.body?.setAttribute('data-theme-style', themeStyle);
    document?.body?.setAttribute('data-theme-mode', theme);
    if (document?.documentElement) document.documentElement.style.colorScheme = state.resolvedTheme;
    for (const [selector, key, value] of [
      ['.theme-btn', 'theme', theme], ['.theme-style-btn', 'themeStyle', themeStyle],
    ]) {
      for (const button of document?.querySelectorAll(selector) || []) {
        const selected = button.dataset[key] === value;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      }
    }
    onChange(state);
    return state;
  }

  function apply(preferences = {}, { persist: save = false } = {}) {
    const patch = {};
    if ('theme' in preferences) {
      const next = MODES.has(preferences.theme) ? preferences.theme : 'dark';
      if (next !== theme) patch.theme = next;
      theme = next;
    }
    if ('themeStyle' in preferences) {
      const next = STYLES.has(preferences.themeStyle) ? preferences.themeStyle : 'classic';
      if (next !== themeStyle) patch.themeStyle = next;
      themeStyle = next;
    }
    applied = true;
    const state = render();
    if (save && Object.keys(patch).length) persist(patch);
    return state;
  }

  function systemChanged() {
    if (applied && theme === 'system') render();
  }

  media?.addEventListener('change', systemChanged);

  return {
    apply,
    setMode: value => apply({ theme: value }, { persist: true }),
    setStyle: value => apply({ themeStyle: value }, { persist: true }),
    getState,
    destroy: () => media?.removeEventListener('change', systemChanged),
  };
}
