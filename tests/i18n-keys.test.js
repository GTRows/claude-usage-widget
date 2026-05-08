import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireCJS = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const tr = requireCJS('../src/shared/locales/tr');
const en = requireCJS('../src/shared/locales/en');

const SOURCE_FILES = [
  '../main.js',
  '../bin/cli.js',
  '../src/renderer/app.js',
  '../src/cli/widget-store.js'
];

const KEY_REGEX = /(?:^|[^\w])(?:i18n\.t|window\.i18n\.t|\bt)\(['"]([\w.]+)['"]/g;

function extractKeysFromFile(relPath) {
  const abs = join(__dirname, relPath);
  const src = readFileSync(abs, 'utf8');
  const keys = new Set();
  let match;
  while ((match = KEY_REGEX.exec(src)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

describe('i18n key catalog', () => {
  it('both locales have identical key sets', () => {
    const trKeys = Object.keys(tr).sort();
    const enKeys = Object.keys(en).sort();
    expect(trKeys).toEqual(enKeys);
  });

  it('seed keys from 07-01 still exist', () => {
    expect(tr['app.name']).toBeTruthy();
    expect(tr['common.loading']).toBeTruthy();
    expect(tr['common.dismiss']).toBeTruthy();
    expect(en['app.name']).toBeTruthy();
    expect(en['common.loading']).toBeTruthy();
    expect(en['common.dismiss']).toBeTruthy();
  });

  it('every t(...) call site references a key that exists in both locales', () => {
    const allUsedKeys = new Set();
    for (const file of SOURCE_FILES) {
      for (const k of extractKeysFromFile(file)) allUsedKeys.add(k);
    }
    const missing = [];
    for (const key of allUsedKeys) {
      if (!Object.prototype.hasOwnProperty.call(tr, key)) missing.push(`tr:${key}`);
      if (!Object.prototype.hasOwnProperty.call(en, key)) missing.push(`en:${key}`);
    }
    expect(missing).toEqual([]);
  });

  it('every locale value is a non-empty string', () => {
    for (const [k, v] of Object.entries(tr)) {
      expect(typeof v, `tr.${k}`).toBe('string');
      expect(v.length, `tr.${k}`).toBeGreaterThan(0);
    }
    for (const [k, v] of Object.entries(en)) {
      expect(typeof v, `en.${k}`).toBe('string');
      expect(v.length, `en.${k}`).toBeGreaterThan(0);
    }
  });

  it('every key avoids template-literal and printf placeholders (only {name} allowed)', () => {
    for (const [k, v] of Object.entries(tr)) {
      expect(v.includes('${'), `tr.${k} contains template-literal syntax`).toBe(false);
      expect(v.match(/%[sd]/), `tr.${k} contains printf-style placeholder`).toBeNull();
    }
    for (const [k, v] of Object.entries(en)) {
      expect(v.includes('${'), `en.${k} contains template-literal syntax`).toBe(false);
      expect(v.match(/%[sd]/), `en.${k} contains printf-style placeholder`).toBeNull();
    }
  });
});
