import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../src/shared/settings-schema.js';

function element(dataset = {}) {
  const classes = new Set();
  const attributes = {};
  return {
    dataset, attributes, style: {},
    classList: {
      toggle(name, active) { active ? classes.add(name) : classes.delete(name); },
      contains(name) { return classes.has(name); },
    },
    setAttribute(name, value) { attributes[name] = value; },
  };
}

async function environment(prefersDark = false) {
  const { createThemeController } = await import('../src/renderer/theme.js');
  const modeButtons = ['dark', 'light', 'system'].map(theme => element({ theme }));
  const styleButtons = ['classic', 'graphite', 'glass', 'nord'].map(themeStyle => element({ themeStyle }));
  const body = element();
  const root = element();
  const listeners = new Set();
  const media = {
    matches: prefersDark,
    addEventListener(type, listener) { listeners.add(listener); },
    removeEventListener(type, listener) { listeners.delete(listener); },
  };
  const persisted = [];
  const changes = [];
  const controller = createThemeController({
    document: {
      body, documentElement: root,
      querySelectorAll: selector => selector === '.theme-btn' ? modeButtons : styleButtons,
    },
    matchMedia: () => media,
    persist: patch => persisted.push(patch),
    onChange: state => changes.push(state),
  });
  const systemChanges = dark => {
    media.matches = dark;
    for (const listener of listeners) listener({ matches: dark });
  };
  return { controller, body, root, modeButtons, styleButtons, persisted, changes, systemChanges, listeners };
}

describe('theme preferences', () => {
  it('preserves saved new and existing styles without changing the legacy default', () => {
    for (const themeStyle of ['classic', 'plate', 'nord', 'sunset', 'mono', 'graphite', 'glass']) {
      expect(normalizeSettings({ themeStyle }).themeStyle).toBe(themeStyle);
    }
    expect(normalizeSettings({}).themeStyle).toBe('classic');
  });

  it('applies saved mode and style without writing preferences during initialization', async () => {
    const env = await environment(true);
    env.controller.apply({ theme: 'light', themeStyle: 'glass' });
    expect(env.body.classList.contains('theme-light')).toBe(true);
    expect(env.body.attributes['data-theme-style']).toBe('glass');
    expect(env.root.style.colorScheme).toBe('light');
    expect(env.persisted).toEqual([]);
    expect(env.changes.at(-1)).toEqual({ theme: 'light', themeStyle: 'glass', resolvedTheme: 'light' });
  });

  it('persists a user choice immediately and keeps style and mode independent', async () => {
    const env = await environment();
    env.controller.apply({ theme: 'light', themeStyle: 'nord' });
    env.controller.setStyle('graphite');
    expect(env.persisted).toEqual([{ themeStyle: 'graphite' }]);
    expect(env.body.classList.contains('theme-light')).toBe(true);
    env.controller.setMode('dark');
    expect(env.persisted).toEqual([{ themeStyle: 'graphite' }, { theme: 'dark' }]);
    expect(env.controller.getState()).toEqual({ theme: 'dark', themeStyle: 'graphite', resolvedTheme: 'dark' });
  });

  it('updates accessible selected state for both button groups', async () => {
    const env = await environment();
    env.controller.apply({ theme: 'system', themeStyle: 'glass' });
    expect(env.modeButtons.map(button => button.attributes['aria-pressed'])).toEqual(['false', 'false', 'true']);
    expect(env.styleButtons.map(button => button.classList.contains('active'))).toEqual([false, false, true, false]);
    expect(env.styleButtons[2].attributes['aria-pressed']).toBe('true');
    expect(env.body.attributes['data-theme-mode']).toBe('system');
  });

  it('follows system mode changes and requests chart repaint without persisting resolved mode', async () => {
    const env = await environment(false);
    env.controller.apply({ theme: 'system', themeStyle: 'glass' });
    env.systemChanges(true);
    expect(env.body.classList.contains('theme-light')).toBe(false);
    expect(env.root.style.colorScheme).toBe('dark');
    expect(env.changes.at(-1)).toEqual({ theme: 'system', themeStyle: 'glass', resolvedTheme: 'dark' });
    expect(env.persisted).toEqual([]);
  });

  it('ignores system mode changes for an explicit user mode and releases the listener', async () => {
    const env = await environment(false);
    env.controller.apply({ theme: 'light', themeStyle: 'graphite' });
    env.systemChanges(true);
    expect(env.changes).toHaveLength(1);
    expect(env.root.style.colorScheme).toBe('light');
    env.controller.setMode('system');
    expect(env.root.style.colorScheme).toBe('dark');
    env.controller.destroy();
    env.systemChanges(false);
    expect(env.root.style.colorScheme).toBe('dark');
    expect(env.listeners.size).toBe(0);
  });

  it('normalizes unsupported values and does not expose mutable internal state', async () => {
    const env = await environment();
    env.controller.apply({ theme: 'unknown', themeStyle: 'unknown' });
    const state = env.controller.getState();
    state.theme = 'light';
    expect(env.controller.getState()).toEqual({ theme: 'dark', themeStyle: 'classic', resolvedTheme: 'dark' });
    expect(env.body.attributes['data-theme-style']).toBe('classic');
  });

  it('works without an OS media query API and avoids redundant persistence', async () => {
    const { createThemeController } = await import('../src/renderer/theme.js');
    const persisted = [];
    const controller = createThemeController({ document: null, matchMedia: null, persist: patch => persisted.push(patch) });
    controller.apply({ theme: 'system', themeStyle: 'glass' });
    controller.setStyle('glass');
    expect(controller.getState()).toEqual({ theme: 'system', themeStyle: 'glass', resolvedTheme: 'light' });
    expect(persisted).toEqual([]);
    controller.destroy();
  });
});
