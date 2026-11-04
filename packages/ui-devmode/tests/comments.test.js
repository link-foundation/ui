import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseLinks } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import {
  commentDocument,
  createComments,
  readComments,
} from '../src/comments/model.js';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { lasso } from '../src/comments/geometry.js';

const SOURCE = `app: stack
  title: text Hello
  ok: button
    label OK
`;
const setup = () => {
  let doc = parse(SOURCE);
  const model = createComments({ getDocument: () => doc });
  return {
    model,
    change: () => {
      doc = parse(SOURCE.replace('OK', 'Save'));
    },
  };
};

describe('per-object UI comments', () => {
  it('creates one independent task per distinct object against an exact revision', () => {
    const { model, change } = setup();
    const tasks = model.add(['ok', 'title', 'ok'], 'Make this clearer');
    assert.equal(tasks.length, 2);
    assert.deepEqual(
      tasks.map((t) => t.target),
      ['ok', 'title']
    );
    model.update(tasks[0].id, { instruction: 'Use Save', status: 'resolved' });
    assert.equal(model.tasks()[1].instruction, 'Make this clearer');
    assert.equal(model.tasks()[0].status, 'resolved');
    change();
    assert.equal(model.state(tasks[0].id), 'outdated');
    model.add(['ok'], 'Use a larger label', 'voice');
    assert.equal(model.revisions().length, 2);
    assert.equal(model.events().length, 4);
  });

  it('round trips Unicode, quotes, multiline instructions and history as nested LiNo', () => {
    const { model } = setup();
    const instruction =
      'Сделай «ОК» ярче\nKeep \'quotes\' and "text" <img onerror=alert(1)>';
    const [task] = model.add(['ok'], instruction, 'voice');
    model.update(task.id, { status: 'resolved' });
    const text = model.export();
    assert.equal(parseLinks(text)[0].values[0], 'ui-comments');
    assert.match(text, /^ui-review: ui-comments\n {2}version 1\n/);
    const restored = createComments({ getDocument: () => parse(SOURCE), text });
    assert.deepEqual(restored.tasks(), model.tasks());
    assert.deepEqual(restored.events(), model.events());
    assert.equal(restored.export(), text);
    const copy = restored.tasks();
    copy[0].instruction = 'mutated';
    assert.equal(restored.tasks()[0].instruction, instruction);
  });

  it('keeps the documented handoff readable and executable by the official reader', () => {
    const doc = readFileSync(
      new URL('../../../docs/spec/comments.md', import.meta.url),
      'utf8'
    );
    const example = doc
      .replaceAll('\r\n', '\n')
      .split('```lino\n')[1]
      .split('```')[0];
    const model = createComments({
      getDocument: () => parse('ok: button\n  label OK\n'),
    });
    model.add(['ok'], 'Use Save changes');
    assert.equal(model.export(), example);
    assert.equal(
      readComments(example).revisions[0].source,
      'ok: button\n  label OK\n'
    );
  });

  it('names anonymous objects only in snapshots and retains IDs after import', () => {
    const store = createStore({ text: 'stack\n  button\n    label OK\n' });
    const before = store.toDocument();
    const getDocument = () => commentDocument(store);
    const target = store.children(store.roots()[0])[0];
    const model = createComments({ getDocument });
    const [first] = model.add([target], 'Improve label');
    assert.equal(readComments(model.export()).tasks[0].target, target);
    assert.equal(model.state(first.id), 'current');
    assert.deepEqual(store.toDocument(), before);
    const restored = createComments({ getDocument, text: model.export() });
    restored.remove(first.id);
    assert.notEqual(restored.add([target], 'Change again')[0].id, first.id);
  });

  it('validates atomically and rejects malformed or unknown targets and empty text', () => {
    const { model } = setup();
    for (const ids of [[], ['ok', 'missing']]) {
      assert.throws(() => model.add(ids, 'Change'), /target/i);
    }
    assert.throws(() => model.add(['ok'], '   '), /instruction/i);
    assert.throws(() => model.add(['ok'], 'x'.repeat(4001)), /instruction/i);
    assert.throws(() => model.add(['ok'], 'Change', 'script'), /input/i);
    assert.equal(model.tasks().length, 0);
    assert.equal(model.revisions().length, 0);
    const [task] = model.add(['ok'], 'Change');
    assert.throws(
      () => model.update(task.id, { status: 'applied' }),
      /status/i
    );
    assert.throws(
      () => model.update(task.id, { instruction: '' }),
      /instruction/i
    );
    assert.equal(model.tasks()[0].status, 'open');
    assert.throws(
      () => readComments(model.export().replace('target ok', 'target missing')),
      /target/i
    );
    assert.throws(
      () => readComments(model.export().replace('version 1', 'version 2')),
      /version/i
    );
    assert.throws(
      () =>
        readComments(model.export().replace('status open', 'status applied')),
      /status/i
    );
    assert.throws(
      () =>
        readComments(
          model.export().replace('  version 1', '  version 1\n  execute evil')
        ),
      /field/i
    );
    assert.throws(() => readComments('x'.repeat(1048577)), /large|size|limit/i);
  });

  it('retains missing-object comments, detects staleness, and logs edits and deletion', () => {
    let doc = parse(SOURCE);
    const events = [];
    const model = createComments({
      getDocument: () => doc,
      trace: (...args) => events.push(args),
    });
    const [task] = model.add(['ok'], 'Change');
    assert.equal(model.state(task.id), 'current');
    doc = parse('app: stack');
    assert.equal(model.state(task.id), 'missing');
    model.remove(task.id);
    assert.equal(model.tasks().length, 0);
    assert.deepEqual(
      model.events().map((e) => e.action),
      ['create', 'remove']
    );
    assert.equal(events.length, 2);
    assert.equal(readComments(model.export()).events.length, 2);
  });
});

describe('freehand lasso geometry', () => {
  const rects = [
    { id: 'inside', x: 10, y: 10, width: 4, height: 4 },
    { id: 'outside', x: 80, y: 80, width: 4, height: 4 },
    { id: 'crossing', x: 18, y: 5, width: 10, height: 5 },
    { id: 'container', x: -10, y: -10, width: 120, height: 120 },
  ];
  it('selects intersecting objects without enclosing ancestors and respects the polygon', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 0, y: 30 },
    ];
    assert.deepEqual(lasso(rects, polygon), ['inside', 'crossing']);
    assert.deepEqual(lasso(rects, [...polygon].reverse()), [
      'inside',
      'crossing',
    ]);
    assert.deepEqual(lasso(rects, polygon.slice(0, 2)), []);
    assert.deepEqual(
      lasso([{ id: 'touch', x: 0, y: 0, width: 1, height: 1 }], polygon),
      ['touch']
    );
  });
});
