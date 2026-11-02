/**
 * Change events and listeners.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore } from '@link-foundation/ui-store';
import { recorded } from './helpers.js';

const TEXT = "(ok: button (label 'OK'))\n(box: stack (text a) (text b))\n";

const label = (value) => [{ name: 'label', values: [value] }];

/** The events of the next commit. */
function eventsOf(store, fn) {
  const calls = recorded(store);
  fn();
  expect(calls.length).toBe(1);
  return calls[0][0];
}

describe('events', () => {
  it('insert: one event per element, parents first', () => {
    const store = createStore({ text: TEXT });
    const events = eventsOf(store, () =>
      store.insert('box', 1, { kind: 'stack', children: [{ kind: 'text' }] })
    );
    expect(events.map((e) => [e.type, e.id, e.parentId, e.index])).toEqual([
      ['insert', '_3', 'box', 1],
      ['insert', '_4', '_3', 0],
    ]);
    expect(events[0]).toEqual({
      seq: 1,
      tx: 1,
      origin: 'user',
      type: 'insert',
      id: '_3',
      parentId: 'box',
      index: 1,
      props: [],
      before: null,
      after: store.get('_3'),
    });
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(Object.isFrozen(events)).toBe(true);
  });

  it('update: the property, its values before and after', () => {
    const store = createStore({ text: TEXT });
    const [set] = eventsOf(store, () =>
      store.setProp('ok', 'label', ['Cancel'])
    );
    expect(set).toEqual({
      seq: 1,
      tx: 1,
      origin: 'user',
      type: 'update',
      id: 'ok',
      parentId: null,
      index: 0,
      props: label('Cancel'),
      prop: 'label',
      before: ['OK'],
      after: ['Cancel'],
    });
    const [added] = eventsOf(store, () =>
      store.setProp('ok', 'variant', ['text'])
    );
    expect([added.before, added.after]).toEqual([null, ['text']]);
    const [removed] = eventsOf(store, () => store.removeProp('ok', 'label'));
    expect([removed.prop, removed.before, removed.after]).toEqual([
      'label',
      ['Cancel'],
      null,
    ]);
    expect(removed.props).toEqual([{ name: 'variant', values: ['text'] }]);
  });

  it('remove: children first, with the removed views', () => {
    const store = createStore({ text: TEXT });
    const before = ['box', '_1', '_2'].map((id) => store.get(id));
    const events = eventsOf(store, () => store.remove('box'));
    expect(events.map((e) => [e.type, e.id, e.parentId, e.index])).toEqual([
      ['remove', '_2', 'box', 1],
      ['remove', '_1', 'box', 0],
      ['remove', 'box', null, 1],
    ]);
    expect(events.map((e) => e.before)).toEqual(before.reverse());
    expect(events.every((e) => e.after === null && e.props === null)).toBe(
      true
    );
  });

  it('move and rename', () => {
    const store = createStore({ text: TEXT });
    const [move] = eventsOf(store, () => store.move('ok', 'box', 2));
    expect(move).toEqual({
      seq: 1,
      tx: 1,
      origin: 'user',
      type: 'move',
      id: 'ok',
      parentId: 'box',
      index: 2,
      props: label('OK'),
      before: { parentId: null, index: 0 },
      after: { parentId: 'box', index: 2 },
    });
    const [rename] = eventsOf(store, () => store.rename('ok', 'go'));
    expect([rename.type, rename.id, rename.before, rename.after]).toEqual([
      'rename',
      'go',
      'ok',
      'go',
    ]);
    expect([rename.parentId, rename.index]).toEqual(['box', 2]);
  });
});

describe('listeners', () => {
  it('a throwing listener does not stop the others', () => {
    const reported = [];
    const store = createStore({
      text: TEXT,
      onListenerError: (error, info) => reported.push([error, info]),
    });
    const boom = new Error('listener');
    const seen = [];
    store.subscribe(() => seen.push('first'));
    const bad = () => {
      throw boom;
    };
    store.subscribe(bad);
    store.subscribe((events) => seen.push(events.length));
    store.setProp('ok', 'label', ['A']);
    expect(seen).toEqual(['first', 1]);
    expect(reported.length).toBe(1);
    expect(reported[0][0]).toBe(boom);
    expect(reported[0][1].entry.tx).toBe(1);
    expect(reported[0][1].events.length).toBe(1);
    expect(store.get('ok').properties).toEqual(label('A'));
  });

  it('reports listener errors with console.error by default', () => {
    const store = createStore({ text: TEXT });
    const original = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args);
    try {
      store.subscribe(() => {
        throw new Error('x');
      });
      store.setProp('ok', 'label', ['A']);
    } finally {
      console.error = original;
    }
    expect(logged.length).toBe(1);
  });

  it('a throwing error reporter does not break the store', () => {
    const store = createStore({
      text: TEXT,
      onListenerError: () => {
        throw new Error('reporter');
      },
    });
    const seen = [];
    store.subscribe(() => {
      throw new Error('x');
    });
    store.subscribe(() => seen.push(1));
    store.setProp('ok', 'label', ['A']);
    expect(seen).toEqual([1]);
  });

  it('unsubscribe stops the calls', () => {
    const store = createStore({ text: TEXT });
    const seen = [];
    const unsubscribe = store.subscribe(() => seen.push(1));
    store.setProp('ok', 'label', ['A']);
    expect(unsubscribe()).toBe(true);
    store.setProp('ok', 'label', ['B']);
    expect(seen).toEqual([1]);
  });

  it('changes made by a listener are delivered after the current batch', () => {
    const store = createStore({ text: TEXT });
    const order = [];
    store.subscribe((events, entry) => {
      order.push(['a', entry.tx]);
      if (entry.tx === 1) {
        store.setProp('ok', 'variant', ['text']);
      }
    });
    store.subscribe((events, entry) => order.push(['b', entry.tx]));
    store.setProp('ok', 'label', ['A']);
    expect(order).toEqual([
      ['a', 1],
      ['b', 1],
      ['a', 2],
      ['b', 2],
    ]);
  });
});
