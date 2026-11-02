/**
 * Stable IDs: named elements keep their id, anonymous elements get `_N`
 * IDs that never collide with named ones and are never reused.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  createIdGenerator,
  createStore,
  GENERATED_ID_PREFIX,
} from '@link-foundation/ui-store';
import {
  allIds,
  isInside,
  moveTargets,
  pick,
  randomNode,
  seededRandom,
  upTo,
} from './helpers.js';

describe('createIdGenerator', () => {
  it('counts up and skips used IDs', () => {
    const ids = createIdGenerator(['_2', '_4', 'a']);
    expect([ids.next(), ids.next(), ids.next()]).toEqual(['_1', '_3', '_5']);
    expect(GENERATED_ID_PREFIX).toBe('_');
  });

  it('never returns an ID twice, nor a reserved one', () => {
    const ids = createIdGenerator((id) => id === '_1');
    ids.reserve('_2');
    expect(ids.next()).toBe('_3');
    expect(ids.next()).toBe('_4');
  });
});

describe('store IDs', () => {
  it('generated IDs skip ids used anywhere in the document', () => {
    const store = createStore({
      text: '(text a)\n(_1: text b)\n(stack (_3: text c) (text d))\n',
    });
    expect(allIds(store)).toEqual(['_2', '_1', '_4', '_3', '_5']);
    expect(store.insert(null, 0, { kind: 'text' })).toBe('_6');
  });

  it('a removed ID is not generated again', () => {
    const store = createStore({ text: '(text a)' });
    store.remove('_1');
    expect(store.insert(null, 0, { kind: 'text' })).toBe('_2');
  });

  it('an inserted subtree does not get a generated ID it names itself', () => {
    const store = createStore();
    const id = store.insert(null, 0, {
      kind: 'row',
      children: [{ id: '_1', kind: 'text' }],
    });
    expect(id).toBe('_2');
    expect(store.children('_2')).toEqual(['_1']);
  });

  it('100 seeded random inserts, moves and removes keep every ID', () => {
    const rand = seededRandom(16);
    const named = ['_7', '_12', 'keep'];
    const store = createStore({
      text: named.map((id) => `(${id}: text (value ${id}))\n`).join(''),
    });
    /** The tag every element was inserted with, by ID. */
    const tags = new Map(named.map((id) => [id, id]));
    const seen = new Set(named);
    for (let n = 0; n < 100; n++) {
      const ids = allIds(store);
      const id = pick(rand, ids);
      const choice = ids.length < 3 ? 0 : upTo(rand, 3);
      if (choice <= 1) {
        const parentId = ids.length > 0 && rand() < 0.6 ? id : null;
        const size = (parentId === null ? store.roots() : store.children(id))
          .length;
        const node = randomNode(rand, n);
        node.properties = [{ name: 'value', values: [`t${n}`] }];
        node.children = [];
        const newId = store.insert(parentId, upTo(rand, size), node);
        expect(seen.has(newId)).toBe(false);
        if (node.id === null) {
          expect(newId.startsWith(GENERATED_ID_PREFIX)).toBe(true);
        }
        seen.add(newId);
        tags.set(newId, `t${n}`);
      } else if (choice === 2) {
        const [parentId, max] = pick(rand, moveTargets(store, id));
        store.move(id, parentId, upTo(rand, max));
      } else if (!named.some((each) => isInside(store, each, id))) {
        store.remove(id);
      }
      for (const each of allIds(store)) {
        expect(store.get(each).properties).toEqual([
          { name: 'value', values: [tags.get(each)] },
        ]);
      }
    }
    for (const id of named) {
      expect(store.has(id)).toBe(true);
    }
  });
});
