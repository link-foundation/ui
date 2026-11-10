import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountDoc, typeInto, commit } from '../support/controls.js';
import { renderToHTML } from '@link-foundation/ui-dom';
import { CONTROL_KIND_SPECS } from '../../src/controls/index.js';

test('color palettes render statically without browser-only selector APIs', () => {
  for (const mode of ['inline', 'popover']) {
    const diagnostics = [];
    const html = renderToHTML(
      `color: color-field
  label Accent
  mode ${mode}
  value '#123456'
  palette
    Navy '#123456'
  palettes
    name Ocean
    colors
      (name Blue) (hex '#234567')`,
      {
        kinds: CONTROL_KIND_SPECS,
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      }
    );
    assert.deepEqual(diagnostics, []);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /Navy/);
    assert.match(html, /Ocean/);
  }
});

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
