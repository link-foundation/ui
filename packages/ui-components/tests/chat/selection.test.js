import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChatSelection } from '../../src/chat/selection.js';
test('context target never changes multi-selection; range, toggle and escape', () => {
  const selection = createChatSelection();
  selection.select('a');
  selection.select('c', { toggle: true });
  selection.target('b');
  assert.deepEqual([...selection.state().selected], ['a', 'c']);
  assert.equal(selection.state().target, 'b');
  selection.select('a', { range: true, keys: ['a', 'b', 'c'] });
  assert.deepEqual([...selection.state().selected], ['a', 'b', 'c']);
  selection.select('b', { toggle: true });
  assert.deepEqual([...selection.state().selected], ['a', 'c']);
  selection.clear();
  assert.equal(selection.state().target, null);
  assert.equal(selection.state().selected.size, 0);
});
