/**
 * progress: a progressbar; indeterminate (no value) leaves out
 * `aria-valuenow`.
 */

import { describe, it, expect } from 'test-anywhere';
import { attrs, microtasks, mountDoc } from '../support/controls.js';

const ARIA = ['role', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax'];

describe('progress', () => {
  it('announces a determinate value', () => {
    const t = mountDoc(`  (up: progress (label 'Upload') (value 60))`);
    expect(t.codes()).toEqual([]);
    const track = t.part('up', 'track');
    expect(attrs(track, ARIA)).toEqual({
      role: 'progressbar',
      'aria-valuenow': '60',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    });
    expect(
      t.document.getElementById(track.getAttribute('aria-labelledby'))
        .textContent
    ).toBe('Upload');
    expect(t.node('up').hasAttribute('data-indeterminate')).toBe(false);
    expect(t.node('up').style.getPropertyValue('--ui-progress-value')).toBe(
      '0.6'
    );
  });

  it('leaves out aria-valuenow when indeterminate', () => {
    const t = mountDoc(`  (busy: progress (label 'Loading'))`);
    const track = t.part('busy', 'track');
    expect(track.getAttribute('role')).toBe('progressbar');
    expect(track.hasAttribute('aria-valuenow')).toBe(false);
    expect(t.node('busy').hasAttribute('data-indeterminate')).toBe(true);
  });

  it('follows a store change of the value', async () => {
    const t = mountDoc(`  (up: progress (label 'Upload') (value 10) (max 50))`);
    t.mounted.store.setProp('up', 'value', ['25']);
    await microtasks();
    const track = t.part('up', 'track');
    expect(attrs(track, ['aria-valuenow', 'aria-valuemax'])).toEqual({
      'aria-valuenow': '25',
      'aria-valuemax': '50',
    });
  });
});

describe('progress shape', () => {
  it('is linear unless asked for a ring', () => {
    const t = mountDoc(`  (a: progress 'A' (value 1))
  (b: progress 'B' (shape square) (value 1))`);
    expect(t.node('a').getAttribute('shape')).toBe('linear');
    expect(t.node('b').getAttribute('shape')).toBe('linear');
  });

  it('keeps the determinate ARIA in a ring', () => {
    const t = mountDoc(`  (up: progress 'Upload' (shape circular) (value 60))`);
    expect(t.codes()).toEqual([]);
    expect(t.node('up').getAttribute('shape')).toBe('circular');
    expect(attrs(t.part('up', 'track'), ARIA)).toEqual({
      role: 'progressbar',
      'aria-valuenow': '60',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
    });
  });

  it('leaves the value out of an indeterminate ring', () => {
    const t = mountDoc(`  (busy: progress 'Busy' (shape circular))`);
    expect(t.node('busy').hasAttribute('data-indeterminate')).toBe(true);
    expect(t.part('busy', 'track').hasAttribute('aria-valuenow')).toBe(false);
    expect(t.part('busy', 'track').getAttribute('role')).toBe('progressbar');
  });
});
