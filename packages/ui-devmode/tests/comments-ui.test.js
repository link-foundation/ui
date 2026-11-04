import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, key } from './setup.js';
import { mountComments } from '../src/comments/index.js';

const mount = (options = {}) => {
  const page = createPage();
  const comments = mountComments({
    root: page.root,
    tree: page.store,
    nodeFor: (id) => page.handle.nodeFor(id),
    storage: page.window.localStorage,
    storageKey: 'test-comments',
    ...options,
  });
  return {
    ...page,
    comments,
    $: (s) => comments.host.shadowRoot.querySelector(s),
  };
};

describe('comment interaction', () => {
  it('picks without executing actions, adds tasks, edits, persists and restores', () => {
    const { comments, $, handle, actions, window } = mount();
    const button = handle.nodeFor('ok').querySelector('button');
    button.click();
    assert.deepEqual(comments.selection(), ['ok']);
    assert.equal(actions.length, 0);
    $('[data-field="instruction"]').value = '<b>Use Save</b>';
    $('[data-action="add"]').click();
    assert.equal(comments.model.tasks().length, 1);
    assert.equal(
      $('[data-task] textarea').value.includes('<b>Use Save</b>'),
      true
    );
    assert.equal($('b'), null);
    const exported = comments.model.export();
    assert.equal(window.localStorage.getItem('test-comments'), exported);
    comments.destroy();
    const restored = mountComments({
      root: handle.nodeFor('app').parentNode,
      tree: comments.tree,
      nodeFor: (id) => handle.nodeFor(id),
      storage: window.localStorage,
      storageKey: 'test-comments',
    });
    assert.equal(restored.model.export(), exported);
    restored.destroy();
    window.close();
  });

  it('selects objects by keyboard, cancels lasso and cleans listeners on close', () => {
    const { comments, $, window, handle, actions } = mount();
    const input = $('[data-target="ok"]');
    input.click();
    assert.deepEqual(comments.selection(), ['ok']);
    $('[data-action="lasso"]').click();
    window.dispatchEvent(key(window, { key: 'Escape' }));
    assert.equal(
      $('[data-action="lasso"]').getAttribute('aria-pressed'),
      'false'
    );
    comments.destroy();
    handle.nodeFor('ok').querySelector('button').click();
    assert.equal(actions.length, 1);
    window.close();
  });

  it('keeps unsaved comments usable when storage is unavailable and rejects bad imports', () => {
    const { comments, $, window } = mount({
      storage: {
        getItem() {
          throw new Error('denied');
        },
        setItem() {
          throw new Error('quota');
        },
      },
    });
    comments.select(['ok']);
    $('[data-field="instruction"]').value = 'Change';
    $('[data-action="add"]').click();
    assert.equal(comments.model.tasks().length, 1);
    assert.match($('[role="status"]').textContent, /quota/);
    $('[data-field="exchange"]').value = 'invalid';
    $('[data-action="import"]').click();
    assert.equal(comments.model.tasks().length, 1);
    comments.destroy();
    window.close();
  });
});

it('opens shared comments from the inspector and restores the inspector on close', async () => {
  const { mountDevMode } = await import('../src/index.js');
  const page = createPage();
  const dev = mountDevMode({ ...page, commentOptions: { storage: null } });
  await dev.open();
  const inspector = page.document.querySelector('ui-devmode-inspector');
  const opener = inspector.shadowRoot.querySelector(
    '[data-command="comments"]'
  );
  opener.focus();
  opener.click();
  const host = page.document.querySelector('ui-comments');
  assert.ok(host);
  assert.equal(inspector.style.visibility, 'hidden');
  page.window.dispatchEvent(key(page.window, { key: 'Escape' }));
  assert.ok(page.document.querySelector('ui-comments'));
  page.window.dispatchEvent(key(page.window, { key: 'Escape' }));
  assert.equal(page.document.querySelector('ui-comments'), null);
  assert.equal(inspector.style.visibility, '');
  assert.equal(inspector.shadowRoot.activeElement, opener);
  assert.equal(dev.isOpen, true);
  inspector.shadowRoot.querySelector('[data-command="comments"]').click();
  dev.destroy();
  assert.equal(page.document.querySelector('ui-comments'), null);
  page.window.close();
});

it('refreshes revision and missing-target indicators after direct store changes', async () => {
  const { mountDevMode } = await import('../src/index.js');
  const page = createPage();
  const dev = mountDevMode({ ...page, commentOptions: { storage: null } });
  await dev.open();
  page.document
    .querySelector('ui-devmode-inspector')
    .shadowRoot.querySelector('[data-command="comments"]')
    .click();
  const shadow = page.document.querySelector('ui-comments').shadowRoot;
  shadow.querySelector('[data-target=ok]').click();
  shadow.querySelector('[data-field=instruction]').value = 'Change label';
  shadow.querySelector('[data-action=add]').click();
  assert.match(shadow.querySelector('.meta').textContent, /current/);
  page.store.setProp('ok', 'label', ['Save']);
  assert.match(shadow.querySelector('.meta').textContent, /outdated/);
  page.store.remove('ok');
  assert.match(shadow.querySelector('.meta').textContent, /missing/);
  dev.destroy();
  page.window.close();
});
