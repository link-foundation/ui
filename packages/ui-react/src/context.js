/**
 * `<UiProvider store actions>` and `useUiContext()`: the store and the
 * action registry shared by `<UiView>` and the hooks below a provider.
 * DOM-free (imports only `react`).
 */

import {
  createContext,
  createElement,
  useContext,
  useLayoutEffect,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createActionRegistry } from './actions.js';

/**
 * @typedef {import('@link-foundation/ui-store').Store} Store
 * @typedef {ReturnType<typeof createActionRegistry>} ActionRegistry
 * @typedef {{store: Store|null, registry: ActionRegistry|null}} UiContextValue
 */

/** @type {import('react').Context<UiContextValue>} */
export const UiContext = createContext(
  Object.freeze({ store: null, registry: null })
);
UiContext.displayName = 'UiContext';

/**
 * `useLayoutEffect` in a browser, `useEffect` on the server (where neither
 * runs, but `useLayoutEffect` warns on React 18). Decided per call, so a
 * DOM that appears after this module loads (tests, workers) is honoured.
 * @param {import('react').EffectCallback} effect
 * @param {import('react').DependencyList} [deps]
 */
export const useIsomorphicLayoutEffect = (effect, deps) =>
  (typeof window === 'undefined' ? useEffect : useLayoutEffect)(effect, deps);

/** The store and the action registry of the closest provider. */
export const useUiContext = () => useContext(UiContext);

/**
 * An action registry for this component, below the one of the context.
 * The registry object lives as long as the component; the `actions` prop
 * is set on every render, so the latest handlers are always called.
 * @param {import('./actions.js').Actions|null|undefined} actions
 * @param {ActionRegistry|null} parent
 */
export function useActionRegistry(actions, parent) {
  const [registry] = useState(() => createActionRegistry(parent));
  registry.parent = parent;
  registry.setActions(actions);
  return registry;
}

/**
 * Provide a store and actions to the `<UiView>`s and hooks below.
 * @param {{store?: Store|null,
 *   actions?: import('./actions.js').Actions|null,
 *   children?: import('react').ReactNode}} props
 */
export function UiProvider({ store = null, actions = null, children }) {
  const parent = useUiContext();
  const registry = useActionRegistry(actions, parent.registry);
  const resolved = store ?? parent.store;
  const value = useMemo(
    () => ({ store: resolved, registry }),
    [resolved, registry]
  );
  return createElement(UiContext.Provider, { value }, children);
}
