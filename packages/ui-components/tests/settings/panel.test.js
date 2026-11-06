import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { toLino, defaults } from '@link-foundation/ui-settings';
import { schema, diagnostics } from '../../examples/settings-schema.js';
import { createSettingsPanel } from '../../src/settings/index.js';

function setup(options = {}) {
  const dom = new JSDOM(
    '<!doctype html><body><button id="opener">Open</button><div id="preview"></div></body>',
    { url: 'http://localhost/' }
  );
  const doc = dom.window.document;
  const panel = createSettingsPanel(schema, {
    document: doc,
    previewRoot: doc.querySelector('#preview'),
    ...options,
  });
  doc.body.append(panel.element);
  return {
    dom,
    doc,
    panel,
    close() {
      panel.destroy();
      dom.window.close();
    },
  };
}
const click = (view, text) =>
  [...view.panel.element.querySelectorAll('button')]
    .find((b) => b.textContent === text)
    .click();

test('panel grouping keeps vector and chip editor fieldsets visible', () => {
  const view = setup();
  try {
    for (const key of ['offset', 'tags']) {
      const fieldset = view.panel.element.querySelector(
        `[data-key="${key}"] fieldset`
      );
      assert.ok(fieldset);
      assert.equal(fieldset.hidden, false);
      view.panel.update({ title: 'Refresh all rows' });
      assert.equal(fieldset.hidden, false);
    }
  } finally {
    view.close();
  }
});

test('panel validates paste atomically and restores a diff in a fresh panel', () => {
  const a = setup();
  const b = setup();
  try {
    assert.deepEqual(diagnostics, []);
    a.panel.update({ 'liquid.blur': 24, 'theme.mode': 'dark' });
    const changes = a.panel.element.querySelector('textarea').value;
    assert.equal(changes, toLino(schema, a.panel.values()));
    b.panel.element.querySelector('textarea').value = changes;
    click(b, 'Paste changes');
    assert.deepEqual(b.panel.values(), a.panel.values());
    b.panel.element.querySelector('textarea').value =
      'settings\n  title valid\n  motion.reduce invalid';
    click(b, 'Paste changes');
    assert.deepEqual(b.panel.values(), a.panel.values());
    assert.match(
      b.panel.element.querySelector('[role=status]').textContent,
      /Invalid/
    );
    assert.equal(b.panel.element.querySelectorAll('[data-changed]').length, 2);
    click(b, 'Reset Blur');
    assert.equal(b.panel.values()['liquid.blur'], 18);
  } finally {
    a.close();
    b.close();
  }
});

test('target receives validated writes, external changes synchronize, destroy unsubscribes', () => {
  let values = defaults(schema);
  let listener;
  let unsubscribed = false;
  const writes = [];
  const target = {
    values: () => values,
    update(next) {
      values = next;
      writes.push(next);
      listener?.(values);
    },
    subscribe(fn) {
      listener = fn;
      return () => {
        unsubscribed = true;
      };
    },
  };
  const v = setup({ target });
  try {
    v.panel.update({ 'liquid.blur': 26 });
    assert.equal(writes.length, 1);
    assert.equal(writes[0]['liquid.blur'], 26);
    v.panel.update({ 'motion.reduce': 'invalid' });
    assert.equal(writes.length, 1);
    listener({ ...values, title: 'External' });
    assert.equal(v.panel.values().title, 'External');
    assert.equal(v.doc.querySelector('#preview').dataset.title, 'External');
  } finally {
    v.close();
  }
  assert.ok(unsubscribed);
});

test('resets, search and keyboard peek never write temporary defaults', () => {
  let writes = 0;
  const v = setup({ confirmReset: () => false, onChange: () => writes++ });
  try {
    v.panel.update({
      'liquid.blur': 24,
      'theme.mode': 'dark',
      title: 'Changed',
    });
    const peek = [...v.panel.element.querySelectorAll('button')].find(
      (b) => b.textContent === 'Peek defaults'
    );
    peek.dispatchEvent(
      new v.dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true })
    );
    assert.equal(
      v.doc.querySelector('#preview').style.getPropertyValue('--liquid-blur'),
      '18px'
    );
    assert.equal(writes, 1);
    assert.equal(v.panel.values()['liquid.blur'], 24);
    peek.dispatchEvent(
      new v.dom.window.KeyboardEvent('keyup', { key: ' ', bubbles: true })
    );
    assert.equal(
      v.doc.querySelector('#preview').style.getPropertyValue('--liquid-blur'),
      '24px'
    );
    const search = v.panel.element.querySelector('[type=search]');
    search.value = 'Blur';
    search.dispatchEvent(new v.dom.window.Event('input'));
    assert.equal(
      v.panel.element.querySelectorAll('.settings-row:not([hidden])').length,
      1
    );
    click(v, 'Reset Appearance');
    assert.equal(v.panel.values()['theme.mode'], 'auto');
    assert.equal(v.panel.values().title, 'Changed');
    click(v, 'Reset everything');
    assert.equal(v.panel.values().title, 'Changed');
  } finally {
    v.close();
  }
});

test('Escape closes non-modal drawer and restores opener focus', () => {
  const v = setup({ mode: 'drawer' });
  try {
    const opener = v.doc.querySelector('#opener');
    v.panel.open(opener);
    assert.equal(v.panel.element.hasAttribute('aria-modal'), false);
    v.doc.body.dispatchEvent(
      new v.dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      })
    );
    assert.ok(v.panel.element.hidden);
    assert.equal(v.doc.activeElement, opener);
  } finally {
    v.close();
  }
});

for (const layer of ['user', 'session']) {
  test(`panel writes through the real config ${layer} binding`, async () => {
    const { parse } = await import('@link-foundation/ui-core');
    const { createConfig } = await import('@link-foundation/ui-config');
    const { bindConfig } = await import('@link-foundation/ui-settings');
    const config = createConfig({
      document: parse('app: document\n  settings: group'),
    });
    const target = bindConfig(config, schema, { layer });
    const v = setup({ target });
    try {
      v.panel.update({ 'liquid.blur': 24 });
      assert.deepEqual(config.resolve('settings', 'liquid.blur'), {
        layer,
        value: ['24'],
      });
      click(v, 'Reset Blur');
      assert.equal(target.get('liquid.blur'), 18);
      target.set('title', 'External config change');
      assert.equal(v.panel.values().title, 'External config change');
    } finally {
      v.close();
    }
  });
}

test('panel randomize uses the injected random function', () => {
  const seed = () => {
    let n = 42;
    return () => (n = (n * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  };
  const a = setup({ random: seed() });
  const b = setup({ random: seed() });
  try {
    click(a, 'Randomize');
    click(b, 'Randomize');
    assert.deepEqual(a.panel.values(), b.panel.values());
    assert.notDeepEqual(a.panel.values(), defaults(schema));
  } finally {
    a.close();
    b.close();
  }
});
