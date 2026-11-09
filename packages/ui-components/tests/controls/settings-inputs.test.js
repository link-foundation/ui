import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountDoc, typeInto, commit } from '../support/controls.js';

test('steppers reflect bounds, preserve pointer focus and multiply Shift clicks', () => {
  const t = mountDoc(
    'qty: number-field\n  label Quantity\n  min 0\n  max 20\n  value 20'
  );
  const up = t.part('qty', 'increment');
  const down = t.part('qty', 'decrement');
  assert.equal(up.disabled, true);
  assert.equal(up.tabIndex, -1);
  assert.equal(down.tabIndex, -1);
  const event = new t.window.MouseEvent('pointerdown', { cancelable: true });
  down.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  down.dispatchEvent(
    new t.window.MouseEvent('click', { bubbles: true, shiftKey: true })
  );
  assert.deepEqual(t.prop('qty', 'value'), ['10']);
  t.mounted.destroy();
  t.window.close();
});

test('inheritable number resets explicitly; a blank draft preserves its value', () => {
  const t = mountDoc(
    'qty: number-field\n  label Quantity\n  value 4\n  fallback 3\n  inherit true'
  );
  const input = t.part('qty', 'input');
  typeInto(input, '');
  commit(input);
  assert.deepEqual(t.prop('qty', 'value'), ['4']);
  t.part('qty', 'reset').click();
  assert.equal(input.getAttribute('aria-valuetext'), 'inherited');
  assert.equal(t.changes.at(-1).value, null);
  t.mounted.destroy();
  t.window.close();
});
