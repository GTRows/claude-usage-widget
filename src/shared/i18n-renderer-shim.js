(function () {
  if (typeof window === 'undefined') return;
  const locales = (window.__locales = window.__locales || {});

  const SUPPORTED = ['tr', 'en'];
  const DEFAULT_LANG = 'tr';
  const FALLBACK_LANG = 'en';

  let active = DEFAULT_LANG;

  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang)) return false;
    active = lang;
    return true;
  }

  function getLanguage() {
    return active;
  }

  function getLocaleTag() {
    return active === 'tr' ? 'tr-TR' : 'en-US';
  }

  function interpolate(template, vars) {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (m, name) => (
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m
    ));
  }

  function t(key, vars) {
    if (typeof key !== 'string' || !key) return '';
    const a = locales[active];
    if (a && Object.prototype.hasOwnProperty.call(a, key)) return interpolate(a[key], vars);
    const f = locales[FALLBACK_LANG];
    if (f && Object.prototype.hasOwnProperty.call(f, key)) return interpolate(f[key], vars);
    return key;
  }

  window.i18n = {
    t,
    setLanguage,
    getLanguage,
    getLocaleTag,
    SUPPORTED_LANGUAGES: SUPPORTED,
    DEFAULT_LANGUAGE: DEFAULT_LANG
  };
})();
