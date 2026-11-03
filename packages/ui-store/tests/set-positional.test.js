/**
 * setPositional: the positional values of an element as one operation.
 */

import { describe, it, expect } from 'test-anywhere';
import { createStore, logFromLino, logToLino } from '@link-foundation/ui-store';
import { errorCode, recorded } from './helpers.js';

const TEXT =
  "(body: stack (greeting: text 'Hello' (style s)) (panel: stack 'Title' (gap 8px) (text inner)))\n" +
  '(stack (text a))\n';

/** Plain JSON copy (no frozen objects, no undefined keys). */
const json = (value) => JSON.parse(JSON.stringify(value));

describe('setPositional', () => {
  it('changes the positional values with one update event', () => {
    const store = createStore({ text: TEXT });
    const calls = recorded(store);
    const before = store.get('greeting');
    store.setPositional('greeting', ['Hi']);
    expect(store.get('greeting').positional).toEqual(['Hi']);
    expect(before.positional).toEqual(['Hello']);
    expect(calls.length).toBe(1);
    const [events, entry] = calls[0];
    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      seq: 1,
      tx: 1,
      origin: 'user',
      type: 'update',
      id: 'greeting',
      parentId: 'body',
      index: 0,
      props: [{ name: 'style', values: ['s'] }],
      before: ['Hello'],
      after: ['Hi'],
    });
    expect('prop' in events[0]).toBe(false);
    expect(Object.isFrozen(events[0].after)).toBe(true);
    expect(entry.ops).toEqual([
      { op: 'setPositional', id: 'greeting', values: ['Hi'] },
    ]);
  });

  it('keeps the ID, the place, the properties and the children', () => {
    const store = createStore({ text: TEXT });
    const children = store.children('panel');
    const index = store.indexOf('panel');
    store.setPositional('panel', ['New title', 'two']);
    expect(store.get('panel').positional).toEqual(['New title', 'two']);
    expect(store.children('panel')).toEqual(children);
    expect(store.parentOf('panel')).toBe('body');
    expect(store.indexOf('panel')).toBe(index);
    expect(store.get('panel').properties).toEqual([
      { name: 'gap', values: ['8px'] },
    ]);
    expect(store.toLino({ style: 'inline' })).toBe(
      "(body: stack (greeting: text Hello (style s)) (panel: stack 'New title' two (gap 8px) (text inner)))\n" +
        '(stack (text a))\n'
    );
  });

  it('sets the values of an anonymous element and clears them', () => {
    const store = createStore({ text: TEXT });
    store.setPositional('_3', []);
    expect(store.get('_3').positional).toEqual([]);
    expect(store.toLino({ style: 'inline' })).toContain('(stack (text))');
    store.setPositional('_3', ['b']);
    expect(store.toLino({ style: 'inline' })).toContain('(stack (text b))');
  });

  it('is undone and redone exactly', () => {
    const store = createStore({ text: TEXT });
    const text = store.toLino();
    store.setPositional('greeting', ['Hi']);
    const changed = store.toLino();
    const calls = recorded(store);
    expect(store.undo()).toBe(true);
    expect(store.get('greeting').positional).toEqual(['Hello']);
    expect(store.toLino()).toBe(text);
    expect(calls[0][0].map((e) => [e.type, e.before, e.after])).toEqual([
      ['update', ['Hi'], ['Hello']],
    ]);
    expect(calls[0][1].ops).toEqual([
      { op: 'setPositional', id: 'greeting', values: ['Hello'] },
    ]);
    expect(store.redo()).toBe(true);
    expect(store.toLino()).toBe(changed);
  });

  it('rolls back inside a failed transaction', () => {
    const store = createStore({ text: TEXT });
    expect(
      errorCode(() =>
        store.transaction(() => {
          store.setPositional('greeting', ['Hi']);
          store.remove('missing');
        })
      )
    ).toBe('unknown-id');
    expect(store.get('greeting').positional).toEqual(['Hello']);
    expect(store.log()).toEqual([]);
  });

  it('checks its input before changing anything', () => {
    const store = createStore({ text: TEXT });
    expect(errorCode(() => store.setPositional('missing', ['x']))).toBe(
      'unknown-id'
    );
    expect(errorCode(() => store.setPositional('greeting', 'x'))).toBe(
      'bad-value'
    );
    expect(errorCode(() => store.setPositional('greeting', [1]))).toBe(
      'bad-value'
    );
    expect(errorCode(() => store.setPositional('greeting', [['a']]))).toBe(
      'bad-value'
    );
    expect(
      errorCode(() =>
        store.setPositional('greeting', [{ id: 'n', values: ['v'] }])
      )
    ).toBe('bad-value');
    expect(errorCode(() => store.apply({ op: 'setPositional' }))).toBe(
      'bad-op'
    );
    expect(store.get('greeting').positional).toEqual(['Hello']);
    expect(store.log()).toEqual([]);
  });

  it('round-trips through the log as Links Notation and replays', () => {
    const store = createStore({ text: TEXT });
    store.setPositional('greeting', ['Hi there', 'x']);
    store.setPositional('_3', []);
    store.undo();
    const text = logToLino(store.log());
    expect(text).toBe(
      [
        'tx 1',
        '  origin user',
        "  setPositional greeting 'Hi there' x",
        'tx 2',
        '  origin user',
        '  setPositional _3',
        'tx 3',
        '  origin undo',
        '  undoes 2',
        '  setPositional _3 a',
        '',
      ].join('\n')
    );
    expect(json(logFromLino(text))).toEqual(json(store.log()));
    const copy = createStore({ text: TEXT });
    copy.replay(logFromLino(text));
    expect(copy.toLino()).toBe(store.toLino());
    expect(copy.get('greeting').positional).toEqual(['Hi there', 'x']);
  });

  it('rejects a setPositional link without an id', () => {
    expect(
      errorCode(() => logFromLino('(tx 1 (origin user) (setPositional))'))
    ).toBe('bad-log');
    expect(
      errorCode(() => logFromLino('(tx 1 (origin user) (setPositional (a b)))'))
    ).toBe('bad-log');
  });
});
