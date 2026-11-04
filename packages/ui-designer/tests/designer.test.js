import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import { getKind } from '@link-foundation/ui-dom';
import { mountDesigner } from '../src/designer.js';
import { DESIGNER_LAYOUT } from '../src/layout-text.js';

const TEXT =
  'app: document\n  body: stack\n    secret: text Protected\n    public: text Public\n';
function setup(options = {}) {
  const dom = new JSDOM('<!doctype html><main id="app"></main>', {
    url: 'https://designer.test/',
    pretendToBeVisual: true,
  });
  const root = dom.window.document.getElementById('app');
  const designer = mountDesigner({ root, documentText: TEXT, ...options });
  return {
    dom,
    root,
    designer,
    close() {
      designer.destroy();
      dom.window.close();
    },
  };
}
test('the embedded shell is the exact LiNo file', () => {
  assert.equal(
    DESIGNER_LAYOUT,
    readFileSync(new URL('../src/designer.lino', import.meta.url), 'utf8')
  );
});
test('mounting and destroying a designer preserves the host control renderer', () => {
  const button = getKind('button');
  const page = setup({
    documentText: `${TEXT}    action: button Act\n`,
  });
  try {
    assert.equal(getKind('button'), button);
    assert.ok(
      page.root.querySelector(
        '.designer-canvas [data-link-id=action] [data-part=root]'
      )
    );
  } finally {
    page.close();
  }
  assert.equal(getKind('button'), button);
});
test('an invalid Source draft remains visible when selection changes, and can be corrected', async () => {
  const page = setup({ storage: null });
  page.designer.editSource(`${TEXT}\n(`);
  const error = page.root.querySelector('[role=alert]');
  const message = error.textContent;
  assert.match(message, /Line \d+, column \d+/);
  page.designer.select('public');
  assert.equal(error.textContent, message);
  assert.equal(page.designer.getText(), TEXT);
  page.designer.editSource(TEXT.replace('Public', 'Corrected'));
  await Promise.resolve();
  assert.equal(error.textContent, '');
  assert.equal(
    page.root.querySelector('.designer-canvas [data-link-id=public]')
      .textContent,
    'Corrected'
  );
  page.close();
});
test('policy rejects source, property and ancestor deletion without history or draft changes', async () => {
  const page = setup({
    policy: 'policy: dev-mode\n  locked-elements secret\n',
  });
  await Promise.resolve();
  const { designer, root } = page;
  assert.match(
    designer.editSource(TEXT.replace('Protected', 'Changed')).error.message,
    /locked/
  );
  assert.equal(designer.getText(), TEXT);
  designer.select('body');
  root.querySelector('[data-link-id=delete] button').click();
  assert.equal(designer.getText(), TEXT);
  assert.equal(designer.store.log().length, 0);
  assert.equal(
    designer.editSource(TEXT.replace('Public', 'Allowed')).error,
    undefined
  );
  assert.equal(designer.store.log().length, 1);
  page.close();
});
test('two instances isolate selection, drafts and cleanup; storage errors remain usable', async () => {
  const unavailable = {
    getItem() {
      throw new Error('Unavailable');
    },
    setItem() {
      throw new Error('Full');
    },
  };
  const a = setup({ storage: unavailable });
  const b = setup({ storage: null });
  await Promise.resolve();
  a.designer.select('public');
  assert.equal(b.root.querySelectorAll('[data-selected]').length, 0);
  assert.equal(
    a.designer.editSource(TEXT.replace('Public', 'Changed')).error,
    undefined
  );
  assert.equal(b.designer.getText(), TEXT);
  a.close();
  b.close();
});

test('designer shares per-object comments without changing document history', async () => {
  const page = setup({ storage: null });
  page.designer.select('public');
  const before = page.designer.getText();
  const history = page.designer.store.log().length;
  page.root.querySelector('[data-link-id=comments] button').click();
  await Promise.resolve();
  const comments = page.dom.window.document.querySelector('ui-comments');
  assert.ok(comments);
  const shadow = comments.shadowRoot;
  assert.equal(shadow.querySelector('[data-target=public]').checked, true);
  shadow.querySelector('[data-field=instruction]').value = 'Make this clearer';
  shadow.querySelector('[data-action=add]').click();
  assert.ok(shadow.querySelector('[data-task]'));
  assert.equal(page.designer.getText(), before);
  assert.equal(page.designer.store.log().length, history);
  page.close();
  assert.equal(comments.isConnected, false);
});
