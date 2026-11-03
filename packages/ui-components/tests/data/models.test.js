import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectItem } from '../../src/data/selection-model.js';
import { nextSort, sortItems } from '../../src/data/sort-model.js';

test('single, multi, range, toggle and missing anchors', () => {
  const base = { keys: ['a', 'b', 'c', 'd'], mode: 'multi' };
  let state = selectItem({ ...base, key: 'b' });
  state = selectItem({ ...base, ...state, key: 'd', shift: true });
  assert.deepEqual([...state.selected], ['b', 'c', 'd']);
  state = selectItem({ ...base, ...state, key: 'c', toggle: true });
  assert.deepEqual([...state.selected], ['b', 'd']);
  assert.deepEqual(
    [...selectItem({ ...base, ...state, mode: 'single', key: 'a' }).selected],
    ['a']
  );
  assert.deepEqual([...selectItem({ ...base, key: 'missing' }).selected], []);
  assert.deepEqual(
    [
      ...selectItem({ ...base, anchor: 'gone', key: 'd', shift: true })
        .selected,
    ],
    ['d']
  );
});
test('stable ascending, descending and original order after none', () => {
  const items = [
    { id: 'a', age: 2 },
    { id: 'b', age: 1 },
    { id: 'c', age: 2 },
  ];
  let sort = nextSort(null, 'age');
  assert.deepEqual(
    sortItems(items, sort).map((x) => x.id),
    ['b', 'a', 'c']
  );
  sort = nextSort(sort, 'age');
  assert.deepEqual(
    sortItems(items, sort).map((x) => x.id),
    ['a', 'c', 'b']
  );
  sort = nextSort(sort, 'age');
  assert.deepEqual(sortItems(items, sort), items);
  assert.equal(nextSort(sort, 'name').direction, 'ascending');
});
