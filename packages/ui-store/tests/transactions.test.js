/**
 * Transactions: one listener call per commit, nesting, rollback.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore } from '@link-foundation/ui-store';
import { errorCode, recorded } from './helpers.js';

const TEXT = "(ok: button (label 'OK'))\n(stack (text a) (text b))\n";

describe('transactions', () => {
  it('1,000 setProp calls in one transaction give one call with 1,000 events', () => {
    const store = createStore({ text: TEXT });
    const calls = recorded(store);
    store.transaction('Many', () => {
      for (let i = 0; i < 1000; i++) {
        store.setProp('ok', 'label', [`L${i}`]);
      }
    });
    expect(calls.length).toBe(1);
    const [events, entry] = calls[0];
    expect(events.length).toBe(1000);
    expect(events.map((e) => e.seq)).toEqual(
      Array.from({ length: 1000 }, (_, i) => i + 1)
    );
    expect(events.every((e) => e.tx === 1 && e.type === 'update')).toBe(true);
    expect(entry.label).toBe('Many');
    expect(entry.ops.length).toBe(1000);
    expect(store.get('ok').properties).toEqual([
      { name: 'label', values: ['L999'] },
    ]);
  });

  it('a throwing transaction changes nothing, emits nothing and rethrows', () => {
    const store = createStore({ text: TEXT });
    const before = store.toLino();
    const calls = recorded(store);
    const boom = new Error('boom');
    let caught;
    try {
      store.transaction('Fails', () => {
        store.setProp('ok', 'label', ['Cancel']);
        store.insert('_1', 0, {
          kind: 'text',
          properties: [{ name: 'value', values: ['v'] }],
          children: [{ kind: 'text' }],
        });
        store.move('ok', '_1', 1);
        store.rename('_2', 'x');
        store.rename('ok', null);
        store.removeProp('_4', 'value');
        store.remove('_1');
        throw boom;
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(boom);
    expect(store.toLino()).toBe(before);
    expect(calls).toEqual([]);
    expect(store.log()).toEqual([]);
    expect(store.canUndo()).toBe(false);
    expect(store.has('ok')).toBe(true);
    store.setProp('ok', 'label', ['After']);
    expect(calls[0][0][0].seq).toBe(1);
    expect(calls[0][1].tx).toBe(1);
  });

  it('a failing operation rolls back the operations before it', () => {
    const store = createStore({ text: TEXT });
    const before = store.toLino();
    expect(
      errorCode(() =>
        store.transaction(() => {
          store.setProp('ok', 'label', ['Cancel']);
          store.remove('missing');
        })
      )
    ).toBe('unknown-id');
    expect(store.toLino()).toBe(before);
  });
});

describe('nested transactions', () => {
  it('nested transactions join the outer one', () => {
    const store = createStore({ text: TEXT });
    const calls = recorded(store);
    const result = store.transaction('Outer', () => {
      store.setProp('ok', 'label', ['A']);
      const inner = store.transaction('Inner', () => {
        store.setProp('ok', 'variant', ['filled']);
        return 'inner';
      });
      store.remove('_2');
      return `outer+${inner}`;
    });
    expect(result).toBe('outer+inner');
    expect(calls.length).toBe(1);
    expect(calls[0][1].label).toBe('Outer');
    expect(calls[0][0].map((e) => e.type)).toEqual([
      'update',
      'update',
      'remove',
    ]);
    store.undo();
    expect(store.toLino()).toBe(createStore({ text: TEXT }).toLino());
  });

  it('an inner transaction that throws is rolled back alone when caught', () => {
    const store = createStore({ text: TEXT });
    const calls = recorded(store);
    store.transaction(() => {
      store.setProp('ok', 'label', ['A']);
      try {
        store.transaction(() => {
          store.setProp('ok', 'label', ['B']);
          store.remove('_1');
          throw new Error('inner');
        });
      } catch {
        // keep going
      }
      store.setProp('ok', 'variant', ['text']);
    });
    expect(calls.length).toBe(1);
    expect(calls[0][0].map((e) => [e.seq, e.after])).toEqual([
      [1, ['A']],
      [2, ['text']],
    ]);
    expect(store.get('ok').properties).toEqual([
      { name: 'label', values: ['A'] },
      { name: 'variant', values: ['text'] },
    ]);
    expect(store.has('_1')).toBe(true);
  });
});

describe('transaction metadata', () => {
  it('every write outside a transaction is a transaction of its own', () => {
    const store = createStore({ text: TEXT });
    const calls = recorded(store);
    store.setProp('ok', 'label', ['A']);
    store.remove('_1');
    expect(
      calls.map(([, entry]) => [entry.tx, entry.origin, entry.label])
    ).toEqual([
      [1, 'user', null],
      [2, 'user', null],
    ]);
  });

  it('keeps origin and label; an empty transaction commits nothing', () => {
    const store = createStore({ text: TEXT });
    const calls = recorded(store);
    expect(store.transaction('Nothing', () => 42)).toBe(42);
    store.transaction(
      'Edit label',
      () => store.setProp('ok', 'label', ['Cancel']),
      { origin: 'devmode' }
    );
    store.transaction(() => store.setProp('ok', 'label', ['X']), {
      origin: 'remote',
    });
    expect(calls.length).toBe(2);
    expect(calls[0][0][0].origin).toBe('devmode');
    expect(
      store.log().map(({ tx, origin, label }) => [tx, origin, label])
    ).toEqual([
      [1, 'devmode', 'Edit label'],
      [2, 'remote', null],
    ]);
  });

  it('rejects asynchronous transaction functions and rolls them back', () => {
    const store = createStore({ text: TEXT });
    const before = store.toLino();
    expect(
      errorCode(() =>
        store.transaction(() => {
          store.setProp('ok', 'label', ['A']);
          return Promise.resolve();
        })
      )
    ).toBe('async-transaction');
    expect(store.toLino()).toBe(before);
    expect(errorCode(() => store.transaction('x'))).toBe('bad-op');
  });
});
