import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '@link-foundation/ui-store';
import { designerVocabulary } from '../src/catalog.js';
import { parseOrThrow } from '@link-foundation/ui-core';
import {
  renderGeometry,
  resizeElement,
  nudgeElements,
} from '../src/geometry.js';

test('size gestures respect dimension properties and the existing numeric window vocabulary', () => {
  const store = createStore({
    document: parseOrThrow(
      `app: document
  text: text Hello
    width 100px
  floating: window
    x 48
    y 48
    width 360
    height 240
`,
      { vocabulary: designerVocabulary() }
    ),
  });
  resizeElement(store, 'text', 120, 30);
  assert.deepEqual(
    store.get('text').properties.find((p) => p.name === 'width').values,
    ['120px']
  );
  resizeElement(store, 'floating', 400, 280);
  assert.deepEqual(
    store.get('floating').properties.find((p) => p.name === 'width').values,
    ['400']
  );
  assert.equal(store.log().length, 2);
  nudgeElements(store, ['floating'], 1, 10);
  const style = {
    left: '49px',
    top: '58px',
    width: '400px',
    height: '280px',
    transform: '',
  };
  renderGeometry(store, {
    nodeFor: (id) => (id === 'floating' ? { style } : null),
  });
  assert.deepEqual(style, {
    left: '49px',
    top: '58px',
    width: '400px',
    height: '280px',
    transform: '',
  });
  store.undo();
  store.undo();
  assert.deepEqual(
    store.get('floating').properties.find((p) => p.name === 'width').values,
    ['360']
  );
});
