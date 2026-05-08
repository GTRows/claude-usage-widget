import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const requireCJS = createRequire(import.meta.url);
const I18N_PATH = requireCJS.resolve('../src/shared/i18n.js');
const TR_PATH = requireCJS.resolve('../src/shared/locales/tr.js');
const EN_PATH = requireCJS.resolve('../src/shared/locales/en.js');

function freshI18n() {
  delete requireCJS.cache[I18N_PATH];
  delete requireCJS.cache[TR_PATH];
  delete requireCJS.cache[EN_PATH];
  return requireCJS(I18N_PATH);
}

describe('i18n shared module', () => {
  let i18n;

  beforeEach(() => {
    i18n = freshI18n();
  });

  it('loads both locales at boot and defaults to tr', () => {
    expect(i18n.SUPPORTED_LANGUAGES).toEqual(['tr', 'en']);
    expect(i18n.DEFAULT_LANGUAGE).toBe('tr');
    expect(i18n.getLanguage()).toBe('tr');
    expect(i18n.t('common.loading')).toBe('Yükleniyor…');
  });

  it('switches language and reflects it in t() and getLocaleTag()', () => {
    expect(i18n.setLanguage('en')).toBe(true);
    expect(i18n.getLanguage()).toBe('en');
    expect(i18n.t('common.loading')).toBe('Loading…');
    expect(i18n.getLocaleTag()).toBe('en-US');
  });

  it('falls back from active locale to en, and from en to the key string', () => {
    expect(i18n.t('definitely.not.a.real.key')).toBe('definitely.not.a.real.key');
    const tr = requireCJS(TR_PATH);
    delete tr['common.dismiss'];
    expect(i18n.t('common.dismiss')).toBe('Dismiss');
  });

  it('interpolates {var} placeholders', () => {
    const tr = requireCJS(TR_PATH);
    const en = requireCJS(EN_PATH);
    tr['test.greet'] = 'Merhaba {name}!';
    en['test.greet'] = 'Hello {name}!';
    expect(i18n.t('test.greet', { name: 'Ada' })).toBe('Merhaba Ada!');
    i18n.setLanguage('en');
    expect(i18n.t('test.greet', { name: 'Ada' })).toBe('Hello Ada!');
    expect(i18n.t('test.greet', { wrong: 'x' })).toBe('Hello {name}!');
  });

  it('refuses unknown languages and leaves state unchanged', () => {
    expect(i18n.setLanguage('en')).toBe(true);
    expect(i18n.setLanguage('xx')).toBe(false);
    expect(i18n.getLanguage()).toBe('en');
  });

  it('returns empty string for non-string keys without throwing', () => {
    expect(i18n.t()).toBe('');
    expect(i18n.t(null)).toBe('');
    expect(i18n.t('')).toBe('');
  });
});
