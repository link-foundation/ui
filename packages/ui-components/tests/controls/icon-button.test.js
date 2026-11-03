/**
 * icon-button: the label is the accessible name and the tooltip; a
 * missing label is a `missing-label` diagnostic.
 */

import { describe, it, expect } from 'test-anywhere';
import { attrs, mountDoc } from '../support/controls.js';

describe('icon-button', () => {
  it('names the button with its label and hides the icon', () => {
    const t = mountDoc(
      `  (close: icon-button close (label 'Close') (on press (emit closed)))`
    );
    expect(t.codes()).toEqual([]);
    const root = t.part('close', 'root');
    expect(root.tagName).toBe('BUTTON');
    expect(attrs(root, ['aria-label', 'title'])).toEqual({
      'aria-label': 'Close',
      title: 'Close',
    });
    const icon = t.part('close', 'icon');
    expect(icon.getAttribute('name')).toBe('close');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    root.click();
    expect(t.emitted.map((e) => e.event)).toEqual(['closed']);
  });

  it('reports a missing label', () => {
    const t = mountDoc(`  (close: icon-button close)`);
    expect(t.codes()).toEqual(['missing-label@close:label']);
    expect(t.part('close', 'root').hasAttribute('aria-label')).toBe(false);
  });

  it('is disabled with the native flag', () => {
    const t = mountDoc(
      `  (gear: icon-button settings (label 'Settings') (disabled true))`
    );
    expect(t.part('gear', 'root').disabled).toBe(true);
  });
});
