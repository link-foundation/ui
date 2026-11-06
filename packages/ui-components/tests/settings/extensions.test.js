import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { readSchema, toShareHash } from '@link-foundation/ui-settings';
import {
  createSettingsPanel,
  buildPanelModel,
} from '../../src/settings/index.js';

const { schema } = readSchema(`s: schema
  version 1
frame: section
  label Frame
  tabs Basic Advanced
enabled:
  type toggle
  default false
  section frame
size:
  type number
  default 3
  min 0
  max 10
  section frame
  tab Advanced
  level expert
  group Dimensions
  visible-when enabled true
  preview frame
limit:
  type number
  default 10
  section frame
comfort:
  type toggle
  default false
  comfort`);

test('panel model combines conditions, tabs, levels and search with whole-section counts', () => {
  const options = { tabs: { frame: 'Advanced' }, level: 'expert' };
  assert.equal(
    buildPanelModel(
      schema,
      { enabled: false },
      options
    ).sections[0].fields.some((f) => f.key === 'size'),
    false
  );
  assert.equal(
    buildPanelModel(schema, { enabled: true }, options).sections[0].fields.some(
      (f) => f.key === 'size'
    ),
    true
  );
  assert.equal(
    buildPanelModel(
      schema,
      { enabled: true },
      { ...options, level: 'basic' }
    ).sections[0].fields.some((f) => f.key === 'size'),
    false
  );
});

test('panel extensions refresh and destroy; saved/shared looks preserve comfort and before-link state', () => {
  const dom = new JSDOM('<body></body>', { url: 'https://example.test' });
  let updates = 0;
  let destroys = 0;
  let saved;
  const panel = createSettingsPanel(schema, {
    document: dom.window.document,
    values: { comfort: true },
    columns: 2,
    level: 'expert',
    mountPreview: ({ container }) => {
      container.textContent = 'Transparent frame';
      return { update: () => updates++, destroy: () => destroys++ };
    },
    formatCount: (model) => `${model.changedCount} custom`,
    onLooksChange: (looks) => {
      saved = looks;
    },
    normalizeChanges: (next) => ({
      ...next,
      size: Math.min(next.size, next.limit),
    }),
    randomLocked: ['limit'],
  });
  dom.window.document.body.append(panel.element);
  panel.update({ enabled: true, size: 8 });
  panel.setTab('frame', 'Advanced');
  assert.equal(panel.element.querySelector('[data-key="size"]').hidden, false);
  assert.equal(
    panel.element.querySelector('fieldset legend').textContent,
    'Dimensions'
  );
  panel.saveLook('Wide');
  assert.equal(saved.Wide.size, 8);
  panel.update({ size: 2 });
  panel.applyLook('Wide');
  assert.equal(panel.values().size, 8);
  panel.applyShared(toShareHash(schema, { size: 5, comfort: false }));
  assert.equal(panel.values().comfort, true);
  panel.restoreBeforeLink();
  assert.equal(panel.values().size, 8);
  panel.update({ limit: 4 });
  assert.equal(panel.values().size, 4);
  assert.ok(updates > 1);
  panel.destroy();
  assert.equal(destroys, 1);
  dom.window.close();
});

test('imports are atomic, exports round-trip, locked random fields and control cleanup', () => {
  const dom = new JSDOM('<body></body>');
  let destroyed = 0;
  const panel = createSettingsPanel(schema, {
    document: dom.window.document,
    values: { limit: 7 },
    random: () => 0.75,
    randomLocked: ['limit'],
    mountControl: (container, field, value, onChange) => {
      const input = dom.window.document.createElement('input');
      input.setAttribute('aria-label', field.label ?? field.key);
      input.addEventListener('change', () => onChange(input.value));
      container.append(input);
      return {
        update: (next) => {
          input.value = String(next);
        },
        destroy: () => {
          destroyed++;
        },
      };
    },
  });
  assert.equal(panel.importText('{"size":6}'), true);
  assert.equal(panel.values().size, 6);
  const before = panel.values();
  assert.equal(panel.importText('{"size":2,"enabled":"invalid"}'), false);
  assert.deepEqual(panel.values(), before);
  assert.equal(panel.importText(panel.exportText()), true);
  panel.update({ limit: 7 });
  const random = [...panel.element.querySelectorAll('button')].find(
    (b) => b.textContent === 'Randomize'
  );
  random.click();
  assert.equal(panel.values().limit, 7);
  panel.destroy();
  assert.equal(destroyed, schema.fields.size);
  dom.window.close();
});
