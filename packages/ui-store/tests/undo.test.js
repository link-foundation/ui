/**
 * Undo and redo: inverses applied as new transactions.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore } from '@link-foundation/ui-store';
import {
  errorCode,
  randomOp,
  recorded,
  samples,
  seededRandom,
} from './helpers.js';

const TEXT = "(ok: button (label 'OK'))\n(stack (text a) (text b))\n";

describe('undo / redo', () => {
  for (const [seed, sample] of [
    [1, null],
    [2, 'document.lino'],
    [3, 'styles.lino'],
  ]) {
    it(`seed ${seed}: undoing 200 random operations restores ${sample ?? 'TEXT'} exactly`, () => {
      const text = sample
        ? samples().find((s) => s.name === sample).text
        : TEXT;
      const store = createStore({ text });
      const initial = store.toLino();
      const rand = seededRandom(seed);
      const kinds = new Set();
      for (let n = 0; n < 200; n++) {
        kinds.add(randomOp(store, rand, n));
      }
      expect(kinds.size).toBe(7);
      const final = store.toLino();
      expect(final === initial).toBe(false);
      let undone = 0;
      while (store.undo()) {
        undone += 1;
      }
      expect(store.toLino()).toBe(initial);
      expect(store.canUndo()).toBe(false);
      while (store.redo()) {
        undone -= 1;
      }
      expect(undone).toBe(0);
      expect(store.toLino()).toBe(final);
      expect(store.canRedo()).toBe(false);
    });
  }

  it('undo is a new transaction; the log only grows', () => {
    const store = createStore({ text: TEXT });
    const calls = recorded(store);
    store.transaction(
      'Edit label',
      () => store.setProp('ok', 'label', ['Cancel']),
      { origin: 'devmode' }
    );
    expect(store.undo()).toBe(true);
    expect(store.redo()).toBe(true);
    expect(store.log()).toEqual([
      {
        tx: 1,
        origin: 'devmode',
        label: 'Edit label',
        ops: [{ op: 'setProp', id: 'ok', name: 'label', values: ['Cancel'] }],
      },
      {
        tx: 2,
        origin: 'undo',
        label: null,
        undoes: 1,
        ops: [{ op: 'setProp', id: 'ok', name: 'label', values: ['OK'] }],
      },
      {
        tx: 3,
        origin: 'redo',
        label: null,
        redoes: 1,
        ops: [{ op: 'setProp', id: 'ok', name: 'label', values: ['Cancel'] }],
      },
    ]);
    expect(calls.map(([events]) => events[0].origin)).toEqual([
      'devmode',
      'undo',
      'redo',
    ]);
  });

  it('undo of a redo undoes the redo transaction', () => {
    const store = createStore({ text: TEXT });
    store.setProp('ok', 'label', ['A']);
    store.undo();
    store.redo();
    store.undo();
    expect(store.log().at(-1).undoes).toBe(3);
    expect(store.get('ok').properties[0].values).toEqual(['OK']);
    store.redo();
    expect(store.get('ok').properties[0].values).toEqual(['A']);
  });

  it('restores IDs: a removed subtree comes back with the same IDs', () => {
    const store = createStore({ text: TEXT });
    store.remove('_1');
    expect(store.has('_2')).toBe(false);
    store.undo();
    expect(store.children('_1')).toEqual(['_2', '_3']);
    store.rename('_2', null);
    expect(store.children('_1')).toEqual(['_4', '_3']);
    store.undo();
    expect(store.children('_1')).toEqual(['_2', '_3']);
    store.redo();
    expect(store.children('_1')).toEqual(['_4', '_3']);
  });

  it('a new user transaction clears redo', () => {
    const store = createStore({ text: TEXT });
    store.setProp('ok', 'label', ['A']);
    store.setProp('ok', 'label', ['B']);
    store.undo();
    expect(store.canRedo()).toBe(true);
    store.setProp('ok', 'label', ['C']);
    expect(store.canRedo()).toBe(false);
    expect(store.redo()).toBe(false);
    store.undo();
    store.undo();
    expect(store.undo()).toBe(false);
    expect(store.get('ok').properties[0].values).toEqual(['OK']);
  });

  it('keeps at most historyLimit transactions', () => {
    const store = createStore({ text: TEXT, historyLimit: 2 });
    for (const label of ['A', 'B', 'C']) {
      store.setProp('ok', 'label', [label]);
    }
    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.undo()).toBe(false);
    expect(store.get('ok').properties[0].values).toEqual(['A']);
    expect(createStore({ historyLimit: 0 }).canUndo()).toBe(false);
    expect(errorCode(() => createStore({ historyLimit: -1 }))).toBe(
      'RangeError'
    );
  });

  it('cannot undo or redo inside a transaction', () => {
    const store = createStore({ text: TEXT });
    store.setProp('ok', 'label', ['A']);
    expect(errorCode(() => store.transaction(() => store.undo()))).toBe(
      'in-transaction'
    );
    expect(store.canUndo()).toBe(true);
  });

  it('a listener can undo after a commit', () => {
    const store = createStore({ text: TEXT });
    store.subscribe((events, entry) => {
      if (entry.origin === 'user') {
        store.undo();
      }
    });
    store.setProp('ok', 'label', ['A']);
    expect(store.get('ok').properties[0].values).toEqual(['OK']);
    expect(store.log().map((e) => e.origin)).toEqual(['user', 'undo']);
  });
});
