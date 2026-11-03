/**
 * The Vue plugin and the action registry it provides.
 */

import { UI_ACTIONS_KEY, UI_STORE_KEY } from './keys.js';

/**
 * Handlers by name, falling back to a parent registry (the one of the
 * plugin, or of an enclosing `UiView`).
 * @param {Record<string, Function>|Map<string, Function>} [initial]
 * @param {object|null} [parent]
 */
export function createActionRegistry(initial, parent = null) {
  /** @type {Map<string, Set<Function>>} */
  const own = new Map();
  const register = (name, handler) => {
    if (typeof handler !== 'function') {
      throw new TypeError(
        `ui-vue: the handler of "${name}" must be a function`
      );
    }
    // A wrapper, so the same function can be registered twice.
    const entry = (detail, event) => handler(detail, event);
    if (!own.has(name)) {
      own.set(name, new Set());
    }
    own.get(name).add(entry);
    return () => {
      const set = own.get(name);
      const removed = set?.delete(entry) ?? false;
      if (set?.size === 0) {
        own.delete(name);
      }
      return removed;
    };
  };
  const entries =
    initial instanceof Map ? initial : Object.entries(initial ?? {});
  for (const [name, handler] of entries) {
    register(name, handler);
  }
  return {
    register,
    /** The handlers of a name: its own ones, else the parent's. */
    handlers(name) {
      const set = own.get(name);
      if (set !== undefined && set.size > 0) {
        return [...set];
      }
      return parent?.handlers(name) ?? [];
    },
  };
}

/**
 * A Vue plugin that provides a store and an action registry to the whole
 * app, for `UiView` without a `store`/`source` prop and for the composables.
 *
 * ```js
 * app.use(createUiPlugin({ store, actions: { save: (detail) => {} } }));
 * ```
 * @param {{ store?: object, actions?: Record<string, Function>|Map<string, Function> }} [options]
 */
export function createUiPlugin({ store, actions } = {}) {
  const registry = createActionRegistry(actions);
  return {
    registry,
    install(app) {
      if (store !== undefined && store !== null) {
        app.provide(UI_STORE_KEY, store);
      }
      app.provide(UI_ACTIONS_KEY, registry);
    },
  };
}
