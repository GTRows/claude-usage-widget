import { describe, it, expect, vi } from 'vitest';
import { createAccountTransition } from '../src/renderer/account-transition.js';

function fixture(reduce = false) {
  const classes = new Set();
  const attributes = {};
  const cancel = vi.fn();
  const view = { style: { display: 'block' }, animate: vi.fn(() => ({ cancel })) };
  const body = {
    classList: { add: (...names) => names.forEach((name) => classes.add(name)), remove: (...names) => names.forEach((name) => classes.delete(name)) },
    setAttribute: (key, value) => { attributes[key] = value; },
  };
  const flow = createAccountTransition({ body, content: () => view, reducedMotion: () => reduce });
  return { flow, classes, attributes, view, cancel };
}

describe('account switch presentation', () => {
  it('finishes the loading state when the target account is ready', () => {
    const f = fixture();
    f.flow.begin('personal');
    expect(f.attributes['aria-busy']).toBe('true');
    f.flow.complete('personal');
    expect(f.flow.isPending()).toBe(false);
    expect(f.classes.has('account-switching')).toBe(false);
    expect(f.view.animate).toHaveBeenCalledTimes(1);
  });

  it('does not reveal a stale account while a newer selection is pending', () => {
    const f = fixture();
    f.flow.begin('work');
    f.flow.begin('personal');
    f.flow.complete('work');
    expect(f.flow.accepts('work')).toBe(false);
    expect(f.flow.isFor('personal')).toBe(true);
    expect(f.view.animate).not.toHaveBeenCalled();
    f.flow.complete('personal');
    expect(f.flow.isPending()).toBe(false);
  });

  it('cancels the current animation on reset', () => {
    const f = fixture();
    f.flow.begin('personal');
    f.flow.complete('personal');
    f.flow.reset();
    expect(f.classes.size).toBe(0);
    expect(f.cancel).toHaveBeenCalledTimes(1);
  });

  it('respects reduced motion while still completing the account switch', () => {
    const f = fixture(true);
    f.flow.begin('work');
    f.flow.complete('work');
    expect(f.view.animate).not.toHaveBeenCalled();
    expect(f.attributes['aria-busy']).toBe('false');
  });

});
