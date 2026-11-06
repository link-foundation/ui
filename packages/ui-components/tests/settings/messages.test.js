import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { readSchema } from '@link-foundation/ui-settings';
import { createSettingsPanel } from '../../src/settings/index.js';
import { PANEL_MESSAGES } from '../../src/settings/messages.js';

const { schema } = readSchema(`s: schema
  version 1
frame: section
  label Frame
  tabs Basic Advanced
opacity:
  type number
  label Opacity
  default 0.075
  min 0
  max 1
  step 0.01
  snapping directional
  section frame
accent:
  type color
  label Accent
  default '#1256ab'
  section frame`);

test('catalog localizes chrome, statuses and field-specific editor names without losing state', async () => {
  const dom = new JSDOM('<body></body>', { url: 'https://example.test' });
  const messages = Object.fromEntries(
    Object.keys(PANEL_MESSAGES).map((key) => [
      key,
      ({ label = '', count = '' }) => `RU:${key}:${label}${count}`,
    ])
  );
  const panel = createSettingsPanel(schema, {
    document: dom.window.document,
    messages,
    mode: 'drawer',
  });
  dom.window.document.body.append(panel.element);
  panel.open();
  assert.equal(panel.element.getAttribute('aria-label'), 'RU:settings:');
  assert.equal(
    panel.element.querySelector('input[type=search]').placeholder,
    'RU:search:'
  );
  for (const button of panel.element.querySelectorAll('button')) {
    if (!button.dataset.tab) {
      assert.match(
        button.getAttribute('aria-label') ?? button.textContent,
        /^RU:/
      );
    }
  }
  assert.equal(
    panel.element
      .querySelector('[data-part=increment]')
      .getAttribute('aria-label'),
    'RU:increment:Opacity'
  );
  assert.equal(
    panel.element
      .querySelector('[data-part=red-range]')
      .getAttribute('aria-label'),
    'RU:red:Accent'
  );
  panel.update({ opacity: 0.4 });
  assert.equal(panel.importText('{"opacity":"wrong"}'), false);
  assert.equal(panel.importText('{broken'), false);
  assert.equal(
    panel.element.querySelector('[role=status]').textContent,
    'RU:invalid:'
  );
  panel.setMessages({
    increment: ({ label }) => `Увеличить ${label}`,
    decrement: ({ label }) => `Уменьшить ${label}`,
    invalid: 'Ошибка настроек',
  });
  await Promise.resolve();
  assert.equal(
    panel.element
      .querySelector('[data-part=increment]')
      .getAttribute('aria-label'),
    'Увеличить Opacity'
  );
  assert.equal(
    panel.element.querySelector('[role=status]').textContent,
    'Ошибка настроек'
  );
  assert.equal(panel.values().opacity, 0.4);
  assert.equal(
    panel.element.querySelector('input[type=search]').placeholder,
    'Search settings'
  );
  panel.destroy();
  dom.window.close();
});
