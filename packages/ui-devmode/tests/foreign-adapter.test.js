import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { importDom } from '@link-foundation/ui-convert';
import { readPatch } from '@link-foundation/ui-config';
import { createForeignAdapter } from '../src/foreign/adapter.js';

function setup(t) {
  const dom = new JSDOM(
    '<body><h2 id="title" style="color:blue">Hello</h2><p>Card</p><ui-foreign-devmode></ui-foreign-devmode></body>'
  );
  const root = dom.window.document.body;
  const ignore = (node) => node.localName === 'ui-foreign-devmode';
  const adapter = createForeignAdapter({ root, ignore });
  t.after(() => {
    adapter.destroy();
    dom.window.close();
  });
  return { dom, root, adapter, ignore };
}

test('foreign adapter preserves importer IDs and never annotates DOM', (t) => {
  const { root, adapter, ignore } = setup(t);
  const before = root.outerHTML;
  const expected = importDom(root, { ignore });
  assert.deepEqual(
    [...adapter.tree().toDocument().byId.keys()],
    [...expected.tree.byId.keys()]
  );
  for (const [id, node] of expected.nodeMap) {
    assert.equal(adapter.nodeFor(id), node);
    assert.equal(adapter.idFor(node), id);
  }
  assert.equal(root.outerHTML, before);
  assert.equal(adapter.tree().toDocument().roots[0].children.length, 2);
});

test('foreign adapter records keyed session edits and exports valid migration LiNo', (t) => {
  const { root, adapter } = setup(t);
  adapter.applyProperty('title', 'text', 'Changed');
  adapter.applyProperty('title', 'style color', 'red');
  assert.equal(root.querySelector('h2').textContent, 'Changed');
  assert.equal(root.querySelector('h2').style.color, 'red');
  const patch = readPatch(adapter.exportOverrides().text, {
    keyedProps: ['attr', 'style'],
  });
  assert.equal(patch.ops.length, 2);
  assert.ok(patch.ops.every((op) => op.op === 'set'));
  assert.match(adapter.subtree('title'), /Changed/);
  adapter.refresh();
  assert.equal(adapter.exportOverrides().count, 2);
  adapter.config.clear('session');
  assert.equal(root.querySelector('h2').textContent, 'Hello');
  assert.equal(root.querySelector('h2').style.color, 'blue');
});

test('foreign adapter restores only safe edits and tracks replacement nodes', (t) => {
  const { root, adapter } = setup(t);
  const rejected = adapter.restore(
    'saved: overrides\n  layer session\n  set title text Saved\n  set title attr onclick bad\n'
  );
  assert.equal(rejected.length, 1);
  assert.equal(root.querySelector('h2').textContent, 'Saved');
  const replacement = root.ownerDocument.createElement('h2');
  replacement.id = 'title';
  replacement.textContent = 'New';
  root.querySelector('h2').replaceWith(replacement);
  adapter.refresh();
  assert.equal(adapter.nodeFor('title'), replacement);
  assert.equal(adapter.idFor(replacement), 'title');
  assert.equal(replacement.textContent, 'Saved');
  adapter.config.clear('session');
  assert.equal(replacement.textContent, 'New');
});

test('new attributes reset to absence after a DOM refresh', (t) => {
  const { root, adapter } = setup(t);
  adapter.applyProperty('title', 'attr title', 'Tooltip');
  adapter.refresh();
  assert.equal(adapter.exportOverrides().count, 1);
  adapter.config.clear('session');
  assert.equal(root.querySelector('h2').hasAttribute('title'), false);
});

test('closed shadow roots remain a single opaque imported host', (t) => {
  const { root, adapter } = setup(t);
  const host = root.ownerDocument.createElement('closed-widget');
  host.id = 'widget';
  host.attachShadow({ mode: 'closed' }).innerHTML =
    '<b id="secret">Private</b>';
  root.append(host);
  adapter.refresh();
  assert.equal(adapter.nodeFor('widget'), host);
  assert.equal(adapter.nodeFor('secret'), null);
  assert.equal(adapter.tree().children('widget').length, 0);
});

test('importDom ignore excludes whole hosts before structural IDs are assigned', () => {
  const { document } = new JSDOM(
    '<body><aside><b>Inspector</b></aside><p>Page</p></body>'
  ).window;
  const ignored = importDom(document.body, {
    ignore: (node) => node.localName === 'aside',
  });
  const plain = importDom(
    new JSDOM('<body><p>Page</p></body>').window.document.body
  );
  assert.equal(ignored.text, plain.text);
});
