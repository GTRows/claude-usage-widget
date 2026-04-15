import { describe, it, expect } from 'vitest';
import { summary, inlinePrompt, bar, pickPercent } from '../src/cli/render.js';

const data = {
  five_hour: { utilization: 42 },
  seven_day: { utilization: 88 },
};

describe('bar', () => {
  it('respects width and clamps percent', () => {
    const out = bar(50, 10, false);
    expect(out).toBe('[#####-----]');
    expect(bar(150, 10, false)).toBe('[##########]');
    expect(bar(-10, 10, false)).toBe('[----------]');
  });
});

describe('pickPercent', () => {
  it('reads either numeric or {utilization} fields', () => {
    expect(pickPercent({ a: 50 }, 'a')).toBe(50);
    expect(pickPercent({ a: { utilization: 33 } }, 'a')).toBe(33);
    expect(pickPercent({}, 'missing')).toBe(0);
  });
});

describe('summary', () => {
  it('emits two lines without color when forced', () => {
    const out = summary(data, { color: false });
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('5h');
    expect(lines[0]).toContain('42%');
    expect(lines[1]).toContain('7d');
    expect(lines[1]).toContain('88%');
  });
});

describe('inlinePrompt', () => {
  it('emits compact one-liner', () => {
    const out = inlinePrompt(data, { color: false });
    expect(out).toBe('5h:42% 7d:88%');
  });
  it('renders requested segments in order', () => {
    const wide = { ...data, opus: { utilization: 12 }, sonnet: { utilization: 30 }, extra_usage: { utilization: 5 } };
    const out = inlinePrompt(wide, { color: false, segments: ['opus', 'sonnet', 'extra'] });
    expect(out).toBe('op:12% so:30% ex:5%');
  });
  it('ignores unknown segment names', () => {
    const out = inlinePrompt(data, { color: false, segments: ['5h', 'bogus'] });
    expect(out).toBe('5h:42%');
  });
});
