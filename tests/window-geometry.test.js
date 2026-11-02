import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { fitWindowBounds, trayWindowBounds } = require('../src/shared/window-geometry');

describe('reachable widget geometry', () => {
  const area = { x: 0, y: 25, width: 1440, height: 875 };
  it('recovers a disconnected screen position without overflowing the current display', () => {
    expect(fitWindowBounds({ x: 2500, y: 1000, width: 590, height: 640 }, area)).toEqual({ x: 842, y: 252, width: 590, height: 640 });
  });
  it('moves a growing window upwards so settings remain reachable', () => {
    expect(fitWindowBounds({ x: 120, y: 700, width: 590, height: 640 }, area).y).toBe(252);
  });
  it('supports screens with negative coordinates and fits oversized content', () => {
    expect(fitWindowBounds({ x: -2000, y: -100, width: 590, height: 900 }, { x: -1280, y: 0, width: 1280, height: 720 })).toEqual({ x: -1272, y: 8, width: 590, height: 704 });
  });
  it('anchors below a Mac menu bar and above a Windows taskbar', () => {
    expect(trayWindowBounds({ width: 300, height: 250 }, { x: 1300, y: 0, width: 24, height: 25 }, area)).toEqual({ x: 1132, y: 33, width: 300, height: 250 });
    expect(trayWindowBounds({ width: 300, height: 250 }, { x: 1300, y: 900, width: 24, height: 40 }, area).y).toBe(642);
  });
});
