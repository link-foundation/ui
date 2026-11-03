/**
 * avatar: a picture with the name as `alt`, or the initials as
 * `role=img` named by the name; an unsafe source is never loaded.
 */

import { describe, it, expect } from 'test-anywhere';
import { initialsOf } from '../../src/controls/index.js';
import { attrs, mountDoc } from '../support/controls.js';

describe('avatar', () => {
  it('shows the initials named by the full name', () => {
    const t = mountDoc(`  (ada: avatar 'Ada Lovelace')`);
    expect(t.codes()).toEqual([]);
    expect(attrs(t.part('ada', 'root'), ['role', 'aria-label'])).toEqual({
      role: 'img',
      'aria-label': 'Ada Lovelace',
    });
    const initials = t.part('ada', 'label');
    expect(initials.textContent).toBe('AL');
    expect(initials.getAttribute('aria-hidden')).toBe('true');
    expect(t.part('ada', 'image').hidden).toBe(true);
  });

  it('shows the picture with the name as alt text', () => {
    const t = mountDoc(
      `  (ada: avatar 'Ada Lovelace' (source 'https://example.com/ada.png'))`
    );
    const image = t.part('ada', 'image');
    expect(image.hidden).toBe(false);
    expect(image.getAttribute('src')).toBe('https://example.com/ada.png');
    expect(image.alt).toBe('Ada Lovelace');
    expect(t.part('ada', 'root').hasAttribute('role')).toBe(false);
    expect(t.part('ada', 'label').hidden).toBe(true);
  });

  it('falls back to the initials when the picture fails', () => {
    const t = mountDoc(
      `  (ada: avatar 'Ada Lovelace' (source 'https://example.com/none.png'))`
    );
    const image = t.part('ada', 'image');
    image.dispatchEvent(new t.window.Event('error'));
    expect(image.hidden).toBe(true);
    expect(t.part('ada', 'root').getAttribute('role')).toBe('img');
  });

  it('never loads an unsafe source', () => {
    const t = mountDoc(
      `  (ada: avatar 'Ada Lovelace' (source 'javascript:alert(1)'))`
    );
    expect(t.part('ada', 'image').hasAttribute('src')).toBe(false);
    expect(t.part('ada', 'label').textContent).toBe('AL');
  });

  it('takes the initials of the first and last word', () => {
    expect(initialsOf('Grace Brewster Hopper')).toBe('GH');
    expect(initialsOf('Plato')).toBe('P');
  });
});
