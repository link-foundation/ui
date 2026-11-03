/**
 * label: a `<label for>` that names the input of another control, with a
 * required marker hidden from assistive technology.
 */

import { describe, it, expect } from 'test-anywhere';
import { mountDoc } from '../support/controls.js';

describe('label', () => {
  it('names the input of the control it is for', () => {
    const t = mountDoc(`  (lb: label 'Email' (for email))
  (email: text-field (name email))`);
    expect(t.codes().filter((code) => code.includes('@lb:'))).toEqual([]);
    const label = t.part('lb', 'label');
    expect(label.tagName).toBe('LABEL');
    const input = t.part('email', 'input');
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.labels[0]).toBe(label);
    expect(t.part('lb', 'indicator').hidden).toBe(true);
  });

  it('shows a required marker that is not read', () => {
    const t = mountDoc(`  (lb: label 'Email' (for email) (required true))
  (email: text-field (name email) (required true))`);
    const indicator = t.part('lb', 'indicator');
    expect(indicator.hidden).toBe(false);
    expect(indicator.getAttribute('aria-hidden')).toBe('true');
    expect(t.node('lb').hasAttribute('required')).toBe(true);
    expect(t.part('email', 'input').required).toBe(true);
  });
});
