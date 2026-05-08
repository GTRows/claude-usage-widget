const en = {
  'app.name': 'Claude Widget',
  'common.loading': 'Loading…',
  'common.dismiss': 'Dismiss'
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = en;
}

if (typeof window !== 'undefined') {
  window.__locales = window.__locales || {};
  window.__locales.en = en;
}
