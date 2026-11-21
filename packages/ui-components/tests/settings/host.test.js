import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { readSchema } from '@link-foundation/ui-settings';
import * as settings from '../../src/settings/index.js';

const { schema } = readSchema(`left: section
  tabs Basic Advanced
  levels page panel
right: section
  extra-height 500
reveal: section
  visible-when enabled true
enabled:
  type toggle
  default false
  tab Basic
  section left
page:
  type number
  default null
  nullable true
  tab Advanced
  level page
  section left
panel:
  type number
  default null
  nullable true
  tab Advanced
  level panel
  section left
content:
  type text
  default long
  section right
more:
  type text
  default revealed
  section reveal`);

test('host estimates initial tabs and levels and the panel keeps reveal next to its control', () => {
  const dom = new JSDOM('<body></body>', { url: 'https://example.test' });
  const { document } = dom.window;
  const values = { panel: 4 };
  const columns = { count: 2, balance: 'estimate' };
  const model = settings.buildPanelModel(schema, values, { includeAll: true });
  const scope = { tabs: { left: 'Advanced' }, level: 'panel' };
  assert.ok(
    settings.estimateSection(model.sections[0], schema, values, scope) > 0
  );
  assert.deepEqual(
    settings
      .planSectionColumns(schema, values, { ...scope, columns })
      .map((column) => column.map((section) => section.id)),
    [['left', 'reveal'], ['right']]
  );
  const panel = settings.createSettingsPanel(schema, {
    document,
    values,
    columns,
    ...scope,
    renderTab: ({ value, owned }) => (owned ? `Own ${value}` : value),
  });
  document.body.append(panel.element);
  const [left, right] = panel.element.querySelectorAll('.settings-column');
  const dependent = left.querySelector('[data-key=more]').closest('details');
  const field = left.querySelector('[data-key=panel]');
  assert.equal(field.hidden, false);
  const levels = [
    ...left.querySelectorAll('[role=tablist]'),
  ][0].querySelectorAll('button');
  assert.deepEqual(
    [...levels].map((tab) => tab.textContent),
    ['page', 'Own panel']
  );
  panel.setTab('left', 'Basic');
  assert.equal(dependent.hidden, true);
  left.querySelector('[role=switch]').click();
  assert.equal(dependent.hidden, false);
  assert.equal(dependent.parentElement, left);
  assert.ok(right.querySelector('[data-key=content]'));
  panel.destroy();
  dom.window.close();
});

test('a section follows the control that first reveals it across columns', () => {
  const { schema } = readSchema(`a: section
b: section
reveal: section
  visible-when
    any
      left true
      right true
left:
  type toggle
  default false
  section a
right:
  type toggle
  default false
  section b
detail:
  type text
  default Details
  section reveal`);
  const dom = new JSDOM('<body></body>');
  const panel = settings.createSettingsPanel(schema, {
    document: dom.window.document,
    columns: { count: 2, balance: 'estimate' },
  });
  const [left, right] = panel.element.querySelectorAll('.settings-column');
  const group = left.querySelector('[data-key=detail]').closest('details');
  assert.equal(group.hidden, true);
  right.querySelector('[role=switch]').click();
  assert.equal(group.hidden, false);
  assert.equal(group.parentElement, right);
  panel.update({ right: false });
  left.querySelector('[role=switch]').click();
  assert.equal(group.hidden, false);
  assert.equal(group.parentElement, right);
  panel.destroy();
  dom.window.close();
});

test('a host row keeps its label, control and validation while rendering rich slots', () => {
  const dom = new JSDOM('<main></main>');
  const { document } = dom.window;
  const changes = [];
  const main = document.querySelector('main');
  const field = schema.fields.get('panel');
  const row = settings.mountSettingsRow(main, schema, field, {
    values: { panel: 4 },
    onChange: (patch) => changes.push(patch),
    slots: {
      label: () => 'Panel corner',
      value: ({ value }) => `${value} px`,
      hint: () => 'Preview hint',
    },
    layout: ({ row, label, control, value, reset, hint }) => {
      const frame = document.createElement('article');
      frame.append(label, hint, control, value, reset);
      row.append(frame);
    },
  });
  const input = main.querySelector('input');
  const label = main.querySelector(`label[for="${input.id}"]`);
  assert.equal(label.textContent, 'Panel corner');
  assert.match(main.textContent, /Preview hint.*4 px/);
  input.value = 'invalid';
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.deepEqual(changes, []);
  row.update({ panel: 7 });
  assert.equal(main.querySelector('input').id, input.id);
  assert.equal(main.querySelector('output').textContent, '7 px');
  main.querySelector('output + button').click();
  assert.deepEqual(changes, [{ panel: null }]);
  row.destroy();
  assert.equal(main.childElementCount, 0);
  dom.window.close();
});

test('saved and shared looks project legacy JSON and nested Links Notation with viewer comfort preserved', () => {
  const { schema } = readSchema(`skin:
  type choice
  options green blue
  default green
corner:
  type number
  nullable true
  default 8
motion:
  type choice
  options auto on off
  default auto
  comfort`);
  const dom = new JSDOM('<body></body>', { url: 'https://example.test' });
  const { document, localStorage } = dom.window;
  localStorage.setItem(
    'old-looks',
    JSON.stringify([
      { name: 'Old JSON', look: { skin: 'blue', corner: null, motion: 'on' } },
    ])
  );
  const panel = settings.createSettingsPanel(schema, {
    document,
    values: { motion: 'off' },
    looksStorageKey: 'old-looks',
    previewRoot: document.documentElement,
    project: ({ skin, corner, motion }) => ({
      css: {
        '--palette': skin === 'blue' ? '#0066ff' : '#00ff66',
        '--material': skin === 'blue' ? '0.4' : '0.7',
        '--corner': corner === null ? null : `${corner}px`,
      },
      attributes: { 'data-motion': motion },
    }),
  });
  assert.equal(panel.applyLook('Old JSON'), true);
  assert.equal(
    document.documentElement.style.getPropertyValue('--palette'),
    '#0066ff'
  );
  assert.equal(document.documentElement.style.getPropertyValue('--corner'), '');
  assert.equal(
    panel.importText(`(
  presets (
    (
      name "Nested look"
      look (
        skin green
        corner 12
        motion on
      )
    )
  )
)`),
    true
  );
  assert.equal(panel.applyLook('Nested look'), true);
  assert.equal(
    document.documentElement.style.getPropertyValue('--material'),
    '0.7'
  );
  assert.equal(
    document.documentElement.style.getPropertyValue('--corner'),
    '12px'
  );
  for (const text of [
    '{"skin":"blue","corner":null,"motion":"on"}',
    'settings:\n  skin blue\n  corner null\n  motion on',
  ]) {
    assert.equal(
      panel.applyShared(`#settings=${encodeURIComponent(text)}`).ok,
      true
    );
    assert.equal(document.documentElement.getAttribute('data-motion'), 'off');
    assert.equal(
      document.documentElement.style.getPropertyValue('--palette'),
      '#0066ff'
    );
    assert.equal(
      document.documentElement.style.getPropertyValue('--corner'),
      ''
    );
  }
  panel.destroy();
  dom.window.close();
});
