import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSelection, marquee } from '../src/selection.js';

test('toggle, anchored ranges and marquee use deterministic selection sets', () => {
  const selection = createSelection();
  selection.select('b');
  selection.toggle('d');
  assert.deepEqual([...selection.ids], ['b', 'd']);
  selection.range('a', ['a', 'b', 'c', 'd']);
  assert.deepEqual([...selection.ids], ['a', 'b', 'c', 'd']);
  selection.toggle('b');
  assert.equal(selection.ids.has('b'), false);
  selection.retain(['a', 'b']);
  assert.deepEqual([...selection.ids], ['a']);
  assert.deepEqual(
    marquee(
      [
        { id: 'a', x: 0, y: 0, width: 10, height: 10 },
        { id: 'b', x: 20, y: 0, width: 10, height: 10 },
      ],
      { x: 11, y: 11, width: -12, height: -12 }
    ),
    ['a']
  );
});
