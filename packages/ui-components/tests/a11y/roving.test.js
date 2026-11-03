/**
 * Roving tabindex: one item of a group is tabbable, arrow keys move.
 */

import { describe, it, expect } from 'test-anywhere';
import { createRovingTabindex } from '@link-foundation/ui-components/a11y';
import { createDom, press } from '../support/dom.js';

function toolbar(extra = '') {
  const { document } = createDom(`<div id="bar">
  <button id="a">A</button><button id="b" ${extra}>B</button><button id="c">C</button>
</div>`);
  const bar = document.getElementById('bar');
  return { document, bar, items: [...bar.querySelectorAll('button')] };
}

const tabindexes = (items) => items.map((i) => i.getAttribute('tabindex'));

describe('createRovingTabindex', () => {
  it('makes only the current item tabbable', () => {
    const { items } = toolbar();
    createRovingTabindex(items);
    expect(tabindexes(items)).toEqual(['0', '-1', '-1']);
  });

  it('moves with arrow keys, Home and End, and wraps by default', () => {
    const { document, bar, items } = toolbar();
    const changes = [];
    const roving = createRovingTabindex(items, {
      onChange: (index) => changes.push(index),
    });
    const detach = roving.attach(bar);
    items[0].focus();
    const right = press(items[0], 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('b');
    expect(tabindexes(items)).toEqual(['-1', '0', '-1']);
    press(document.activeElement, 'End');
    expect(document.activeElement.id).toBe('c');
    press(document.activeElement, 'ArrowRight');
    expect(document.activeElement.id).toBe('a');
    press(document.activeElement, 'ArrowLeft');
    expect(document.activeElement.id).toBe('c');
    press(document.activeElement, 'Home');
    expect(document.activeElement.id).toBe('a');
    expect(changes).toEqual([1, 2, 0, 2, 0]);
    detach();
  });

  it('skips disabled items and stops at the ends without loop', () => {
    const { document, bar, items } = toolbar('disabled');
    const roving = createRovingTabindex(items, { loop: false });
    roving.attach(bar);
    items[0].focus();
    press(items[0], 'ArrowRight');
    expect(document.activeElement.id).toBe('c');
    press(document.activeElement, 'ArrowRight');
    expect(document.activeElement.id).toBe('c');
    expect(roving.index).toBe(2);
  });

  it('uses the arrow keys of its orientation, mirrored in rtl', () => {
    const { items } = toolbar();
    const vertical = createRovingTabindex(items, { orientation: 'vertical' });
    expect(vertical.handleKeyDown({ key: 'ArrowRight' })).toBe(false);
    expect(vertical.handleKeyDown({ key: 'ArrowDown' })).toBe(true);
    expect(vertical.index).toBe(1);
    const rtl = createRovingTabindex(items, { rtl: true });
    expect(rtl.handleKeyDown({ key: 'ArrowLeft' })).toBe(true);
    expect(rtl.index).toBe(1);
    expect(() =>
      createRovingTabindex(items, { orientation: 'diagonal' })
    ).toThrow();
  });

  it('follows focus that arrives another way', () => {
    const { bar, items } = toolbar();
    const roving = createRovingTabindex(items);
    roving.attach(bar);
    items[2].focus();
    expect(roving.index).toBe(2);
    expect(tabindexes(items)).toEqual(['-1', '-1', '0']);
  });
});
