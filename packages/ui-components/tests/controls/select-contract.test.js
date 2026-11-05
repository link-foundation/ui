import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mountDoc, press, microtasks } from '../support/controls.js';

test('disabled click keeps list open; Tab commits without preventing navigation', async () => {
  const t = mountDoc(`s: select 'Pick'
  value a
  a: option Alpha
  b: option Beta
    disabled true
  c: option Charlie`);
  const input = t.part('s', 'input');
  input.click();
  t.node('b').click();
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  assert.equal(t.document.activeElement, input);
  press(input, 'ArrowDown');
  const event = new t.window.KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(event);
  await microtasks();
  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(t.prop('s', 'value'), ['c']);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  t.mounted.destroy();
});

test('Page keys move ten available options and clamp at the endpoints', () => {
  const options = Array.from(
    { length: 25 },
    (_, i) => `  o${i}: option 'Option ${i}'`
  ).join('\n');
  const t = mountDoc(`s: select 'Pick'\n  value o0\n${options}`);
  const input = t.part('s', 'input');
  input.click();
  press(input, 'PageDown');
  assert.equal(input.getAttribute('aria-activedescendant'), t.node('o10').id);
  press(input, 'PageDown');
  press(input, 'PageUp');
  assert.equal(input.getAttribute('aria-activedescendant'), t.node('o10').id);
  t.mounted.destroy();
});

test('external naming suppresses the generated label and names the list independently', () => {
  const t = mountDoc(`s: select 'Generic'
  external-label true
  aria-label 'My colour'
  list-label 'Options: My colour'
  value a
  a: option Red`);
  assert.equal(t.part('s', 'label').textContent, '');
  assert.equal(t.part('s', 'input').getAttribute('aria-label'), 'My colour');
  assert.equal(t.part('s', 'input').hasAttribute('aria-labelledby'), false);
  assert.equal(
    t.document
      .getElementById(t.part('s', 'input').getAttribute('aria-controls'))
      .getAttribute('aria-label'),
    'Options: My colour'
  );
  assert.equal(
    t.document
      .getElementById(t.part('s', 'input').getAttribute('aria-controls'))
      .hasAttribute('aria-labelledby'),
    false
  );
  t.mounted.destroy();
});
