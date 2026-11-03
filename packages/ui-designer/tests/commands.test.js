import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@link-foundation/ui-store';
import {
  insertElement,
  moveElements,
  removeElements,
  duplicateElements,
  setProperty,
  copyElements,
  pasteElements,
  canContain,
} from '../src/commands.js';

const text = `app: document
  body: stack
    a: text A
    b: button
      label B
    c: text C
`;
test('commands group each gesture, preserve order, and undo and redo atomically', () => {
  const store = createStore({ text });
  const original = store.toLino();
  const [id] = insertElement(store, {
    parentId: 'body',
    index: 1,
    type: 'text',
    props: { value: 'New' },
  });
  assert.equal(store.children('body')[1], id);
  assert.equal(store.log().length, 1);
  assert.equal(store.undo(), true);
  assert.equal(store.toLino(), original);
  assert.equal(store.redo(), true);
  moveElements(store, { ids: ['a', 'b'], parentId: 'body', index: 4 });
  assert.deepEqual(store.children('body'), [id, 'c', 'a', 'b']);
  store.undo();
  assert.deepEqual(store.children('body'), ['a', id, 'b', 'c']);
  const before = store.toLino();
  const copies = duplicateElements(store, ['a', 'b']);
  assert.equal(copies.length, 2);
  store.undo();
  assert.equal(store.toLino(), before);
  removeElements(store, ['body', 'a']);
  assert.deepEqual(store.children('app'), []);
  store.undo();
  assert.equal(store.toLino(), before);
  setProperty(store, 'b', 'label', 'Save');
  assert.deepEqual(store.get('b').properties[0].values, ['Save']);
  store.undo();
  assert.equal(store.toLino(), before);
});

test('catalog child rules and cycles refuse the entire gesture', () => {
  const store = createStore({ text });
  const original = store.toLino();
  assert.equal(canContain(undefined, 'button', 'text'), false);
  assert.equal(
    canContain(new Map([['list', { children: ['item'] }]]), 'list', 'text'),
    false
  );
  assert.throws(
    () => insertElement(store, { parentId: 'b', type: 'text' }),
    /contain/
  );
  assert.throws(
    () => moveElements(store, { ids: ['body'], parentId: 'body', index: 0 }),
    /itself|cycle/
  );
  assert.equal(store.toLino(), original);
  assert.equal(store.log().length, 0);
});

test('LiNo clipboard remaps subtree IDs and references once, including ancestor selections', () => {
  const store = createStore({
    text: `app: document
  group: stack
    field: text-field
      label Name
    caption: label
      value Name
      for field
`,
  });
  const fragment = copyElements(store, ['group', 'field']);
  const [id] = pasteElements(store, { parentId: 'app', text: fragment });
  const [field, caption] = store.children(id);
  assert.notEqual(field, 'field');
  assert.deepEqual(
    store.get(caption).properties.find((p) => p.name === 'for').values,
    [field]
  );
  assert.equal(store.log().length, 1);
  store.undo();
  assert.deepEqual(store.children('app'), ['group']);
});
