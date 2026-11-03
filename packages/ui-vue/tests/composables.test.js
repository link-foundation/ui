/**
 * Composables: shallow refs that follow the store, assign only on change
 * and remove their store listener with the effect scope.
 */

import { describe, it, expect } from 'test-anywhere';
import { UiVue, Vue, countedStore, sample, useDom } from './setup-dom.js';

const { effectScope, isReadonly, isShallow, ref, watch } = Vue;
const { useUiAction, useUiElement, useUiProp, useUiStore, propOf } = UiVue;

useDom();

/** Run `fn` in a new effect scope; returns its result and the scope. */
function inScope(fn) {
  const scope = effectScope();
  const result = scope.run(fn);
  return { scope, result };
}

describe('useUiProp', () => {
  it("triggers a watcher only when the element's prop changes", () => {
    const store = countedStore(sample('document'));
    const before = store.listenerCount();
    const seen = [];
    const { scope, result } = inScope(() => {
      const text = useUiProp('greeting', 'text', store);
      watch(text, (value) => seen.push(value), { flush: 'sync' });
      return text;
    });
    expect(result.value).toBe(undefined);
    expect(store.listenerCount()).toBe(before + 1);

    store.setProp('greeting', 'text', ['Hi']);
    expect(seen).toEqual([['Hi']]);
    // Other props and other elements do not trigger the watcher.
    store.setProp('ok', 'label', ['Done']);
    store.setProp('greeting', 'value', ['Hello again']);
    store.setProp('greeting', 'text', ['Hi']);
    expect(seen).toEqual([['Hi']]);
    store.setProp('greeting', 'text', ['Hey']);
    expect(seen).toEqual([['Hi'], ['Hey']]);

    scope.stop();
    expect(store.listenerCount()).toBe(before);
    store.setProp('greeting', 'text', ['Gone']);
    expect(seen.length).toBe(2);
  });

  it('reads positional values under their vocabulary names', () => {
    const store = countedStore(sample('document'));
    const { scope, result } = inScope(() => ({
      value: useUiProp('greeting', 'value', store),
      label: useUiProp('ok', 'label', store),
      missing: useUiProp('nobody', 'value', store),
    }));
    expect(result.value.value).toEqual(['Hello, links']);
    expect(result.label.value).toEqual(['OK']);
    expect(result.missing.value).toBe(undefined);
    store.setPositional('greeting', ['Changed']);
    expect(result.value.value).toEqual(['Changed']);
    scope.stop();
  });

  it('returns a read-only shallow ref', () => {
    const store = countedStore(sample('document'));
    const { scope, result } = inScope(() => useUiProp('ok', 'label', store));
    expect(isReadonly(result)).toBe(true);
    expect(isShallow(result)).toBe(true);
    scope.stop();
  });

  it('follows an ID ref', () => {
    const store = countedStore(sample('document'));
    const id = ref('greeting');
    const { scope, result } = inScope(() => useUiProp(id, 'value', store));
    expect(result.value).toEqual(['Hello, links']);
    store.rename('greeting', 'hello');
    expect(result.value).toBe(undefined);
    id.value = 'hello';
    expect(result.value).toEqual(['Hello, links']);
    scope.stop();
    expect(store.listenerCount()).toBe(0);
  });

  it('gives a named property before the positional value', () => {
    const view = {
      kind: 'text',
      positional: ['a'],
      properties: [{ name: 'value', values: ['b'] }],
    };
    expect(propOf(view, 'value')).toEqual(['b']);
    expect(propOf(undefined, 'value')).toBe(undefined);
  });
});

describe('useUiStore', () => {
  it('assigns only when the selected value changes (Object.is)', () => {
    const store = countedStore(sample('document'));
    let runs = 0;
    const seen = [];
    const { scope, result } = inScope(() => {
      const count = useUiStore((s) => {
        runs += 1;
        return s.children('body').length;
      }, store);
      watch(count, (value) => seen.push(value), { flush: 'sync' });
      return count;
    });
    expect(result.value).toBe(2);
    const runsBefore = runs;
    store.setProp('greeting', 'value', ['x']);
    expect(runs).toBe(runsBefore + 1);
    expect(seen).toEqual([]);
    store.insert('body', 2, { kind: 'text', positional: ['More'] });
    expect(seen).toEqual([3]);
    scope.stop();
    expect(store.listenerCount()).toBe(0);
  });

  it('runs the selector once per transaction', () => {
    const store = countedStore(sample('document'));
    let runs = 0;
    const { scope } = inScope(() =>
      useUiStore((s) => {
        runs += 1;
        return s.get('greeting');
      }, store)
    );
    const before = runs;
    store.transaction(() => {
      store.setProp('greeting', 'value', ['a']);
      store.setProp('ok', 'label', ['b']);
    });
    expect(runs).toBe(before + 1);
    scope.stop();
  });

  it('follows a store ref', () => {
    const first = countedStore("(app: document (greeting: text 'One'))");
    const second = countedStore("(app: document (greeting: text 'Two'))");
    const current = ref(first);
    const { scope, result } = inScope(() =>
      useUiProp('greeting', 'value', current)
    );
    expect(result.value).toEqual(['One']);
    current.value = second;
    expect(result.value).toEqual(['Two']);
    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
    scope.stop();
    expect(second.listenerCount()).toBe(0);
  });

  it('throws without a store or a selector', () => {
    expect(() => useUiStore((s) => s)).toThrow();
    expect(() => useUiStore(null, countedStore(sample('document')))).toThrow();
  });
});

describe('useUiElement', () => {
  it('keeps the same view until the element changes', () => {
    const store = countedStore(sample('document'));
    const seen = [];
    const { scope, result } = inScope(() => {
      const element = useUiElement('greeting', store);
      watch(element, (view) => seen.push(view), { flush: 'sync' });
      return element;
    });
    expect(result.value.kind).toBe('text');
    expect(result.value.positional).toEqual(['Hello, links']);
    store.setProp('ok', 'label', ['Done']);
    expect(seen.length).toBe(0);
    store.setPositional('greeting', ['Changed']);
    expect(seen.length).toBe(1);
    expect(result.value.positional).toEqual(['Changed']);
    store.remove('greeting');
    expect(result.value).toBe(undefined);
    scope.stop();
    expect(store.listenerCount()).toBe(0);
  });
});

describe('useUiAction', () => {
  it('throws without an action registry', () => {
    const { scope } = inScope(() => {
      expect(() => useUiAction('save', () => {})).toThrow();
    });
    scope.stop();
  });
});
