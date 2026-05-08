const tr = {
  'app.name': 'Claude Widget',
  'common.loading': 'Yükleniyor…',
  'common.dismiss': 'Kapat'
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = tr;
}

if (typeof window !== 'undefined') {
  window.__locales = window.__locales || {};
  window.__locales.tr = tr;
}
