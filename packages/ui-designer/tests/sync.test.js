import { URL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createStore } from '@link-foundation/ui-store';
import { parse } from '@link-foundation/ui-core';
import {
  canvasToSource,
  sourceToStore,
  createDocumentSession,
} from '../src/sync.js';
import {
  insertElement,
  moveElements,
  setProperty,
  removeElements,
} from '../src/commands.js';

for (const file of readdirSync(new URL('./fixtures/', import.meta.url)).filter(
  (f) => f.endsWith('.input.lino')
)) {
  test(`canvas edit preserves every surrounding byte and comment: ${file}`, () => {
    const input = readFileSync(
      new URL(`./fixtures/${file}`, import.meta.url),
      'utf8'
    );
    const expected = readFileSync(
      new URL(
        `./fixtures/${file.replace('.input.', '.expected.')}`,
        import.meta.url
      ),
      'utf8'
    );
    const output = canvasToSource(input, {
      op: 'setProp',
      id: 'ok',
      name: 'label',
      values: ['Save'],
    });
    assert.equal(output, expected);
    assert.deepEqual(parse(output).roots, parse(expected).roots);
  });
}
test('source diff keeps IDs and applies property, move, insertion and deletion in one transaction', () => {
  const store = createStore({
    text: 'app: document\n  body: stack\n    a: text A\n    b: text B\n',
  });
  const target =
    'app: document\n  body: stack\n    b: text Edited\n    c: button\n      label New\n';
  assert.equal(sourceToStore(store, target).error, undefined);
  assert.deepEqual(store.children('body'), ['b', 'c']);
  assert.equal(store.log().length, 1);
  assert.deepEqual(store.get('b').positional, ['Edited']);
  store.undo();
  assert.deepEqual(store.children('body'), ['a', 'b']);
  store.redo();
  assert.deepEqual(store.children('body'), ['b', 'c']);
});
test('anonymous nodes keep their IDs across text edits and moves of named ancestors', () => {
  const store = createStore({
    text: 'app: document\n  body: stack\n    text Hello\n',
  });
  const [id] = store.children('body');
  sourceToStore(store, 'app: document\n  body: stack\n    text World\n');
  assert.deepEqual(store.children('body'), [id]);
});
test('invalid source provides a line and column and leaves history and canvas intact', () => {
  const store = createStore({
    text: 'app: document\n  ok: button\n    label OK\n',
  });
  const before = store.toLino();
  const result = sourceToStore(
    store,
    'app: document\n  ok: button\n    (label OK'
  );
  assert.equal(typeof result.error.message, 'string');
  assert.equal(result.error.line, 3);
  assert.ok(result.error.column > 0);
  assert.equal(store.toLino(), before);
  assert.equal(store.log().length, 0);
});
test('document session preserves comments through complete gestures, undo and redo, and source edits', () => {
  const original =
    '# header\napp: document\n  body: stack\n    # greeting\n    a: text A\n    ok: button\n      label OK # action\n';
  const session = createDocumentSession(original);
  const added = session.run((store) =>
    insertElement(store, { parentId: 'body', index: 1, type: 'text' })
  );
  assert.ok(session.getText().includes('# greeting'));
  session.undo();
  assert.equal(session.getText(), original);
  session.redo();
  session.run((store) =>
    moveElements(store, { ids: added, parentId: 'body', index: 0 })
  );
  session.run((store) => setProperty(store, 'ok', 'label', 'Save'));
  assert.ok(session.getText().includes('label Save # action'));
  session.run((store) => removeElements(store, ['a']));
  session.undo();
  assert.ok(session.getText().includes('# greeting'));
  const before = session.getText();
  assert.equal(
    session.editSource(before.replace('text A', 'text B')).error,
    undefined
  );
  session.undo();
  assert.equal(session.getText(), before);
});

test('anonymous canvas edits remain addressable through later source edits and history', () => {
  const original = '# anonymous\napp: document\n  stack\n    text Hello\n';
  const session = createDocumentSession(original);
  const [parent] = session.store.children('app');
  const [id] = session.store.children(parent);
  session.run((s) => setProperty(s, id, 'value', 'World'));
  session.run((s) => insertElement(s, { parentId: parent, type: 'button' }));
  assert.equal(
    session.editSource(session.getText().replace('World', 'Again')).error,
    undefined
  );
  assert.equal(session.store.get(id).positional[0], 'Again');
  session.undo();
  session.undo();
  session.undo();
  assert.equal(session.getText(), original);
});

test('comment-only and empty source edits each have exact-text undo and redo', () => {
  const session = createDocumentSession('app: document\n');
  const commented = '# Header\napp: document\n';
  session.editSource(commented);
  assert.equal(session.store.log().length, 1);
  session.undo();
  assert.equal(session.getText(), 'app: document\n');
  session.redo();
  assert.equal(session.getText(), commented);
  session.editSource('');
  session.editSource('# Empty\n');
  session.undo();
  assert.equal(session.getText(), '');
  session.undo();
  assert.equal(session.getText(), commented);
});

test('validation refuses canvas and source gestures before committing text or history', () => {
  const session = createDocumentSession('app: document\n  a: text A\n');
  const refuse = () => {
    throw new Error('locked');
  };
  assert.throws(
    () => session.run((s) => setProperty(s, 'a', 'value', 'B'), 'Edit', refuse),
    /locked/
  );
  assert.equal(
    session.editSource('app: document\n  a: text B\n', refuse).error.message,
    'locked'
  );
  assert.equal(session.store.log().length, 0);
  assert.equal(session.getText(), 'app: document\n  a: text A\n');
});
