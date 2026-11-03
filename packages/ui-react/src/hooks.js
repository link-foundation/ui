// @ts-self-types="./hooks.d.ts"
/**
 * `@link-foundation/ui-react/hooks`: DOM-free React hooks over a ui-store
 * store. This entry imports only `react`, ui-store types and the ui-core
 * vocabulary (no `react-dom`, no `ui-dom`), so a non-DOM renderer (React
 * Native) can reuse it.
 *
 * Every hook subscribes with `useSyncExternalStore` (with a server
 * snapshot, so the hooks also run during server rendering) and re-renders
 * its component only when its own slice of the store changes.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import {
  UiContext,
  UiProvider,
  useIsomorphicLayoutEffect,
  useUiContext,
} from './context.js';
import { propOf, propsOf, sameValues } from './props.js';

export { UiContext, UiProvider, useUiContext };
export { createActionRegistry } from './actions.js';
export { propsOf, propOf } from './props.js';

/**
 * @typedef {import('@link-foundation/ui-store').Store} Store
 * @typedef {import('@link-foundation/ui-store').ElementView} ElementView
 */

/** The store argument, else the store of the closest provider. */
function useStore(store, hook) {
  const context = useUiContext();
  const resolved = store ?? context.store;
  if (resolved === null || resolved === undefined) {
    throw new Error(
      `${hook}: no store; pass one or render inside <UiProvider store>`
    );
  }
  return resolved;
}

/**
 * Subscribe to a slice of a store. `selector(store)` runs on every store
 * change; the component re-renders only when the result differs from the
 * previous one by `isEqual` (default `Object.is`), so a selector that
 * builds a new object needs an `isEqual` or must cache its result.
 * @template T
 * @param {Store} store
 * @param {(store: Store) => T} selector
 * @param {(a: T, b: T) => boolean} [isEqual]
 * @returns {T}
 */
export function useUiStore(store, selector, isEqual = Object.is) {
  const resolved = useStore(store, 'useUiStore');
  /** @type {import('react').MutableRefObject<{store: Store, value: T}|null>} */
  const cache = useRef(null);
  const subscribe = useCallback(
    (onChange) => resolved.subscribe(() => onChange()),
    [resolved]
  );
  const getSnapshot = () => {
    const value = selector(resolved);
    const previous = cache.current;
    if (
      previous !== null &&
      previous.store === resolved &&
      isEqual(previous.value, value)
    ) {
      return previous.value;
    }
    cache.current = { store: resolved, value };
    return value;
  };
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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

/** Store views are new objects on every read; their fields are stable. */
const sameView = (a, b) =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    VIEW_FIELDS.every((field) => a[field] === b[field]));

/**
 * The view of one store element (`undefined` when there is none); the
 * component re-renders only when this element changes.
 * @param {string} id
 * @param {Store} [store]  default: the store of the provider
 * @returns {ElementView|undefined}
 */
export function useUiElement(id, store) {
  const resolved = useStore(store, 'useUiElement');
  return useUiStore(resolved, (s) => s.get(id), sameView);
}

/**
 * The values of one property of an element (`undefined` when it has none).
 * Positional values have their vocabulary names: `useUiProp('greeting',
 * 'value')` reads `(greeting: text 'Hello')`. The component re-renders only
 * when these values change.
 * @param {string} id
 * @param {string} name
 * @param {Store} [store]  default: the store of the provider
 * @returns {readonly any[]|undefined}
 */
export function useUiProp(id, name, store) {
  const resolved = useStore(store, 'useUiProp');
  return useUiStore(
    resolved,
    (s) => {
      const view = s.get(id);
      return view === undefined ? undefined : propOf(view, name);
    },
    sameValues
  );
}

/**
 * Every property of an element by name (positional values included), or
 * `undefined`; re-renders only when the element changes.
 * @param {string} id
 * @param {Store} [store]
 * @returns {Readonly<Record<string, readonly any[]>>|undefined}
 */
export function useUiProps(id, store) {
  const view = useUiElement(id, store);
  const cache = useRef({ view: undefined, props: undefined });
  if (cache.current.view !== view) {
    cache.current = {
      view,
      props: view === undefined ? undefined : propsOf(view),
    };
  }
  return cache.current.props;
}

/**
 * Handle an action by name while the component is mounted: `(emit NAME)`
 * calls the handler of `NAME`, and any other action the handler of its
 * head (`navigate`, `set`, …). The latest `handler` is always called.
 * @param {string} name
 * @param {import('./actions.js').ActionHandler} handler
 */
export function useUiAction(name, handler) {
  const { registry } = useUiContext();
  if (registry === null) {
    throw new Error(
      'useUiAction: no action registry; render inside <UiProvider> or <UiView>'
    );
  }
  const latest = useRef(handler);
  useIsomorphicLayoutEffect(() => {
    latest.current = handler;
  });
  useIsomorphicLayoutEffect(
    () => registry.register(name, (...args) => latest.current(...args)),
    [registry, name]
  );
}
