import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@link-foundation/ui-store';
import { parseOrThrow } from '@link-foundation/ui-core';
import { designerVocabulary } from '../src/catalog.js';
import { dropTarget } from '../src/drop.js';

for (const [direction, x, y, index] of [
  ['horizontal', 11, 45, 0],
  ['row', 109, 45, 1],
  ['row-reverse', 11, 45, 1],
  ['column-reverse', 60, 21, 1],
]) {
  test(`flow insertion follows ${direction} without changing the store`, () => {
    const store = createStore({
      document: parseOrThrow(
        `app: document\n  body: stack\n    direction ${direction}\n    a: text A\n`,
        { vocabulary: designerVocabulary() }
      ),
    });
    const target = {
      closest: () => null,
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        width: 100,
        height: 50,
      }),
    };
    const context = {
      store,
      policy: { lockedElements: new Set() },
      outline: { tree: { contains: () => false } },
      canvas: { contains: () => true },
      handle: { idFor: () => 'a', nodeFor: () => target },
    };
    const drop = dropTarget(context, target, x, y, ['text']);
    assert.equal(drop.valid, true);
    assert.equal(drop.parentId, 'body');
    assert.equal(drop.index, index);
    assert.equal(store.log().length, 0);
    assert.equal(dropTarget(context, target, 60, 45, ['text']).valid, false);
  });
}

test('Outline container drops measure the row, excluding its expanded descendants', () => {
  const store = createStore({
    text: 'app: document\n  body: stack\n    details: stack\n      hint: text Hint\n',
  });
  const label = {
    getBoundingClientRect: () => ({ left: 0, top: 20, width: 100, height: 28 }),
  };
  const row = {
    dataset: { id: 'details' },
    getBoundingClientRect: () => ({
      left: 0,
      top: 20,
      width: 100,
      height: 112,
    }),
    querySelector: () => label,
  };
  const context = {
    store,
    policy: { lockedElements: new Set() },
    outline: { tree: { contains: () => true } },
  };
  const drop = dropTarget(context, { closest: () => row }, 50, 34, ['text']);
  assert.equal(drop.parentId, 'details');
  assert.equal(drop.edge, null);
  assert.equal(drop.node, label);
});
