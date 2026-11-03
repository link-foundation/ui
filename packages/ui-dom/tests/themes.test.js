import { it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { mountDocument } from '@link-foundation/ui-dom';
import { CONTROL_KIND_SPECS } from '@link-foundation/ui-components/controls';
import { createDom } from './setup-dom.js';

const text = `app: document
  theme base
  scheme light
  outer: stack
    scheme dark
    inner: stack
      scheme light
      ok: button 'Save'`;
const themes = `base: theme
  motion reduced
  template button
    part root
      kind box
    part label
      kind text
    part indicator
      kind box`;

it('switches scheme with only attribute mutations on theme boundaries, zero new nodes', () => {
  const { window, container } = createDom();
  const { store, handle } = mountDocument(container, text, { themes });
  const nodes = [...container.querySelectorAll('*')];
  const observer = new window.MutationObserver(() => {});
  observer.observe(container, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  store.setProp('app', 'scheme', ['dark']);
  handle.flush();
  const records = observer.takeRecords();
  assert.ok(records.length > 0);
  assert.ok(
    records.every(
      (r) =>
        r.type === 'attributes' &&
        ['app', 'outer', 'inner'].includes(
          r.target.getAttribute('data-link-id')
        )
    )
  );
  assert.deepEqual([...container.querySelectorAll('*')], nodes);
  assert.equal(handle.nodeFor('inner').dataset.scheme, 'light');
  observer.disconnect();
  handle.destroy();
  window.close();
});
it('copies all four values, inherits updates, removes boundaries, and follows moved subtrees', () => {
  const { window, container } = createDom();
  const { store, handle } = mountDocument(container, text, { themes });
  assert.equal(handle.nodeFor('outer').dataset.theme, 'base');
  assert.equal(handle.nodeFor('inner').dataset.motion, 'reduced');
  store.removeProp('inner', 'scheme');
  handle.flush();
  assert.equal(handle.nodeFor('inner').hasAttribute('data-theme'), false);
  store.setProp('inner', 'contrast', ['more']);
  handle.flush();
  assert.equal(handle.nodeFor('inner').dataset.scheme, 'dark');
  store.move('inner', 'app');
  handle.flush();
  assert.equal(handle.nodeFor('inner').dataset.scheme, 'light');
  handle.destroy();
  window.close();
});
it('keeps all user comfort choices over nested theme defaults and follows config edits', () => {
  const { window, container } = createDom();
  const config = createConfig({ document: parse(text) });
  config.set('user', 'app', 'motion', ['full']);
  config.set('user', 'app', 'sound', ['off']);
  config.set('user', 'app', 'volume', ['0.2']);
  config.set('user', 'app', 'transparency', ['reduced']);
  const { handle } = mountDocument(container, text, { themes, config });
  for (const id of ['app', 'outer', 'inner']) {
    assert.equal(handle.nodeFor(id).dataset.motion, 'full');
    assert.equal(handle.nodeFor(id).dataset.sound, 'off');
    assert.equal(handle.nodeFor(id).dataset.volume, '0.2');
    assert.equal(handle.nodeFor(id).dataset.transparency, 'reduced');
  }
  config.set('user', 'app', 'motion', ['reduced']);
  assert.equal(handle.nodeFor('inner').dataset.motion, 'reduced');
  handle.destroy();
  window.close();
});
it('the real button consumes the part tree and preserves native behavior and parts on switch', () => {
  const { window, container } = createDom();
  const { handle, store } = mountDocument(container, text, {
    themes,
    kinds: CONTROL_KIND_SPECS,
  });
  const button = handle.nodeFor('ok').querySelector('button');
  assert.ok(button.querySelector('[data-part="indicator"]'));
  assert.equal(button.querySelector('[data-part="label"]').textContent, 'Save');
  store.setProp('app', 'scheme', ['dark']);
  store.setProp('ok', 'label', ['Changed']);
  handle.flush();
  assert.equal(handle.nodeFor('ok').querySelector('button'), button);
  assert.equal(
    button.querySelector('[data-part="label"]').textContent,
    'Changed'
  );
  handle.destroy();
  window.close();
});
it('inherits surrounding DOM choices and mounts the implicit theme template', () => {
  const { window, container } = createDom();
  container.setAttribute('data-theme', 'base');
  container.setAttribute('data-scheme', 'dark');
  container.setAttribute('data-motion', 'full');
  const { handle } = mountDocument(
    container,
    `app: document
  contrast more
  ok: button Save`,
    { themes, kinds: CONTROL_KIND_SPECS }
  );
  assert.equal(handle.nodeFor('app').dataset.scheme, 'dark');
  assert.equal(handle.nodeFor('app').dataset.motion, 'full');
  assert.equal(handle.nodeFor('app').dataset.contrast, 'more');
  assert.ok(handle.nodeFor('ok').querySelector('[data-part="indicator"]'));
  handle.destroy();
  window.close();
});
