import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { buildMacTrayFrame } from '../src/renderer/mac-tray.js';
const require = createRequire(import.meta.url);
const { createTrayFrameImage } = require('../src/main/tray-image');

function drawingSurface() {
  const context = {
    beginPath() {}, arc() {}, stroke() {}, fill() {}, fillRect() {},
    fillText() { throw new Error('A native percentage must not also be painted into the icon'); },
  };
  const canvas = { getContext: () => context, toDataURL: () => 'data:image/png;base64,fixture' };
  return { createElement: () => canvas };
}

describe('macOS menu bar presentation', () => {
  it.each([0, 5, 99, 100])('uses one native percentage for %s percent', (percent) => {
    const frame = buildMacTrayFrame(drawingSurface(), 'Session', percent, 'bigNumber');
    expect(frame.title).toBe(`${percent}%`);
    expect(frame.nativeTextOnly).toBe(true);
    expect(frame.tooltip).toBe(`Session: ${percent}%`);
  });

  it.each(['ring', 'bar', 'dot'])('draws a monochrome %s without a second number', (style) => {
    const frame = buildMacTrayFrame(drawingSurface(), 'Weekly', 12, style);
    expect(frame.title).toBe('12%');
    expect(frame.template).toBe(true);
    expect(frame.nativeTextOnly).toBe(false);
  });

  it('removes the bitmap for native text and leaves Windows frame images unchanged', () => {
    const bitmap = {};
    const empty = {};
    const nativeImage = { createFromDataURL: () => bitmap, createEmpty: () => empty };
    const frame = { dataURL: 'fixture', nativeTextOnly: true };
    expect(createTrayFrameImage(nativeImage, frame, 'darwin')).toBe(empty);
    expect(createTrayFrameImage(nativeImage, frame, 'win32')).toBe(bitmap);
  });
});
