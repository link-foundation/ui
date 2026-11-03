/**
 * button: a native `<button>`; a click is `(on press ...)`, the machine
 * tracks the pressed state, a disabled button never presses.
 */

import { describe, it, expect } from 'test-anywhere';
import { mountDoc } from '../support/controls.js';

const pointer = (t, node, type) =>
  node.dispatchEvent(new t.window.Event(type, { bubbles: true }));

describe('button', () => {
  it('renders a native button with its label and variant', () => {
    const t = mountDoc(`  (save: button 'Save' (variant tonal))`);
    expect(t.codes()).toEqual([]);
    const root = t.part('save', 'root');
    expect(root.tagName).toBe('BUTTON');
    expect(root.getAttribute('type')).toBe('button');
    expect(t.part('save', 'label').textContent).toBe('Save');
    expect(t.part('save', 'icon').hidden).toBe(true);
    expect(t.node('save').getAttribute('variant')).toBe('tonal');
  });

  it('dispatches (on press ...) on a click', () => {
    const t = mountDoc(`  (save: button 'Save' (on press (emit saved)))`);
    t.part('save', 'root').click();
    expect(t.actions).toEqual(['save:press']);
    expect(t.emitted.map((e) => e.event)).toEqual(['saved']);
  });

  it('is pressed between pointerdown and pointerup', () => {
    const t = mountDoc(`  (save: button 'Save')`);
    const root = t.part('save', 'root');
    expect(root.getAttribute('data-state')).toBe('idle');
    pointer(t, root, 'pointerdown');
    expect(root.getAttribute('data-state')).toBe('pressed');
    pointer(t, root, 'pointerup');
    expect(root.getAttribute('data-state')).toBe('idle');
    pointer(t, root, 'pointerdown');
    pointer(t, root, 'pointerleave');
    expect(root.getAttribute('data-state')).toBe('idle');
  });

  it('is natively disabled and never pressed when disabled', () => {
    const t = mountDoc(
      `  (save: button 'Save' (disabled true) (on press (emit saved)))`
    );
    const root = t.part('save', 'root');
    expect(root.disabled).toBe(true);
    pointer(t, root, 'pointerdown');
    expect(root.getAttribute('data-state')).toBe('idle');
    root.click();
    expect(t.emitted).toEqual([]);
  });

  it('submits a form as a submit button', () => {
    const t = mountDoc(`  (go: button 'Send' (type submit))`);
    expect(t.part('go', 'root').getAttribute('type')).toBe('submit');
  });
});
