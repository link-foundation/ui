/**
 * The action registry of a `<UiProvider>` or `<UiView>`: it maps the
 * actions of `ui-action` events to host functions. DOM-free.
 *
 * An action is data (docs/spec/behaviour.md): `(emit save)` sends the named
 * event `save` to the host, and `(navigate home)` asks the host to
 * navigate. A handler is found by name, in this order:
 *
 * 1. handlers registered with `useUiAction(name, handler)`;
 * 2. the `actions` prop: a plain `{ name: fn }` object, or a registry with
 *    `has(name)` and `dispatch(name, args, meta)`;
 * 3. the registry of the enclosing provider.
 *
 * For `(emit NAME ...)` the name `NAME` is tried first, then `emit`; for
 * any other action its head (`navigate`, `set`, …). A plain handler is
 * called as `handler(detail, event)`; a registry gets
 * `dispatch(name, args, { detail, event })`.
 */

/**
 * @typedef {{source: string|null, event: string, action: readonly any[]}}
 *   ActionDetail  the `ui-action` event detail of ui-dom
 * @typedef {(detail: ActionDetail, event?: Event) => unknown} ActionHandler
 * @typedef {{has: (name: string) => boolean,
 *   dispatch: (name: string, args: readonly any[], meta: object) => unknown}}
 *   ActionRegistryLike  an actions registry
 * @typedef {Record<string, ActionHandler>|ActionRegistryLike} Actions
 */

/** Whether `actions` is a registry (`has` and `dispatch`), not an object of functions. */
export const isRegistry = (actions) =>
  actions !== null &&
  typeof actions === 'object' &&
  typeof actions.has === 'function' &&
  typeof actions.dispatch === 'function';

/** The names an action is looked up by, most specific first. */
export function actionNames(action) {
  const [head, name] = action;
  return head === 'emit' && typeof name === 'string' ? [name, head] : [head];
}

const isProduction = () => {
  try {
    return globalThis.process?.env?.NODE_ENV === 'production';
  } catch {
    return false;
  }
};

/** A development warning; silent in production builds. */
export function warn(message) {
  if (!isProduction()) {
    globalThis.console?.warn(`[ui-react] ${message}`);
  }
}

/**
 * The function of one name in an `actions` prop: `(detail, event) => …`,
 * or `undefined`.
 * @param {Actions|null|undefined} actions
 * @param {string} name
 * @param {readonly any[]} args  the action without the looked-up name
 */
function fromActions(actions, name, args) {
  if (actions === null || actions === undefined) {
    return undefined;
  }
  if (isRegistry(actions)) {
    return actions.has(name)
      ? (detail, event) => actions.dispatch(name, args, { detail, event })
      : undefined;
  }
  return Object.hasOwn(actions, name) && typeof actions[name] === 'function'
    ? actions[name]
    : undefined;
}

/**
 * @param {ReturnType<typeof createActionRegistry>|null} [parent]
 */
export function createActionRegistry(parent = null) {
  /** @type {Map<string, ActionHandler[]>} */
  const own = new Map();
  /** @type {Actions|null|undefined} */
  let actions;

  const registry = {
    parent,
    /** Replace the `actions` prop (the latest render wins). */
    setActions(next) {
      actions = next;
    },
    /**
     * Register a handler; the last registration of a name wins until it is
     * removed.
     * @returns {() => void} remove the handler
     */
    register(name, handler) {
      const list = own.get(name) ?? [];
      list.push(handler);
      own.set(name, list);
      return () => {
        const at = list.lastIndexOf(handler);
        if (at >= 0) {
          list.splice(at, 1);
        }
        if (list.length === 0 && own.get(name) === list) {
          own.delete(name);
        }
      };
    },
    /** Whether any handler source is configured here or above. */
    configured() {
      return (
        own.size > 0 ||
        (actions !== null && actions !== undefined) ||
        (registry.parent?.configured() ?? false)
      );
    },
    /**
     * The handler of an action: `(detail, event) => …`, or `undefined`.
     * @param {readonly any[]} action
     */
    lookup(action) {
      for (const name of actionNames(action)) {
        const list = own.get(name);
        if (list !== undefined && list.length > 0) {
          return list[list.length - 1];
        }
        const args = action.slice(name === action[0] ? 1 : 2);
        const fn = fromActions(actions, name, args);
        if (fn !== undefined) {
          return fn;
        }
      }
      return registry.parent?.lookup(action);
    },
    /**
     * Call the handler of a `ui-action` detail. Without one, a configured
     * registry warns in development; returns whether a handler ran.
     * @param {ActionDetail} detail
     * @param {Event} [event]
     */
    dispatch(detail, event) {
      const handler = registry.lookup(detail.action);
      if (handler === undefined) {
        if (registry.configured()) {
          warn(
            `no handler for the action (${detail.action.join(' ')}) of ` +
              `"${detail.source}"; it is ignored`
          );
        }
        return false;
      }
      handler(detail, event);
      return true;
    },
  };
  return registry;
}
