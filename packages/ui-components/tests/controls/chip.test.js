/**
 * chip: a label with an optional remove button. Removal works from the
 * keyboard, commits one `removed` change, and never loses focus.
 */

import { describe, it, expect } from 'test-anywhere';
import { press } from '../support/dom.js';
import { attrs, microtasks, mountDoc } from '../support/controls.js';

const ROW = `  (row: stack
    (a: chip Ada (value ada) (removable true))
    (b: chip Bob (removable true))
    (c: chip Cleo (removable true)))`;

describe('chip', () => {
  it('shows a label, with no remove button unless it is removable', () => {
    const t = mountDoc(`  (a: chip Design)`);
    expect(t.codes()).toEqual([]);
    expect(t.part('a', 'label').textContent).toBe('Design');
    expect(t.part('a', 'remove').hidden).toBe(true);
    expect(attrs(t.node('a'), ['variant', 'tone'])).toEqual({
      variant: 'filled',
      tone: 'neutral',
    });
  });

  it('names the remove button after the label or by remove-label', () => {
    const t = mountDoc(`  (a: chip Ada (removable true))
  (b: chip Bob (removable true) (remove-label 'Убрать Боба'))`);
    const name = (id) => t.part(id, 'remove').getAttribute('aria-label');
    expect(name('a')).toBe('Remove Ada');
    expect(name('b')).toBe('Убрать Боба');
    expect(t.part('a', 'remove').getAttribute('type')).toBe('button');
    expect(t.part('a', 'icon').getAttribute('aria-hidden')).toBe('true');
  });

  it('warns about a missing label', () => {
    const t = mountDoc(`  (a: chip (removable true))`);
    expect(t.codes()).toEqual(['missing-label@a:label']);
  });

  it('removes on a click, writes the store and commits once', () => {
    const t = mountDoc(ROW);
    t.part('b', 'remove').click();
    expect(t.node('b').hidden).toBe(true);
    expect(t.prop('b', 'removed')).toEqual(['true']);
    expect(t.changes).toEqual([
      { source: 'b', property: 'removed', value: true },
    ]);
  });

  for (const key of ['Enter', ' ', 'Delete', 'Backspace']) {
    it(`removes on the key "${key}"`, () => {
      const t = mountDoc(ROW);
      press(t.part('a', 'remove'), key);
      expect(t.node('a').hidden).toBe(true);
    });
  }

  it('passes focus to the next chip, the previous, then the row', () => {
    const t = mountDoc(ROW);
    const row = t.node('row');
    t.part('b', 'remove').focus();
    press(t.part('b', 'remove'), 'Delete');
    expect(t.document.activeElement).toBe(t.part('c', 'remove'));
    press(t.part('c', 'remove'), 'Delete');
    expect(t.document.activeElement).toBe(t.part('a', 'remove'));
    press(t.part('a', 'remove'), 'Delete');
    expect(t.document.activeElement).toBe(row);
    expect(row.getAttribute('tabindex')).toBe('-1');
  });

  it('does not move focus when a chip is removed from elsewhere', () => {
    const t = mountDoc(ROW);
    t.part('c', 'remove').focus();
    t.part('a', 'remove').click();
    expect(t.document.activeElement).toBe(t.part('c', 'remove'));
  });

  it('cannot be removed by the user while disabled', () => {
    const t = mountDoc(`  (a: chip Ada (removable true) (disabled true))`);
    const remove = t.part('a', 'remove');
    expect(remove.disabled).toBe(true);
    press(remove, 'Delete');
    remove.click();
    expect(t.node('a').hidden).toBe(false);
    expect(t.changes).toEqual([]);
  });

  it('follows the removed property without committing it back', async () => {
    const t = mountDoc(`  (a: chip Ada (removable true) (removed true))`);
    expect(t.node('a').hidden).toBe(true);
    t.mounted.store.setProp('a', 'removed', ['false']);
    await microtasks();
    expect(t.node('a').hidden).toBe(false);
    t.mounted.store.setProp('a', 'removed', ['true']);
    await microtasks();
    expect(t.node('a').hidden).toBe(true);
    expect(t.changes).toEqual([]);
  });

  it('can be removed again after being restored', async () => {
    const t = mountDoc(`  (a: chip Ada (removable true))`);
    t.part('a', 'remove').click();
    t.mounted.store.setProp('a', 'removed', ['false']);
    await microtasks();
    t.part('a', 'remove').click();
    expect(t.node('a').hidden).toBe(true);
    expect(t.changes.map((change) => change.value)).toEqual([true, true]);
  });
});
