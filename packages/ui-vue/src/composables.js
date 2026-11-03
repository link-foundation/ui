/**
 * Composables over a ui-store store. Each one returns a read-only shallow
 * ref that follows the store: the value is recomputed once per committed
 * transaction and assigned only when it changed, so a watcher of the ref
 * runs only for changes it can see. The store listener is removed when the
 * effect scope (usually the component) is disposed.
 */

import {
  getCurrentScope,
  onScopeDispose,
  shallowReadonly,
  shallowRef,
  toValue,
  watchEffect,
} from 'vue';
import { defaultVocabulary } from '@link-foundation/ui-core';
import { UI_ACTIONS_KEY, UI_STORE_KEY, injected, isServer } from './keys.js';

const VOCABULARY = defaultVocabulary();

/**
 * The store of a composable: the argument, else the injected one.
 * @param {unknown} store
 * @param {string} caller
 */
function storeSource(store, caller) {
  const source = store ?? injected(UI_STORE_KEY);
  if (source === null || source === undefined) {
    throw new Error(
      `${caller}: no store. Pass one, install createUiPlugin({ store }) or call it inside a UiView component.`
    );
  }
  return source;
}

/** Run `dispose` with the current effect scope (warn when there is none). */
function onDispose(dispose, caller) {
  if (getCurrentScope() === undefined) {
    console.warn(
      `${caller}: called outside an effect scope, the store listener is never removed.`
    );
    return;
  }
  onScopeDispose(dispose);
}

/**
 * A read-only shallow ref of `read(store)` that follows the store.
 * `source` and anything `read` reads may be refs or getters: the ref
 * follows them too.
 * @template T
 * @param {unknown} source  a store, a ref of a store or a getter
 * @param {(store: object) => T} read
 * @param {(a: unknown, b: unknown) => boolean} equals
 * @param {string} caller
 */
function follow(source, read, equals, caller) {
  const result = shallowRef();
  let current;
  const assign = (next) => {
    if (!equals(current, next)) {
      current = next;
      result.value = next;
    }
  };
  if (isServer()) {
    const store = toValue(source);
    assign(store ? read(store) : undefined);
    return shallowReadonly(result);
  }
  let subscribed = null;
  let unsubscribe = null;
  const stop = watchEffect(
    () => {
      const store = toValue(source) ?? null;
      if (store !== subscribed) {
        unsubscribe?.();
        subscribed = store;
        unsubscribe =
          store === null ? null : store.subscribe(() => assign(read(store)));
      }
      assign(store === null ? undefined : read(store));
    },
    { flush: 'sync' }
  );
  onDispose(() => {
    stop();
    unsubscribe?.();
    unsubscribe = null;
    subscribed = null;
  }, caller);
  return shallowReadonly(result);
}

/** Equal atoms, or arrays of equal values (property values are data). */
export function sameValue(a, b) {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  return false;
}

const VIEW_FIELDS = [
  'id',
  'name',
  'kind',
  'parentId',
  'positional',
  'properties',
  'unknown',
];

/**
 * Two store element views of the same state: `store.get` returns a new
 * view per call, but keeps the arrays of an unchanged element.
 */
const sameView = (a, b) =>
  Object.is(a, b) ||
  (a !== undefined &&
    b !== undefined &&
    VIEW_FIELDS.every((field) => Object.is(a[field], b[field])));

/**
 * A reactive slice of the store. The selector runs one time per committed
 * transaction; the ref is assigned only when the selected value changed
 * (`Object.is`).
 * @template T
 * @param {(store: object) => T} selector
 * @param {object} [store]  a store or a ref of one; defaults to the
 *   injected store
 */
export function useUiStore(selector, store) {
  if (typeof selector !== 'function') {
    throw new TypeError('useUiStore: the selector must be a function');
  }
  return follow(
    storeSource(store, 'useUiStore'),
    selector,
    Object.is,
    'useUiStore'
  );
}

/**
 * The store view of an element (`store.get(id)`), `undefined` while it
 * does not exist. `id` may be a ref or a getter (`() => props.id`).
 * @param {string|import('vue').MaybeRefOrGetter<string>} id
 * @param {object} [store]
 */
export function useUiElement(id, store) {
  return follow(
    storeSource(store, 'useUiElement'),
    (s) => s.get(toValue(id)),
    sameView,
    'useUiElement'
  );
}

/**
 * The values of one property of an element, as the renderer sees them:
 * the positional values under their vocabulary names (`value` of a `text`,
 * `label` of a `button`), overridden by a named property. For a kind the
 * vocabulary does not know (a custom `chart`), ui-core keeps the sub-links
 * in `unknown`: `(values 3 1 2)` is read as the property `values`.
 * `undefined` when the element or the property does not exist.
 * @param {string|import('vue').MaybeRefOrGetter<string>} id
 * @param {string|import('vue').MaybeRefOrGetter<string>} name
 * @param {object} [store]
 */
export function useUiProp(id, name, store) {
  return follow(
    storeSource(store, 'useUiProp'),
    (s) => propOf(s.get(toValue(id)), toValue(name)),
    sameValue,
    'useUiProp'
  );
}

/** The values of a property of a store view (see `useUiProp`). */
export function propOf(view, name) {
  if (view === undefined) {
    return undefined;
  }
  for (let i = view.properties.length - 1; i >= 0; i -= 1) {
    if (view.properties[i].name === name) {
      return view.properties[i].values;
    }
  }
  const names = VOCABULARY.kinds.get(view.kind)?.positional ?? [];
  const index = names.indexOf(name);
  if (index >= 0 && index < view.positional.length) {
    return [view.positional[index]];
  }
  for (let i = view.unknown.length - 1; i >= 0; i -= 1) {
    const link = view.unknown[i];
    if (Array.isArray(link) && link[0] === name) {
      return link.slice(1);
    }
  }
  return undefined;
}

/**
 * Handle an action by name for the lifetime of the current effect scope.
 * The handler receives the `ui-action` detail and the event. Returns a
 * function that removes the handler earlier.
 * @param {string} name  the action name (`navigate`) or the emitted event
 *   name of an `(emit NAME)` action
 * @param {(detail: object, event: Event) => void} handler
 */
export function useUiAction(name, handler) {
  const registry = injected(UI_ACTIONS_KEY);
  if (registry === null) {
    throw new Error(
      'useUiAction: no action registry. Install createUiPlugin() or call it inside a UiView component.'
    );
  }
  const remove = registry.register(name, handler);
  onDispose(remove, 'useUiAction');
  return remove;
}
