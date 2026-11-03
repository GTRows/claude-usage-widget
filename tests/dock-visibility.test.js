import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createDockVisibility } = require('../src/main/dock-visibility');

describe('macOS Dock visibility', () => {
  it('does not reactivate an already visible Dock on repeated restores', () => {
    let shows = 0;
    const controller = createDockVisibility({ isVisible: () => true, show: () => { shows++; }, hide: () => {} });
    controller.setVisible(true);
    controller.setVisible(true);
    expect(shows).toBe(0);
  });
  it('delays a hide requested immediately after showing the Dock', async () => {
    vi.useFakeTimers();
    try {
      let visible = false;
      let shows = 0;
      const controller = createDockVisibility({ isVisible: () => visible, show: () => { shows++; visible = true; }, hide: () => { visible = false; } });
      controller.setVisible(true);
      controller.setVisible(true);
      controller.setVisible(false);
      expect(shows).toBe(1);
      expect(visible).toBe(true);
      await vi.advanceTimersByTimeAsync(1100);
      expect(visible).toBe(false);
      controller.dispose();
    } finally { vi.useRealTimers(); }
  });
});
