const en = require('./locales/en');
const tr = require('./locales/tr');

const SUPPORTED_LANGUAGES = ['tr', 'en'];
const DEFAULT_LANGUAGE = 'tr';
const FALLBACK_LANGUAGE = 'en';

const dictionaries = { tr, en };

let activeLanguage = DEFAULT_LANGUAGE;

function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) return false;
  activeLanguage = lang;
  return true;
}

function getLanguage() {
  return activeLanguage;
}

function getLocaleTag() {
  // BCP-47 tag for callers that need Intl.DateTimeFormat / Intl.NumberFormat.
  return activeLanguage === 'tr' ? 'tr-TR' : 'en-US';
}

function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return String(vars[name]);
    }
    return match;
  });
}

function t(key, vars) {
  if (typeof key !== 'string' || !key) return '';
  const active = dictionaries[activeLanguage];
  if (active && Object.prototype.hasOwnProperty.call(active, key)) {
    return interpolate(active[key], vars);
  }
  const fallback = dictionaries[FALLBACK_LANGUAGE];
  if (fallback && Object.prototype.hasOwnProperty.call(fallback, key)) {
    return interpolate(fallback[key], vars);
  }
  return key;
}

module.exports = {
  t,
  setLanguage,
  getLanguage,
  getLocaleTag,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
};
