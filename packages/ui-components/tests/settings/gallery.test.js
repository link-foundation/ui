import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readSchema, toShareHash } from '@link-foundation/ui-settings';
import { createSettingsPanel } from '../../src/settings/index.js';

const { schema } = readSchema(`s: schema
  version 1
main: section
  label Main
  tabs Basic Advanced Empty
  levels base expert
  preview true
child: section
  label Child
  visible-when enabled
size:
  type number
  default 3
  section main
  tab Basic
  level base
enabled:
  type toggle
  default false
  section main
  tab Basic
weight:
  type number
  default null
  inherit true
  fallback 3
  section main
  tab Advanced
  level expert
child-size:
  type number
  default 3
  section child
preset light
  label Light
  description 'Light material'
  partial
  set size 2
preset enabled
  partial
  set enabled true`);
function setup(options = {}, definition = schema) {
  const dom = new JSDOM('<body></body>', { url: 'https://example.test/#old' });
  const panel = createSettingsPanel(definition, {
    document: dom.window.document,
    ...options,
  });
  dom.window.document.body.append(panel.element);
  return {
    dom,
    panel,
    close() {
      panel.destroy();
      dom.window.close();
    },
  };
}

test('tabs hide empty entries, navigate and pass per-section levels to sticky previews', () => {
  const levels = [];
  const v = setup({
    mountPreview: () => ({
      update: (values, section, level) => levels.push(level),
    }),
  });
  const tabs = v.panel.element.querySelector('[aria-label="Main tabs"]');
  assert.equal(tabs.querySelector('[data-tab=Empty]').hidden, true);
  assert.equal(tabs.querySelector('[data-tab=Advanced]').hidden, true);
  v.panel.setSectionLevel('main', 'expert');
  assert.equal(levels.at(-1), 'expert');
  assert.equal(tabs.querySelector('[data-tab=Advanced]').hidden, false);
  tabs
    .querySelector('[data-tab=Basic]')
    .dispatchEvent(
      new v.dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true })
    );
  assert.equal(
    tabs.querySelector('[data-tab=Advanced]').getAttribute('aria-selected'),
    'true'
  );
  const level = v.panel.element.querySelector(
    '[aria-label="Main levels"] [data-tab=expert]'
  );
  assert.equal(level.hasAttribute('data-owned'), false);
  v.panel.update({ weight: 5 });
  assert.equal(level.hasAttribute('data-owned'), true);
  v.close();
});

test('balanced columns are stable through edits, conditions, tabs and search; dependent sections follow their controller', () => {
  const v = setup({ columns: { count: 2, balance: 'estimate' } });
  const groups = [...v.panel.element.querySelectorAll('details')];
  const parents = groups.map((g) => g.parentElement);
  assert.equal(groups[0].nextElementSibling, groups[1]);
  assert.equal(groups[1].hidden, true);
  v.panel.update({ enabled: true });
  assert.equal(groups[1].hidden, false);
  v.panel.setTab('main', 'Advanced');
  v.panel.setSectionLevel('main', 'expert');
  assert.deepEqual(
    groups.map((g) => g.parentElement),
    parents
  );
  v.close();
});

test('preset cards use current values for every live miniature; peek toggle and public count preserve writes', () => {
  const seen = [];
  const counts = [];
  const v = setup({
    presets: { display: 'cards' },
    peek: 'toggle',
    onChangedCount: (n) => counts.push(n),
    mountMiniature: () => ({ update: (values) => seen.push(values) }),
  });
  v.panel.update({ 'child-size': 8 });
  assert.equal(seen.at(-1)['child-size'], 8);
  const card = v.panel.element.querySelector('[data-preset=light]');
  card.click();
  assert.equal(card.getAttribute('aria-pressed'), 'true');
  assert.equal(v.panel.values()['child-size'], 8);
  assert.equal(v.panel.changedCount(), 2);
  assert.equal(counts.at(-1), 2);
  v.panel.update({ enabled: true });
  assert.equal(card.getAttribute('aria-pressed'), 'true');
  assert.equal(
    v.panel.element
      .querySelector('[data-preset=enabled]')
      .getAttribute('aria-pressed'),
    'true'
  );
  const peek = [...v.panel.element.querySelectorAll('button')].find(
    (b) => b.textContent === 'Peek defaults'
  );
  peek.click();
  assert.equal(peek.getAttribute('aria-pressed'), 'true');
  assert.equal(
    v.panel.element.querySelector('.settings-peek-back').hidden,
    false
  );
  assert.equal(v.panel.update({ size: 9 }), false);
  v.panel.element.querySelector('.settings-peek-back').click();
  assert.equal(peek.getAttribute('aria-pressed'), 'false');
  v.close();
});

