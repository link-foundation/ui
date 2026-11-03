/** badge: a visible value, completed by its label for assistive technology. */

import { describe, it, expect } from 'test-anywhere';
import { mountDoc } from '../support/controls.js';

describe('badge', () => {
  it('reads the value and the label together', () => {
    const t = mountDoc(
      `  (unread: badge 3 (label 'unread messages') (tone primary))`
    );
    expect(t.codes()).toEqual([]);
    expect(t.part('unread', 'indicator').textContent).toBe('3');
    expect(t.part('unread', 'label').textContent).toBe(' unread messages');
    expect(t.part('unread', 'root').textContent).toBe('3 unread messages');
    expect(t.node('unread').getAttribute('tone')).toBe('primary');
  });

  it('shows the label alone without a value', () => {
    const t = mountDoc(`  (beta: badge (label 'Beta'))`);
    expect(t.part('beta', 'indicator').textContent).toBe('Beta');
    expect(t.part('beta', 'label').hidden).toBe(true);
    expect(t.node('beta').getAttribute('tone')).toBe('neutral');
  });

  it('falls back to the neutral tone and warns without any text', () => {
    const t = mountDoc(`  (x: badge (tone loud))`);
    expect(t.node('x').getAttribute('tone')).toBe('neutral');
    expect(t.codes()).toContain('missing-label@x:value');
  });
});
