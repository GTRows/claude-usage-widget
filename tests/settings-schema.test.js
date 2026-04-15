import { describe, it, expect } from 'vitest';
import { SETTINGS_DEFAULTS, normalizeSettings } from '../src/shared/settings-schema.js';

describe('normalizeSettings', () => {
  it('returns defaults for empty input', () => {
    expect(normalizeSettings({})).toEqual(SETTINGS_DEFAULTS);
  });
  it('coerces booleans', () => {
    expect(normalizeSettings({ alwaysOnTop: 0 }).alwaysOnTop).toBe(false);
    expect(normalizeSettings({ alwaysOnTop: 1 }).alwaysOnTop).toBe(true);
  });
  it('rejects unknown enum values and falls back', () => {
    expect(normalizeSettings({ themeStyle: 'gibberish' }).themeStyle).toBe('classic');
    expect(normalizeSettings({ trayStyle: 'something' }).trayStyle).toBe('bigNumber');
  });
  it('clamps numeric ranges', () => {
    expect(normalizeSettings({ refreshInterval: 1 }).refreshInterval).toBe(15);
    expect(normalizeSettings({ refreshInterval: 999999 }).refreshInterval).toBe(86400);
    expect(normalizeSettings({ warnThreshold: 0 }).warnThreshold).toBe(1);
    expect(normalizeSettings({ warnThreshold: 200 }).warnThreshold).toBe(99);
  });
  it('keeps danger >= warn', () => {
    const s = normalizeSettings({ warnThreshold: 80, dangerThreshold: 50 });
    expect(s.dangerThreshold).toBe(80);
  });
  it('falls back the active profile to default when missing or empty', () => {
    expect(normalizeSettings({ activeProfile: '' }).activeProfile).toBe('default');
    expect(normalizeSettings({ activeProfile: 123 }).activeProfile).toBe('123');
  });
});
