/**
 * Incremental patching: store events become DOM mutations of the affected
 * nodes only, batched into one flush per microtask.
 */

import { describe, it, expect } from 'test-anywhere';
import { mountDocument } from '@link-foundation/ui-dom';
import { applyEvents } from '../src/patch.js';
import { createDom, microtasks, sample, storeIds } from './setup-dom.js';

/** Mount the sample with a counter of patch flushes. */
function mountSample(extra = {}) {
  const dom = createDom();
  const patches = [];
  const mounted = mountDocument(dom.container, sample('document'), {
    onPatch: (events) => patches.push(events.length),
    ...extra,
  });
  return { ...dom, ...mounted, patches };
}

const ids = (node) =>
  [...node.children].map((child) => child.getAttribute('data-link-id'));

describe('incremental updates', () => {
  it('patches positional edits, insertion defaults and undo without replacing nodes or explicit properties', () => {
    const { store, handle } = mountSample();
    const greeting = handle.nodeFor('greeting');
    store.setPositional('greeting', ['Edited']);
    handle.flush();
    expect(greeting.textContent).toBe('Edited');
    expect(handle.nodeFor('greeting')).toBe(greeting);
    store.undo();
    handle.flush();
    expect(greeting.textContent).toBe('Hello, links');
    store.redo();
    store.setProp('greeting', 'value', ['Override']);
    store.setPositional('greeting', ['Hidden']);
    handle.flush();
    expect(greeting.textContent).toBe('Override');
    store.removeProp('greeting', 'value');
    handle.flush();
    expect(greeting.textContent).toBe('Hidden');
    store.transaction('Insert with defaults', () => {
      store.insert('body', 0, { id: 'new', kind: 'text' });
      store.setPositional('new', ['New text']);
    });
    handle.flush();
    expect(handle.nodeFor('new').textContent).toBe('New text');
    store.setPositional('new', []);
    handle.flush();
    expect(handle.nodeFor('new').textContent).toBe('');
  });

  it('changes the greeting by mutating only the ui-text node', async () => {
    const { window, container, store, handle } = mountSample();
    const greeting = handle.nodeFor('greeting');
    const others = ['app', 'body', 'ok'].map((id) => handle.nodeFor(id));
    const records = [];
    const observer = new window.MutationObserver((list) =>
      records.push(...list)
    );
    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    store.setProp('greeting', 'value', ['Hi there']);
    await microtasks();
    records.push(...observer.takeRecords());
    observer.disconnect();
    expect(records.length).toBe(1);
    expect(records[0].type).toBe('characterData');
    expect(records[0].target.parentNode).toBe(greeting);
    // The same nodes, patched in place.
    expect(handle.nodeFor('greeting')).toBe(greeting);
    expect(greeting.textContent).toBe('Hi there');
    expect(['app', 'body', 'ok'].map((id) => handle.nodeFor(id))).toEqual(
      others
    );
  });

  it('gives the kind update only the names of the edited properties', () => {
    const calls = [];
    const { store, handle } = mountSample({
      kinds: {
        button: {
          tag: 'ui-button',
          create: (el, ctx) => ctx.document.createElement('ui-button'),
          update: (node, el, changed) => calls.push(changed),
        },
      },
    });
    expect(calls).toEqual([['label', 'variant', 'on']]);
    store.setProp('ok', 'variant', ['outlined']);
    handle.flush();
    expect(calls[1]).toEqual(['variant']);
  });

  it('inserts a subtree at its index', () => {
    const { store, handle } = mountSample();
    const id = store.insert('body', 1, {
      id: 'row',
      kind: 'stack',
      properties: [{ name: 'direction', values: ['horizontal'] }],
      children: [{ id: 'hint', kind: 'text', positional: ['Hint'] }],
    });
    expect(handle.nodeFor(id)).toBeNull();
    handle.flush();
    expect(ids(handle.nodeFor('body'))).toEqual(['greeting', 'row', 'ok']);
    const row = handle.nodeFor('row');
    expect(row.style.getPropertyValue('flex-direction')).toBe('row');
    expect(ids(row)).toEqual(['hint']);
    expect(handle.nodeFor('hint').textContent).toBe('Hint');
    for (const each of storeIds(store)) {
      expect(handle.idFor(handle.nodeFor(each))).toBe(each);
    }
  });

  it('removes a subtree and drops its map entries', () => {
    const { store, handle, container } = mountSample();
    const greeting = handle.nodeFor('greeting');
    store.remove('greeting');
    handle.flush();
    expect(ids(handle.nodeFor('body'))).toEqual(['ok']);
    expect(handle.nodeFor('greeting')).toBeNull();
    expect(handle.idFor(greeting)).toBeNull();
    store.remove('body');
    handle.flush();
    expect(container.querySelectorAll('[data-link-id]').length).toBe(1);
    expect(handle.nodeFor('ok')).toBeNull();
  });

  it('moves a node with insertBefore, keeping its identity', () => {
    const { store, handle, window, container } = mountSample();
    const ok = handle.nodeFor('ok');
    const observer = new window.MutationObserver(() => {});
    observer.observe(container, { subtree: true, childList: true });
    store.move('ok', 'body', 0);
    handle.flush();
    const records = observer.takeRecords();
    observer.disconnect();
    expect(ids(handle.nodeFor('body'))).toEqual(['ok', 'greeting']);
    expect(handle.nodeFor('ok')).toBe(ok);
    // Removed from its old place and inserted at the new one, nothing else.
    expect(
      records.every((r) =>
        [...r.addedNodes, ...r.removedNodes].every((n) => n === ok)
      )
    ).toBe(true);
    // Into another parent, then back to the end.
    store.move('ok', 'app', 0);
    handle.flush();
    expect(ids(handle.nodeFor('app'))).toEqual(['ok', 'body']);
    store.move('ok', 'body');
    handle.flush();
    expect(ids(handle.nodeFor('body'))).toEqual(['greeting', 'ok']);
  });

  it('renames an element: data-link-id and both maps', () => {
    const { store, handle } = mountSample();
    const node = handle.nodeFor('greeting');
    store.rename('greeting', 'hello');
    handle.flush();
    expect(node.getAttribute('data-link-id')).toBe('hello');
    expect(handle.nodeFor('hello')).toBe(node);
    expect(handle.nodeFor('greeting')).toBeNull();
    expect(handle.idFor(node)).toBe('hello');
    store.setProp('hello', 'value', ['Renamed']);
    handle.flush();
    expect(node.textContent).toBe('Renamed');
  });
});

