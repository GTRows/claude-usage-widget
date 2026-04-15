import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const modPath = path.join(process.cwd(), 'src/cli/widget-store.js');

let mod;
let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-usage-widget-test-'));
  process.env.CLAUDE_USAGE_WIDGET_DIR = tmp;
  delete require.cache[require.resolve(modPath)];
  mod = require(modPath);
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.CLAUDE_USAGE_WIDGET_DIR;
});

describe('widget-store directory resolution', () => {
  it('honours CLAUDE_USAGE_WIDGET_DIR override', () => {
    expect(mod.getWidgetUserDataDir()).toBe(tmp);
    expect(mod.getWidgetStorePath()).toBe(path.join(tmp, 'config.json'));
  });
});

describe('readWidgetStore', () => {
  it('returns null when the file is missing', () => {
    expect(mod.readWidgetStore()).toBeNull();
  });
  it('parses an existing config.json', () => {
    fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify({ a: 1 }));
    expect(mod.readWidgetStore()).toEqual({ a: 1 });
  });
  it('returns null on malformed json', () => {
    fs.writeFileSync(path.join(tmp, 'config.json'), '{not json');
    expect(mod.readWidgetStore()).toBeNull();
  });
});

describe('readWidgetHistory', () => {
  it('returns null when store is missing', () => {
    expect(mod.readWidgetHistory()).toBeNull();
  });
  it('returns [] when usageHistory is absent', () => {
    fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify({ settings: {} }));
    expect(mod.readWidgetHistory()).toEqual([]);
  });
  it('returns the stored array', () => {
    const rows = [{ timestamp: 1, session: 10 }, { timestamp: 2, session: 20 }];
    fs.writeFileSync(path.join(tmp, 'config.json'), JSON.stringify({ usageHistory: rows }));
    expect(mod.readWidgetHistory()).toEqual(rows);
  });
});
