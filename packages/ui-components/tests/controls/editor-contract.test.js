import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToHTML } from '@link-foundation/ui-dom';
import { CONTROL_KIND_SPECS } from '../../src/controls/index.js';
import { mountDoc, typeInto, press, microtasks } from '../support/controls.js';

test('live numbers preserve drafts across store echoes, inherit and step via buttons', async () => {
  const t = mountDoc(`n: number-field 'Size'
  fallback 5
  min 0
  max 20
  step 0.1`);
  const input = t.part('n', 'input');
  typeInto(input, '1.');
  await microtasks();
  assert.deepEqual(t.prop('n', 'value'), ['1']);
  assert.equal(input.value, '1.');
  typeInto(input, '-');
  assert.equal(input.value, '-');
  assert.deepEqual(t.prop('n', 'value'), ['1']);
  typeInto(input, '');
  await microtasks();
  assert.equal(t.prop('n', 'value'), undefined);
  t.part('n', 'increment').click();
  assert.deepEqual(t.prop('n', 'value'), ['5.1']);
  assert.equal(press(input, 'Home').defaultPrevented, false);
  assert.equal(press(input, 'End').defaultPrevented, false);
  assert.equal(
    press(input, 'PageUp', { shiftKey: true }).defaultPrevented,
    false
  );
  t.mounted.destroy();
});

test('color accepts keyboard RGB and named palette buttons', async () => {
  const t = mountDoc(`c: color-field 'Accent'
  value '#000000'
  palette
    Ocean '#1256ab'
    Sand '#eecbaa'`);
  typeInto(t.part('c', 'input'), 'rgb(18, 86, 171)');
  await microtasks();
  assert.deepEqual(t.prop('c', 'value'), ['#1256ab']);
  const buttons = t.part('c', 'palette').querySelectorAll('button');
  assert.equal(buttons[1].textContent, 'Sand');
  buttons[1].click();
  assert.deepEqual(t.prop('c', 'value'), ['#eecbaa']);
  t.mounted.destroy();
});

test('extended editors and external labels retain server rendering', () => {
  const diagnostics = [];
  const html = renderToHTML(
    `n: number-field Size
  disabled true
c: color-field Accent
  palette
    Ocean '#1256ab'
s: select Pick
  external-label true
  aria-label Palette
  list-label 'Options: Palette'
  a: option Alpha`,
    { kinds: CONTROL_KIND_SPECS, onDiagnostic: (d) => diagnostics.push(d) }
  );
  assert.deepEqual(diagnostics, []);
  assert.match(html, /aria-label="Increase"[^>]*disabled/);
  assert.match(html, />Ocean<\/button>/);
  assert.match(html, /aria-label="Options: Palette"/);
});

test('directional number stepping and translated action names follow store updates', async () => {
  const t = mountDoc(`n: number-field Opacity
  value 0.075
  min 0
  max 1
  step 0.01
  snapping directional
  increment-label 'Увеличить непрозрачность'
  decrement-label 'Уменьшить непрозрачность'`);
  t.part('n', 'increment').click();
  await microtasks();
  assert.deepEqual(t.prop('n', 'value'), ['0.08']);
  assert.equal(
    t.part('n', 'increment').getAttribute('aria-label'),
    'Увеличить непрозрачность'
  );
  press(t.part('n', 'input'), 'ArrowDown');
  assert.deepEqual(t.prop('n', 'value'), ['0.07']);
  t.mounted.destroy();
});

test('grouped RGB sliders and numeric channels synchronize text, palettes and disabled state', async () => {
  const t = mountDoc(`c: color-field Accent
  value '#1256ab'
  rgb true
  rgb-label 'Каналы акцента'
  red-label Красный
  palette
    Sand '#eecbaa'`);
  const red = t.part('c', 'red-range');
  assert.equal(red.value, '18');
  assert.equal(red.getAttribute('aria-label'), 'Красный');
  typeInto(red, '255');
  await microtasks();
  assert.deepEqual(t.prop('c', 'value'), ['#ff56ab']);
  assert.equal(t.part('c', 'red-number').value, '255');
  typeInto(t.part('c', 'green-number'), '0');
  await microtasks();
  assert.equal(t.part('c', 'input').value, '#ff00ab');
  t.part('c', 'palette').querySelector('button').click();
  assert.equal(red.value, '238');
  assert.equal(t.part('c', 'blue-number').value, '170');
  t.mounted.store.setProp('c', 'disabled', ['true']);
  await microtasks();
  assert.equal(red.disabled, true);
  assert.equal(t.part('c', 'green-number').disabled, true);
  t.mounted.destroy();
});