test('saved looks rename/collide, update, delete and collection import round-trip atomically', () => {
  const v = setup();
  v.panel.saveLook();
  v.panel.update({ size: 8 });
  v.panel.saveLook('Second');
  assert.equal(v.panel.renameLook('Second', 'Look 1'), true);
  assert.equal(
    v.panel.element.querySelectorAll('.settings-looks > div').length,
    1
  );
  v.panel.update({ size: 7 });
  v.panel.saveLook('Look 1');
  const text = v.panel.exportLooks();
  v.panel.deleteLook('Look 1');
  assert.equal(v.panel.importText(text), true);
  v.panel.update({ size: 1 });
  v.panel.applyLook('Look 1');
  assert.equal(v.panel.values().size, 7);
  assert.equal(
    v.panel.importText('looks\n  look\n    name Invalid\n    document "bad"'),
    false
  );
  v.close();
});

test('share safety persists the previous look and clears history only after success; quota errors are visible', () => {
  const v = setup();
  v.panel.update({ size: 9 });
  assert.equal(v.panel.applyShared(toShareHash(schema, { size: 6 })).ok, true);
  assert.equal(v.dom.window.location.hash, '');
  assert.match(
    v.dom.window.localStorage.getItem('link-ui.settings.looks.v1'),
    /Before the link/
  );
  v.panel.restoreBeforeLink();
  assert.equal(v.panel.values().size, 9);
  v.close();
  const failing = setup({
    looksStorage: {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    },
  });
  assert.equal(
    failing.panel.applyShared(toShareHash(schema, { size: 6 })).ok,
    false
  );
  assert.equal(failing.dom.window.location.hash, '#old');
  assert.equal(failing.panel.values().size, 3);
  assert.match(
    failing.panel.element.querySelector('[role=status]').textContent,
    /storage/
  );
  failing.close();
});

test('saved look names and empty state are localized and names round-trip at the length limit', () => {
  const v = setup({
    messages: {
      defaultLook: ({ count }) => `Style ${count}`,
      emptyLooks: 'Nothing saved',
    },
  });
  assert.match(v.panel.element.textContent, /Nothing saved/);
  v.panel.saveLook();
  assert.equal(
    v.panel.element.querySelector('.settings-looks strong').textContent,
    'Style 1'
  );
  v.panel.setMessages({
    defaultLook: ({ count }) => `${'Long'.repeat(20)} ${count}`,
  });
  v.panel.saveLook();
  v.panel.saveLook();
  const names = [
    ...v.panel.element.querySelectorAll('.settings-looks strong'),
  ].map((n) => n.textContent);
  assert.equal(new Set(names).size, 3);
  assert.ok(names.every((name) => name.length <= 60));
  const longName = 'L'.repeat(80);
  v.panel.renameLook('Style 1', longName);
  assert.equal(
    v.panel.element.querySelector('.settings-looks strong').textContent.length,
    60
  );
  v.panel.saveLook('__proto__');
  const text = v.panel.exportLooks();
  assert.equal(v.panel.importText(text), true);
  v.close();
});

test('a dependent section declared first still follows its later controller', () => {
  const v = setup(
    { columns: { count: 2, balance: 'estimate' } },
    { ...schema, sections: [...schema.sections].reverse() }
  );
  const groups = [
    ...v.panel.element.querySelectorAll('.settings-column details'),
  ];
  assert.equal(groups[0].querySelector('summary').textContent, 'Main');
  assert.equal(groups[1].querySelector('summary').textContent, 'Child');
  assert.equal(groups[0].nextElementSibling, groups[1]);
  v.panel.update({ enabled: true });
  assert.equal(groups[1].hidden, false);
  v.close();
});

test('a conditional section follows a controller in the implicit General section', () => {
  const definition = readSchema(`s: schema
  version 1
child: section
  label Child
  visible-when enabled
enabled:
  type toggle
  default false
child-size:
  type number
  default 3
  section child`).schema;
  const v = setup({ columns: { count: 2, balance: 'estimate' } }, definition);
  const groups = [
    ...v.panel.element.querySelectorAll('.settings-column details'),
  ];
  const child = groups.find(
    (group) => group.querySelector('summary').textContent === 'Child'
  );
  const general = groups.find((group) => group !== child);
  assert.equal(general.nextElementSibling, child);
  v.panel.update({ enabled: true });
  assert.equal(child.hidden, false);
  v.close();
});