describe('patch batching', () => {
  it('applies 1,000 updates of one transaction in one flush', async () => {
    const { store, handle, patches } = mountSample();
    store.transaction('typing', () => {
      for (let i = 0; i < 1000; i += 1) {
        store.setProp('greeting', 'value', [`n${i}`]);
      }
    });
    expect(patches).toEqual([]);
    await microtasks();
    expect(patches).toEqual([1000]);
    expect(handle.nodeFor('greeting').textContent).toBe('n999');
  });

  it('batches the transactions of one task into one flush', async () => {
    const { store, handle, patches } = mountSample();
    for (let i = 0; i < 1000; i += 1) {
      store.setProp('greeting', 'value', [`n${i}`]);
    }
    await microtasks();
    expect(patches).toEqual([1000]);
    expect(handle.nodeFor('greeting').textContent).toBe('n999');
  });

  it('flush() applies the queue synchronously, once', async () => {
    const { store, handle, patches } = mountSample();
    store.setProp('ok', 'label', ['Go']);
    expect(handle.flush()).toBe(1);
    expect(handle.nodeFor('ok').textContent).toBe('Go');
    await microtasks();
    expect(patches).toEqual([1]);
    expect(handle.flush()).toBe(0);
  });

  it('follows undo, including a value falling back to the positional one', () => {
    const { store, handle } = mountSample();
    store.setProp('greeting', 'value', ['Hi']);
    store.setProp('ok', 'disabled', ['true']);
    handle.flush();
    const ok = handle.nodeFor('ok');
    expect(ok.hasAttribute('disabled')).toBe(true);
    expect(ok.querySelector('button').disabled).toBe(true);
    store.undo();
    store.undo();
    handle.flush();
    expect(handle.nodeFor('greeting').textContent).toBe('Hello, links');
    expect(ok.hasAttribute('disabled')).toBe(false);
    expect(ok.querySelector('button').disabled).toBe(false);
  });

  it('reports a store event that does not match the tree, without throwing', () => {
    const seen = [];
    const tree = {
      insert() {},
      update: () => false,
      move: () => false,
      remove: () => false,
      rename: () => false,
    };
    const events = [
      { type: 'update', id: 'x', props: [], prop: 'value' },
      { type: 'move', id: 'x', after: { parentId: null, index: 0 } },
      { type: 'remove', id: 'x' },
      { type: 'rename', id: 'y', before: 'x', after: 'y' },
      { type: 'insert', id: 'x', after: null },
      { type: 'other', id: 'x' },
    ];
    applyEvents(tree, events, (d) => seen.push(d.code));
    expect(seen).toEqual(Array(6).fill('bad-event'));
  });
});
